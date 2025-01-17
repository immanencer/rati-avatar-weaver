import { generateArweaveWallet } from "../server/utils/keyGenerator";

async function main() {
  try {
    await generateArweaveWallet();
    console.log("Arweave wallet generation completed successfully");
  } catch (error) {
    console.error("Failed to generate Arweave wallet:", error);
    process.exit(1);
  }
}

main();
