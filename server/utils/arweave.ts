import Arweave from "arweave";

// Initialize Arweave without wallet
export const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https",
  timeout: 60000,
});

/**
 * Creates an unsigned Arweave transaction prepared for client-side signing
 */
export async function createArweaveTransaction(data: Buffer | string, contentType: string, tags: Record<string, string> = {}): Promise<any> {
  try {
    console.log("Creating Arweave transaction...");

    // Create transaction without wallet
    const tx = await arweave.createTransaction({ 
      data,
      last_tx: '',  // This is important for client-side signing
      reward: '0',  // Let ArConnect calculate the reward
    });

    if (!tx) {
      throw new Error("Failed to create transaction: Transaction object is null");
    }

    // Add metadata tags
    tx.addTag("Content-Type", contentType);
    tx.addTag("App-Name", "RATi-Avatar-Platform");
    tx.addTag("App-Version", "1.0.0");
    tx.addTag("Timestamp", new Date().toISOString());

    // Add custom tags
    Object.entries(tags).forEach(([key, value]) => {
      tx.addTag(key, value);
    });

    // Ensure the transaction is prepared for client-side signing
    tx.quantity = '0';  // Required for ArConnect
    tx.owner = '';      // Will be set by ArConnect during signing

    console.log("Transaction created:", tx.id);
    return tx;
  } catch (error) {
    console.error("Error during Arweave transaction creation:", error);
    throw error;
  }
}