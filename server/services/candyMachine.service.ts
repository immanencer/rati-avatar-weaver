import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCandyMachine } from '@metaplex-foundation/mpl-candy-machine';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { fromWeb3JsPublicKey, toWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

interface MintInstructionResult {
  setupInstructions: TransactionInstruction[];
  paymentInstructions: TransactionInstruction[];
  mintInstructions: TransactionInstruction[];
}

export async function getMintInstructions(
  connection: Connection,
  candyMachineAddress: string,
  walletAddress: string
): Promise<MintInstructionResult> {
  const setupInstructions: TransactionInstruction[] = [];
  const paymentInstructions: TransactionInstruction[] = [];
  const mintInstructions: TransactionInstruction[] = [];

  try {
    const userWallet = new PublicKey(walletAddress);
    console.log('Fetching candy machine:', candyMachineAddress);

    // Initialize UMI with required plugins
    const umi = createUmi(connection.rpcEndpoint)
      .use(mplCandyMachine())
      .use(mplTokenMetadata());

    // Convert Web3.js PublicKey to UMI PublicKey
    const candyMachinePublicKey = fromWeb3JsPublicKey(new PublicKey(candyMachineAddress));
    const userPublicKey = fromWeb3JsPublicKey(userWallet);

    // Fetch candy machine account with proper error handling
    try {
      const candyMachine = await umi.rpc.getAccount(candyMachinePublicKey);

      if (!candyMachine.exists) {
        throw new Error('Candy machine not found');
      }

      console.log('Found candy machine:', {
        address: candyMachineAddress,
        exists: candyMachine.exists,
      });

      // Get candy machine state
      const candyMachineState = await umi.programs.mplCandyMachine.accounts.get(candyMachinePublicKey);

      if (!candyMachineState) {
        throw new Error('Failed to parse candy machine state');
      }

      // Generate mint instructions
      const mintCtx = {
        candyMachine: candyMachinePublicKey,
        minter: userPublicKey,
      };

      const mintAccounts = await umi.programs.mplCandyMachine.accounts.mint.getAccounts(mintCtx);
      const mintIx = await umi.programs.mplCandyMachine.instructions.mint({
        ...mintCtx,
        ...mintAccounts,
      });

      // Convert UMI instructions to Web3.js format
      mintIx.forEach((ix) => {
        const web3Instruction = {
          programId: toWeb3JsPublicKey(ix.programId),
          keys: ix.keys.map((key) => ({
            pubkey: toWeb3JsPublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
          data: Buffer.from(ix.data),
        };
        mintInstructions.push(web3Instruction);
      });

      return {
        setupInstructions,
        paymentInstructions,
        mintInstructions,
      };

    } catch (error) {
      console.error('Error fetching candy machine:', error);
      throw new Error(`Failed to fetch candy machine: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('Error in getMintInstructions:', error);
    throw error;
  }
}