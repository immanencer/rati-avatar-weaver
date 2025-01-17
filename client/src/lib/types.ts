import { z } from "zod";

// Window type augmentation for ArConnect
declare global {
  interface Window {
    arweaveWallet: {
      connect: (permissions: string[]) => Promise<void>;
      disconnect: () => Promise<void>;
      getActiveAddress: () => Promise<string>;
      sign: (transaction: any) => Promise<any>;
    };
  }
}

// Rarity tiers and colors
export enum RarityTier {
  Common = "Common",
  Uncommon = "Uncommon",
  Rare = "Rare",
  Epic = "Epic",
  Legendary = "Legendary"
}

export interface WalletInfo {
  arBalance?: number;
  address?: string;
  isCreator?: boolean;
}

export interface Avatar {
  _id: string;
  name: string;
  emoji: string;
  personality: string;
  description: string;
  imageUrl: string | null;
  channelId?: string;
  createdAt: string;
  updatedAt: string;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'failed';
  uploadError?: string | null;
  arweaveUrl?: string | null;
  arweaveMetadataUrl?: string | null;
  arweaveTransactionId?: string | null;
  metaplexMetadataUrl?: string | null;
  narrativeHistory?: Array<{
    timestamp: number;
    content: string;
    guildName?: string;
  }>;
  ownerAddress?: string;
}

export interface AvatarFormData {
  name: string;
  emoji: string;
  personality: string;
  description: string;
  imageUrl?: string;
}

export const avatarSchema = z.object({
  name: z.string().min(1, "Name is required"),
  emoji: z.string().min(1, "Emoji is required"),
  personality: z.string().min(1, "Personality is required"),
  description: z.string().min(1, "Description is required"),
  imageUrl: z.string().nullable(),
});

export type AvatarInput = z.infer<typeof avatarSchema>;

export interface ArweaveMetadata {
  name: string;
  emoji: string;
  personality: string;
  description: string;
  arweaveImageUrl: string;
  timestamp: string;
}


// Metaplex NFT Standard Metadata
export interface MetaplexMetadata {
  name: string;
  symbol: string;
  description: string;
  seller_fee_basis_points: number;
  image: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
    creators: Array<{
      address: string;
      share: number;
    }>;
  };
  collection?: {
    name: string;
    family: string;
  };
}

export const metaplexMetadataSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  description: z.string(),
  seller_fee_basis_points: z.number(),
  image: z.string(),
  external_url: z.string().optional(),
  attributes: z.array(z.object({
    trait_type: z.string(),
    value: z.union([z.string(), z.number()]),
  })),
  properties: z.object({
    files: z.array(z.object({
      uri: z.string(),
      type: z.string(),
    })),
    category: z.string(),
    creators: z.array(z.object({
      address: z.string(),
      share: z.number(),
    })),
  }),
  collection: z.object({
    name: z.string(),
    family: z.string(),
  }).optional(),
});

// Rarity visualization constants
export const RARITY_COLORS = {
  [RarityTier.Common]: "rgb(169, 169, 169)", // Gray
  [RarityTier.Uncommon]: "rgb(75, 192, 192)", // Teal
  [RarityTier.Rare]: "rgb(54, 162, 235)", // Blue
  [RarityTier.Epic]: "rgb(153, 102, 255)", // Purple
  [RarityTier.Legendary]: "rgb(255, 159, 64)", // Orange
} as const;

export const RARITY_THRESHOLDS = {
  [RarityTier.Common]: 0,
  [RarityTier.Uncommon]: 25,
  [RarityTier.Rare]: 50,
  [RarityTier.Epic]: 75,
  [RarityTier.Legendary]: 90,
} as const;