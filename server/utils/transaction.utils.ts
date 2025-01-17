import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { 
  createComputeBudgetInstructions,
  validateAndCleanInstruction,
  validateBlockHeight,
  getFreshBlockhash,
  BlockhashWithHeight,
  confirmTransactionWithBlockHeight
} from "./solana.utils";

const MAX_RETRIES = 3;
const MAX_TRANSACTION_SIZE = 1232; // Conservative limit in bytes
const MAX_INSTRUCTIONS_PER_TX = 3; // Conservative limit per transaction

export async function createTransactionWithInstructions(
  instructions: TransactionInstruction[],
  feePayer: PublicKey,
  recentBlockhash: string,
  lastValidBlockHeight: number,
  connection: Connection,
  includeFeeInstructions: boolean = true
): Promise<Transaction> {
  if (!connection) {
    throw new Error('Connection object is required for transaction creation');
  }

  // Validate block height is still valid
  const isValidBlockHeight = await validateBlockHeight(connection, lastValidBlockHeight);
  if (!isValidBlockHeight) {
    const { blockhash, lastValidBlockHeight: newHeight } = await getFreshBlockhash(connection);
    recentBlockhash = blockhash;
    lastValidBlockHeight = newHeight;
  }

  const tx = new Transaction();
  tx.feePayer = feePayer;
  tx.recentBlockhash = recentBlockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  if (includeFeeInstructions) {
    const [computeUnitLimitIx, computeUnitPriceIx] = createComputeBudgetInstructions(800000, 500000);
    tx.add(computeUnitLimitIx, computeUnitPriceIx);
  }

  // Add validated instructions
  const validInstructions = instructions
    .map(ix => validateAndCleanInstruction(ix))
    .filter((ix): ix is TransactionInstruction => ix !== null);

  // Add validated instructions to transaction
  validInstructions.forEach(ix => tx.add(ix));

  // Verify transaction size
  const rawTx = tx.serialize({ verifySignatures: false });
  if (rawTx.length > MAX_TRANSACTION_SIZE) {
    throw new Error(`Transaction too large: ${rawTx.length} bytes (max: ${MAX_TRANSACTION_SIZE})`);
  }

  return tx;
}

export async function splitInstructionsIntoTransactions(
  instructions: TransactionInstruction[],
  feePayer: PublicKey,
  recentBlockhash: string,
  lastValidBlockHeight: number,
  connection: Connection
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];
  let currentInstructions: TransactionInstruction[] = [];

  // Helper function to create and validate transaction
  const createAndValidateTransaction = async (instructions: TransactionInstruction[]): Promise<Transaction> => {
    try {
      return await createTransactionWithInstructions(
        instructions,
        feePayer,
        recentBlockhash,
        lastValidBlockHeight,
        connection
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('Block height expired')) {
        // Get fresh blockhash if block height expired
        const { blockhash, lastValidBlockHeight: newLastValidBlockHeight } = 
          await getFreshBlockhash(connection);
        return createTransactionWithInstructions(
          instructions,
          feePayer,
          blockhash,
          newLastValidBlockHeight,
          connection
        );
      }
      throw error;
    }
  };

  for (const ix of instructions) {
    if (!ix || !ix.programId || !Array.isArray(ix.keys)) continue;

    currentInstructions.push(ix);

    if (currentInstructions.length >= MAX_INSTRUCTIONS_PER_TX) {
      try {
        const tx = await createAndValidateTransaction(currentInstructions);
        transactions.push(tx);
        currentInstructions = [];
      } catch (error) {
        console.error('Failed to create transaction:', error);
        // If creation fails, try with single instructions
        for (const singleIx of currentInstructions) {
          const tx = await createAndValidateTransaction([singleIx]);
          transactions.push(tx);
        }
        currentInstructions = [];
      }
    }
  }

  // Handle remaining instructions
  if (currentInstructions.length > 0) {
    try {
      const tx = await createAndValidateTransaction(currentInstructions);
      transactions.push(tx);
    } catch (error) {
      console.error('Failed to create transaction with remaining instructions:', error);
      // Try with single instructions
      for (const singleIx of currentInstructions) {
        const tx = await createAndValidateTransaction([singleIx]);
        transactions.push(tx);
      }
    }
  }

  return transactions;
}