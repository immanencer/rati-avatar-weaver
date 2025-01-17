import Arweave from 'arweave';

// Initialize Arweave instance with increased timeout
export const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
  timeout: 60000,
});

export interface ServerWalletInfo {
  address: string;
  balance: string;
}

export async function getServerWalletInfo(): Promise<ServerWalletInfo> {
  const response = await fetch('/api/avatars/server-balance');
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch server wallet info');
  }
  return response.json();
}