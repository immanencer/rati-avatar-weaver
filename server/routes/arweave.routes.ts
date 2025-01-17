import { Router, Request, Response } from "express";
import Arweave from "arweave";
import type { JWKInterface } from "arweave/node/lib/wallet";
import fs from "fs";
import path from "path";

// Initialize Arweave
const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
  timeout: 60000,
});

// Types
interface ArweaveMetadata {
  name: string;
  emoji: string;
  personality: string;
  description: string;
  narrativeHistory: string;
  arweaveImageUrl: string;
  timestamp: string;
}

// Function to load Arweave wallet
async function loadWallet(): Promise<JWKInterface> {
  const walletPath = path.join(process.cwd(), ".keys/arweave-key.json");
  try {
    const walletData = await fs.promises.readFile(walletPath, "utf-8");
    return JSON.parse(walletData);
  } catch (error) {
    console.error("Failed to load wallet:", error);
    throw new Error("Failed to load Arweave wallet");
  }
}

// Transaction Manager
const transactionManager = {
  async verifyTransaction(transactionId: string) {
    try {
      const status = await arweave.transactions.getStatus(transactionId);
      return status.confirmed && status.confirmed.number_of_confirmations > 0;
    } catch (error) {
      console.error("Error verifying transaction:", error);
      return false;
    }
  },

  async uploadTransaction(data: Buffer | string, tags: Record<string, string>) {
    const wallet = await loadWallet();
    const tx = await arweave.createTransaction({ data }, wallet);

    // Add tags
    Object.entries(tags).forEach(([key, value]) => {
      tx.addTag(key, value);
    });

    await arweave.transactions.sign(tx, wallet);
    await arweave.transactions.post(tx);

    return {
      id: tx.id,
      url: `https://arweave.net/${tx.id}`,
    };
  },

  async findExistingTransaction(originalUrl: string) {
    // Placeholder for actual implementation
    return null;
  },
};

// Create router
const router = Router();

// Add routes
router.post("/upload", async (req: Request, res: Response) => {
  try {
    const { data, tags } = req.body;
    const result = await transactionManager.uploadTransaction(data, tags);
    res.json(result);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Failed to upload to Arweave" });
  }
});

router.get("/transaction/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isVerified = await transactionManager.verifyTransaction(id);
    res.json({ verified: isVerified });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ message: "Failed to verify transaction" });
  }
});

export { router as arweaveRoutes, transactionManager };
