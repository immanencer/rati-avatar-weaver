import { Router } from "express";
import type { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { db } from "@db";
import { ArweaveTransactionManager } from "../lib/arweaveTransactionManager";
import fetch from "node-fetch";

const AVATARS_COLLECTION = "avatars";
const DEFAULT_PAGE_SIZE = 12;

// Types
interface Avatar {
  _id: ObjectId;
  name: string;
  emoji: string;
  personality: string;
  description: string;
  imageUrl?: string;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'failed';
  uploadError?: string | null;
  arweaveUrl?: string | null;
  arweaveMetadataUrl?: string | null;
  ownerAddress?: string;
  updatedAt: Date;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

const router = Router();

// Initialize ArweaveTransactionManager
const transactionManager = new ArweaveTransactionManager();

// Get server AR balance
router.get("/server-balance", async (_req: Request, res: Response) => {
  try {
    const balance = await transactionManager.getBalance();
    const address = await transactionManager.getWalletAddress();

    if (!address) {
      throw new Error('Server wallet not initialized');
    }

    res.json({ 
      balance,
      address 
    });
  } catch (error) {
    console.error("Error fetching server balance:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to fetch server balance",
    });
  }
});

// Fund server wallet
router.post("/fund", async (req: Request, res: Response) => {
  try {
    const { txId } = req.body;

    if (!txId) {
      return res.status(400).json({ message: "Transaction ID is required" });
    }

    const address = await transactionManager.getWalletAddress();
    if (!address) {
      throw new Error('Server wallet not initialized');
    }

    // Verify that the transaction is confirmed
    const status = await transactionManager.arweave.transactions.getStatus(txId);

    if (status.status !== 200 || !status.confirmed) {
      return res.status(400).json({ 
        message: "Transaction not confirmed yet",
        status: status.status,
        confirmed: status.confirmed
      });
    }

    // Get transaction details to verify it's a transfer to our address
    const tx = await transactionManager.arweave.transactions.get(txId);
    const recipient = await transactionManager.arweave.wallets.ownerToAddress(tx.owner);

    if (recipient !== address) {
      return res.status(400).json({ 
        message: "Transaction is not a transfer to server wallet",
        recipient,
        serverAddress: address
      });
    }

    // Get new balance
    const balance = await transactionManager.getBalance();

    res.json({
      message: "Funding transaction verified",
      balance,
      address
    });
  } catch (error) {
    console.error("Error processing funding:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to process funding",
    });
  }
});

// Get avatars with pagination and filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || DEFAULT_PAGE_SIZE));
    const skip = (page - 1) * limit;
    const filter = req.query.filter as string;
    const address = req.query.address as string;

    const database = await db.getDB();
    const avatarsCollection = database.collection<Avatar>(AVATARS_COLLECTION);

    let query: any = {};
    if (filter === "imprinted" && address) {
      query = {
        ownerAddress: address,
        arweaveUrl: { $ne: null }
      };
    }

    const [total, items] = await Promise.all([
      avatarsCollection.countDocuments(query),
      avatarsCollection
        .find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    const response: PaginatedResponse<Avatar> = {
      items,
      total,
      page,
      totalPages,
      hasMore
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching avatars:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to fetch avatars",
    });
  }
});

// Weave avatar to Arweave (server-side)
router.post("/:id/weave", async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const database = await db.getDB();
    const avatarsCollection = database.collection<Avatar>(AVATARS_COLLECTION);

    // Find avatar
    const avatar = await avatarsCollection.findOne({ _id: new ObjectId(id) });
    if (!avatar) {
      return res.status(404).json({ message: "Avatar not found" });
    }

    try {
      // Update avatar status to uploading
      await avatarsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            uploadStatus: 'uploading',
            updatedAt: new Date()
          }
        }
      );

      // Upload image if it exists
      let imageTransaction;
      if (avatar.imageUrl) {
        console.log(`Uploading image for avatar: ${avatar._id}`);
        const imageResponse = await fetch(avatar.imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();

        imageTransaction = await transactionManager.uploadTransaction(
          Buffer.from(imageBuffer),
          {
            contentType: 'image/png',
            transactionType: 'avatar-image',
            appName: 'Avatar-Manager',
            timestamp: new Date().toISOString(),
            originalImageUrl: avatar.imageUrl
          }
        );
      }

      // Prepare and upload metadata
      const metadata = {
        name: avatar.name,
        emoji: avatar.emoji,
        personality: avatar.personality,
        description: avatar.description,
        imageTransactionId: imageTransaction?.id,
        timestamp: new Date().toISOString(),
        avatarId: avatar._id.toString()
      };

      console.log(`Uploading metadata for avatar: ${avatar._id}`);
      const metadataTransaction = await transactionManager.uploadTransaction(
        JSON.stringify(metadata, null, 2),
        {
          contentType: 'application/json',
          transactionType: 'avatar-metadata',
          appName: 'Avatar-Manager',
          timestamp: new Date().toISOString()
        }
      );

      // Update avatar with Arweave URLs
      await avatarsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            uploadStatus: 'completed',
            arweaveUrl: imageTransaction?.url,
            arweaveMetadataUrl: metadataTransaction.url,
            updatedAt: new Date()
          }
        }
      );

      res.json({
        message: "Avatar successfully published to Arweave",
        imageUrl: imageTransaction?.url,
        metadataUrl: metadataTransaction.url
      });
    } catch (error) {
      console.error(`Error during Arweave upload:`, error);

      // Update avatar with error status
      await avatarsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            uploadStatus: 'failed',
            uploadError: error instanceof Error ? error.message : 'Failed to upload to Arweave',
            updatedAt: new Date()
          }
        }
      );

      throw error;
    }
  } catch (error) {
    console.error("Error weaving avatar:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to weave avatar",
    });
  }
});

// Get avatar by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const database = await db.getDB();
    const avatarsCollection = database.collection<Avatar>(AVATARS_COLLECTION);

    const avatar = await avatarsCollection.findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!avatar) {
      return res.status(404).json({ message: "Avatar not found" });
    }

    res.json(avatar);
  } catch (error) {
    console.error("Error fetching avatar:", error);
    res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to fetch avatar",
    });
  }
});

export { router as avatarRoutes };