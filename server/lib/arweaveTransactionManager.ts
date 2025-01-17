import { arweave } from "../utils/arweave";
import { JWKInterface } from "arweave/node/lib/wallet";
import fs from "fs";
import path from "path";

/**
 * Interface for Arweave upload results
 */
interface ArweaveUploadResult {
  id: string;
  url: string;
}

/**
 * Metadata interface for Arweave transactions
 */
interface ArweaveTransactionMetadata {
  originalImageUrl?: string;
  transactionType: "avatar-image" | "avatar-metadata" | "metaplex-metadata";
  appName: string;
  contentType: string;
  timestamp: string;
}

/**
 * Manages Arweave blockchain interactions for the avatar platform
 * Handles uploading, verification, and duplicate detection of avatar assets
 */
export class ArweaveTransactionManager {
  public readonly arweave: typeof arweave;
  private wallet: JWKInterface | null = null;
  private readonly KEY_PATH = ".keys/arweave-key.json";

  constructor() {
    if (!arweave) {
      throw new Error("Arweave client not initialized");
    }
    this.arweave = arweave;
    this.initializeWallet();
  }

  /**
   * Initializes the wallet from environment, key file, or generates a new one
   */
  private async initializeWallet() {
    try {
      // First check environment variable
      const walletJson = process.env.ARWEAVE_KEY;
      if (walletJson) {
        try {
          this.wallet = JSON.parse(walletJson);
          const address = await this.getWalletAddress();
          console.log("Wallet initialized from environment with address:", address);
          return;
        } catch (parseError) {
          console.error("Error parsing ARWEAVE_KEY:", parseError);
          // Continue to try other methods
        }
      }

      // Check for key file
      if (fs.existsSync(this.KEY_PATH)) {
        try {
          const keyFileContent = fs.readFileSync(this.KEY_PATH, "utf8");
          this.wallet = JSON.parse(keyFileContent);
          const address = await this.getWalletAddress();
          console.log("Wallet initialized from key file with address:", address);
          return;
        } catch (fileError) {
          console.error("Error reading/parsing key file:", fileError);
          throw new Error("Failed to read existing wallet key file");
        }
      } else {
        throw new Error("No wallet key file found at " + this.KEY_PATH);
      }
    } catch (error) {
      console.error("Error initializing wallet:", error);
      throw error;
    }
  }

  /**
   * Gets the current wallet
   */
  getWallet(): JWKInterface | null {
    return this.wallet;
  }

  /**
   * Gets the wallet address
   */
  async getWalletAddress(): Promise<string | null> {
    if (!this.wallet) {
      return null;
    }
    try {
      return await this.arweave.wallets.jwkToAddress(this.wallet);
    } catch (error) {
      console.error("Error getting wallet address:", error);
      return null;
    }
  }

  /**
   * Gets the current wallet balance in AR
   */
  async getBalance(): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }
    const address = await this.getWalletAddress();
    if (!address) {
      throw new Error("Could not get wallet address");
    }

    try {
      const winstonBalance = await this.arweave.wallets.getBalance(address);
      return this.arweave.ar.winstonToAr(winstonBalance);
    } catch (error) {
      console.error("Error getting balance:", error);
      throw new Error("Failed to get wallet balance");
    }
  }

  /**
   * Checks if the wallet has sufficient balance for a transaction
   */
  private async checkSufficientBalance(dataSize: number): Promise<void> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }

    try {
      const address = await this.getWalletAddress();
      if (!address) {
        throw new Error("Could not get wallet address");
      }

      // Get current balance
      const winstonBalance = await this.arweave.wallets.getBalance(address);

      // Estimate transaction cost
      const price = await this.arweave.transactions.getPrice(dataSize);

      if (BigInt(winstonBalance) < BigInt(price)) {
        const bnBalance = this.arweave.ar.winstonToAr(winstonBalance);
        const bnRequired = this.arweave.ar.winstonToAr(price);
        throw new Error(
          `Insufficient funds for transaction. Required: ${bnRequired} AR, Available: ${bnBalance} AR`
        );
      }
    } catch (error) {
      console.error("Error checking balance:", error);
      throw error;
    }
  }

  /**
   * Uploads data to Arweave with metadata
   */
  async uploadTransaction(
    data: Buffer | string,
    metadata: ArweaveTransactionMetadata,
    rewardMultiplier: number = 1
  ): Promise<ArweaveUploadResult> {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }

    try {
      // Convert data to Buffer if it's a string
      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

      // Check balance before attempting upload
      await this.checkSufficientBalance(dataBuffer.length);

      // Create transaction
      const tx = await this.arweave.createTransaction({
        data: dataBuffer,
      }, this.wallet);

      // Adjust transaction reward (fee) based on rewardMultiplier
      tx.reward = (BigInt(tx.reward) * BigInt(rewardMultiplier)).toString();

      // Add metadata tags
      tx.addTag("Content-Type", metadata.contentType);
      tx.addTag("App-Name", metadata.appName);
      tx.addTag("Type", metadata.transactionType);
      tx.addTag("Timestamp", metadata.timestamp);

      if (metadata.originalImageUrl) {
        tx.addTag("Original-Image-Url", metadata.originalImageUrl);
      }

      // Sign transaction
      await this.arweave.transactions.sign(tx, this.wallet);

      // Verify transaction before uploading
      const verificationResult = await this.arweave.transactions.verify(tx);
      if (!verificationResult) {
        throw new Error("Transaction verification failed");
      }

      // Upload transaction
      console.log(`Starting upload for transaction ${tx.id}`);
      const uploader = await this.arweave.transactions.getUploader(tx);

      while (!uploader.isComplete) {
        await uploader.uploadChunk();
        console.log(`Uploaded ${uploader.pctComplete}% complete`);
      }

      // Verify upload completion
      let status = await this.arweave.transactions.getStatus(tx.id);
      let attempts = 0;
      while (status.status === 202 && attempts < 20) {
        console.log(`Transaction not confirmed; retry# ${attempts + 1}`);
        await new Promise((resolve) => setTimeout(resolve, 5000 * (attempts + 1)));
        attempts++;
        status = await this.arweave.transactions.getStatus(tx.id);
      }

      if (status.status !== 200) {
        throw new Error(`Upload failed with status ${status.status}`);
      }

      const arweaveUrl = `https://arweave.net/${tx.id}`;
      console.log(`Upload completed. URL: ${arweaveUrl}`);

      return {
        id: tx.id,
        url: arweaveUrl,
      };
    } catch (error) {
      console.error("Error during Arweave upload:", error);
      throw error;
    }
  }
}