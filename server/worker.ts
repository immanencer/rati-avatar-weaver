import { db } from '@db';
import { arweave } from './utils/arweave';
import { Avatar } from './Avatar';

const AVATARS_COLLECTION = process.env.MONGODB_COLLECTION || "avatars";

async function checkTransactionStatus(txId: string): Promise<boolean> {
  try {
    const status = await arweave.transactions.getStatus(txId);
    return status.confirmed !== null && status.confirmed.number_of_confirmations > 2;
  } catch (error) {
    console.error(`Error checking status for transaction ${txId}:`, error);
    return false;
  }
}

async function processPendingUploads() {
  try {
    const database = await db.getDB();
    const collection = database.collection<Avatar>(AVATARS_COLLECTION);

    // Find all pending uploads
    const pendingAvatars = await collection.find({ 
      uploadStatus: 'uploading',
      ownerAddress: { $exists: true }
    }).toArray();

    for (const avatar of pendingAvatars) {
      try {
        // Check if the transactions are confirmed
        const [imageConfirmed, metadataConfirmed] = await Promise.all([
          avatar.arweaveUrl ? checkTransactionStatus(avatar.arweaveUrl.split('/').pop()!) : true,
          avatar.arweaveMetadataUrl ? checkTransactionStatus(avatar.arweaveMetadataUrl.split('/').pop()!) : false
        ]);

        if (imageConfirmed && metadataConfirmed) {
          await collection.updateOne(
            { _id: avatar._id },
            {
              $set: {
                uploadStatus: 'completed',
                uploadError: null
              }
            }
          );
          console.log(`Upload confirmed for avatar: ${avatar._id}`);
        }
      } catch (error) {
        console.error(`Error checking status for avatar ${avatar._id}:`, error);

        // Update avatar with error status if we've been checking for too long
        const hoursSinceUpdate = (Date.now() - (avatar.updatedAt ? avatar.updatedAt.getTime() : Date.now())) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 1) {
          await collection.updateOne(
            { _id: avatar._id },
            {
              $set: {
                uploadStatus: 'failed',
                uploadError: 'Transaction confirmation timeout'
              }
            }
          );
        }
      }
    }
  } catch (error) {
    console.error('Error in processPendingUploads:', error);
  }

  // Schedule next run
  setTimeout(processPendingUploads, 30000); // Check every 30 seconds
}

// Start processing uploads
console.log('Starting upload status checker...');
processPendingUploads().catch(console.error);