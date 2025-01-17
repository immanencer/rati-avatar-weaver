import { Router } from "express";
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createTransactionWithInstructions,
  splitInstructionsIntoTransactions,
} from "../utils/transaction.utils";
import { calculateOptimalFees } from "../utils/fees.utils";
import { getMintInstructions } from "../services/candyMachine.service";
import { MongoClient } from "mongodb";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCandyMachine } from "@metaplex-foundation/mpl-candy-machine";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import path from "path";
import fs from "fs";

// Enhanced connection configuration with WebSocket support
const rpcEndpoint =
  process.env.SOLANA_RPC_ENDPOINT || "https://api.mainnet-beta.solana.com";
const connection = new Connection(rpcEndpoint, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000, // 60 seconds timeout
  wsEndpoint: rpcEndpoint.replace("https://", "wss://"),
});

// Initialize UMI with proper error handling
const umi = createUmi(rpcEndpoint).use(mplCandyMachine());

const router = Router();

// MongoDB connection setup
interface DbOperations {
  getCollection: (collectionName: string) => Promise<any>;
}

interface Database {
  operations: DbOperations;
}

let db: Database = {
  operations: {
    getCollection: async () => {
      throw new Error("Database not initialized");
    },
  },
};

async function initializeDb() {
  try {
    const mongoUri = process.env.MONGODB_URL;
    if (!mongoUri) {
      throw new Error("MongoDB URI not provided");
    }

    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log("Successfully connected to MongoDB");

    db = {
      operations: {
        getCollection: async (collectionName: string) =>
          client.db().collection(collectionName),
      },
    };
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

// Initialize database connection
initializeDb().catch(console.error);

interface MintRequest {
  candyMachineAddress: string;
  walletAddress: string;
}

router.post("/mint", async (req, res) => {
  try {
    console.log("Received mint request:", req.body);
    const { candyMachineAddress, walletAddress } = req.body as MintRequest;

    if (!candyMachineAddress || !walletAddress) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const userWallet = new PublicKey(walletAddress);

    // Enhanced blockhash retrieval with UMI
    const latestBlockhash = await umi.rpc.getLatestBlockhash();
    console.log("Latest blockhash:", {
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    // Get mint instructions with improved error handling
    const { setupInstructions, paymentInstructions, mintInstructions } =
      await getMintInstructions(connection, candyMachineAddress, walletAddress);

    // Process transactions with improved block height handling
    const transactions = await processTransactionsWithBlockHeight(
      connection,
      userWallet,
      setupInstructions,
      paymentInstructions,
      mintInstructions,
      latestBlockhash,
    );

    // Calculate optimal fees using UMI's priority fee calculator
    const { estimatedPriorityFee } = await calculateOptimalFees(connection);

    res.json({
      transactions,
      estimatedPriorityFee,
      message: "Transactions created successfully",
      blockHeight: latestBlockhash.lastValidBlockHeight,
    });
  } catch (error) {
    console.error("Mint error:", error);
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Failed to create mint transaction",
    });
  }
});

// Process transactions with improved block height handling
async function processTransactionsWithBlockHeight(
  connection: Connection,
  userWallet: PublicKey,
  setupInstructions: TransactionInstruction[],
  paymentInstructions: TransactionInstruction[],
  mintInstructions: TransactionInstruction[],
  latestBlockhash: { blockhash: string; lastValidBlockHeight: number },
): Promise<string[]> {
  const transactions: Transaction[] = [];

  // Add compute budget instructions to all transactions
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 800000, // Increased compute units for complex operations
  });

  // Helper function to process instruction batch with enhanced error handling
  const processInstructionBatch = async (
    instructions: TransactionInstruction[],
    label: string,
  ): Promise<void> => {
    if (instructions.length === 0) return;

    try {
      console.log(
        `Processing ${label} with blockhash:`,
        latestBlockhash.blockhash,
      );

      const tx = await createTransactionWithInstructions(
        [computeBudgetIx, ...instructions],
        userWallet,
        latestBlockhash.blockhash,
        latestBlockhash.lastValidBlockHeight,
        connection,
      );
      transactions.push(tx);
    } catch (error) {
      console.error(`Error processing ${label}:`, error);
      throw error;
    }
  };

  // Process each instruction type with proper block height handling
  await processInstructionBatch(setupInstructions, "setup instructions");
  await processInstructionBatch(paymentInstructions, "payment instructions");

  // Split mint instructions with improved block confirmation strategy
  const mintTxs = await splitInstructionsIntoTransactions(
    [computeBudgetIx, ...mintInstructions],
    userWallet,
    latestBlockhash.blockhash,
    latestBlockhash.lastValidBlockHeight,
    connection,
  );
  transactions.push(...mintTxs);

  // Serialize transactions with enhanced error handling
  return transactions.map((tx, index) => {
    try {
      console.log(
        `Serializing transaction ${index + 1}/${transactions.length}`,
      );
      const serialized = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      return Buffer.from(serialized).toString("base64");
    } catch (error) {
      console.error(`Failed to serialize transaction ${index + 1}:`, error);
      throw new Error(
        `Transaction serialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  });
}

export { router as solanaRoutes };

// Export utility functions for testing
export const _test = {
  processTransactionsWithBlockHeight,
};

interface DefaultCandyGuardSettings {
  botTax?: { lamports: number; lastInstruction: boolean };
  mintLimit?: { id: number; limit: number };
  solPayment?: { amount: number; destination: PublicKey };
  tokenPayment?: { amount: number; mint: PublicKey; destinationAta: PublicKey };
}

function sol(amount: number): number {
  return amount * LAMPORTS_PER_SOL;
}

function token(amount: number): number {
  return amount;
}

async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt === maxAttempts) {
        console.error("All retry attempts exhausted");
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 10000);
      console.log(`Retrying in ${delay}ms...`);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

async function calculateRentExempt(space: number = 165): Promise<number> {
  try {
    const rent = await connection.getMinimumBalanceForRentExemption(space);
    console.log(
      `Rent-exempt balance for ${space} bytes: ${rent / LAMPORTS_PER_SOL} SOL`,
    );
    return rent;
  } catch (error) {
    console.error("Error calculating rent:", error);
    return 0.002 * LAMPORTS_PER_SOL;
  }
}

async function uploadToArweave(data: Buffer, contentType: string) {
  //Implementation for uploading to Arweave - Replace with your actual Arweave upload logic
  throw new Error("Arweave upload not implemented");
}

async function createCandyMachine(
  avatarIds: string[],
  tokenConfig?: { mint: string; amount: number },
) {
  try {
    // Parse creator private key
    let creatorPrivateKey: number[];
    try {
      creatorPrivateKey = process.env.CREATOR_PRIVATE_KEY
        ? JSON.parse(process.env.CREATOR_PRIVATE_KEY)
        : [];

      if (!Array.isArray(creatorPrivateKey) || creatorPrivateKey.length === 0) {
        throw new Error("Invalid private key format");
      }
    } catch (error) {
      console.error("Failed to parse CREATOR_PRIVATE_KEY:", error);
      throw new Error("Invalid creator private key configuration");
    }

    // Create keypair from array
    const creatorKeypair = Keypair.fromSecretKey(
      Uint8Array.from(creatorPrivateKey),
    );

    // Check creator balance
    const balance = await connection.getBalance(creatorKeypair.publicKey);
    const minimumBalance = 0.05 * 1e9; // 0.05 SOL in lamports

    if (balance < minimumBalance) {
      throw new Error(
        `Insufficient balance. Creator account needs at least 0.05 SOL. Current balance: ${balance / 1e9} SOL`,
      );
    }

    // Initialize Metaplex with creator identity and higher priority settings
    const mx = Metaplex.make(connection, {
      cluster: "devnet",
      defaultPriorityFee: 500000, // Increased priority fee
    }).use(keypairIdentity(creatorKeypair));

    // Upload collection image to Arweave
    console.log("Reading collection image...");
    const collectionImagePath = path.join(
      process.cwd(),
      "assets",
      "collection.png",
    );
    const collectionImageBuffer =
      await fs.promises.readFile(collectionImagePath);
    const collectionImageUrl = await uploadToArweave(
      collectionImageBuffer,
      "image/png",
    );
    console.log("Collection image uploaded:", collectionImageUrl);

    // Create minimal metadata to avoid URI too long errors
    const collectionMetadata = {
      name: "RATi",
      symbol: "RATI",
      description: "RATi Collection",
      image: collectionImageUrl,
    };

    console.log("Uploading collection metadata...");
    const collectionMetadataUrl = await uploadToArweave(
      JSON.stringify(collectionMetadata),
      "application/json",
    );
    console.log("Collection metadata uploaded:", collectionMetadataUrl);

    return await retryWithExponentialBackoff(async () => {
      console.log("Creating collection NFT...");

      // Add priority fee and compute unit limit instructions
      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 800000, // Increased compute units
      });

      const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 500000, // Higher priority fee
      });

      // Create collection NFT with priority fee instructions
      const { nft: collectionNft, response: collectionResponse } = await mx
        .nfts()
        .create({
          uri: collectionMetadataUrl,
          name: collectionMetadata.name,
          sellerFeeBasisPoints: 500,
          isCollection: true,
          updateAuthority: creatorKeypair,
          tokenStandard: 0, // Non-fungible standard
          collection: null,
          uses: null,
          programmableConfig: null,
          priorityFee: 500000,
          extraInstructions: [modifyComputeUnits, addPriorityFee],
        });

      console.log("Collection NFT created:", collectionNft.address.toBase58());
      console.log(
        "Collection creation signature:",
        collectionResponse?.signature,
      );

      // Setup guards with increased priority
      const guards: Partial<DefaultCandyGuardSettings> = {
        botTax: { lamports: sol(0.01), lastInstruction: true },
        mintLimit: { id: 1, limit: 1 },
      };

      // Add token payment guard if token config is provided
      if (tokenConfig) {
        guards.tokenPayment = {
          amount: token(tokenConfig.amount),
          mint: new PublicKey(tokenConfig.mint),
          destinationAta: creatorKeypair.publicKey,
        };
      } else {
        guards.solPayment = {
          amount: sol(0.1),
          destination: creatorKeypair.publicKey,
        };
      }

      console.log("Creating Candy Machine with priority fees...");
      const { candyMachine, response: candyMachineResponse } = await mx
        .candyMachines()
        .create({
          itemsAvailable: toBigNumber(avatarIds.length),
          sellerFeeBasisPoints: 500,
          collection: {
            address: collectionNft.address,
            updateAuthority: creatorKeypair,
          },
          guards,
          tokenStandard: 0,
          priorityFee: 500000,
          extraInstructions: [modifyComputeUnits, addPriorityFee],
        });

      console.log("Candy Machine created:", candyMachine.address.toBase58());
      console.log(
        "Candy Machine creation signature:",
        candyMachineResponse?.signature,
      );

      // Update MongoDB with proper error handling
      try {
        const candyMachinesCollection =
          await db.operations.getCollection("candyMachines");
        await candyMachinesCollection.insertOne({
          address: candyMachine.address.toBase58(),
          avatarIds,
          collectionAddress: collectionNft.address.toBase58(),
          createdAt: new Date(),
          status: "active",
        });
      } catch (dbError) {
        console.error("Failed to save candy machine to database:", dbError);
        throw dbError;
      }

      return {
        candyMachineAddress: candyMachine.address.toBase58(),
        collectionAddress: collectionNft.address.toBase58(),
      };
    });
  } catch (error) {
    console.error("Error in createCandyMachine:", error);
    throw error;
  }
}

function keypairIdentity(keypair: Keypair) {
  return (metaplex: any) => {
    metaplex.use(metaplex.identity(keypair));
    return metaplex;
  };
}

function toBigNumber(value: number): any {
  // Replace with actual toBigNumber implementation if needed.  This is a placeholder.
  return value;
}
