import { ObjectId } from 'mongodb';

export interface Avatar {
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
  updatedAt?: Date; // Added to track last update time
}