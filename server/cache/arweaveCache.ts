import fs from 'fs/promises';
import path from 'path';

interface ArweaveTransactionCache {
  [imageUrl: string]: {
    arweaveUrl: string;
    transactionId: string;
    timestamp: string;
  };
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'arweave-cache.json');

// Ensure cache directory exists
async function ensureCacheDirectory() {
  const dir = path.dirname(CACHE_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Initialize empty cache if it doesn't exist
async function initializeCache() {
  try {
    await ensureCacheDirectory();
    await fs.access(CACHE_FILE);
  } catch {
    await fs.writeFile(CACHE_FILE, JSON.stringify({}, null, 2));
  }
}

// Read cache from file
async function readCache(): Promise<ArweaveTransactionCache> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading cache:', error);
    return {};
  }
}

// Write cache to file
async function writeCache(cache: ArweaveTransactionCache) {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error('Error writing cache:', error);
  }
}

// Get cached transaction for an image URL
export async function getCachedTransaction(imageUrl: string): Promise<string | null> {
  await initializeCache();
  const cache = await readCache();
  const entry = cache[imageUrl];
  return entry ? entry.arweaveUrl : null;
}

// Add transaction to cache
export async function cacheTransaction(
  imageUrl: string,
  arweaveUrl: string,
  transactionId: string
) {
  await initializeCache();
  const cache = await readCache();
  cache[imageUrl] = {
    arweaveUrl,
    transactionId,
    timestamp: new Date().toISOString(),
  };
  await writeCache(cache);
}

// Clear expired cache entries (older than 7 days)
export async function clearExpiredCache() {
  const cache = await readCache();
  const now = new Date();
  const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));

  let hasChanges = false;
  for (const [url, entry] of Object.entries(cache)) {
    if (new Date(entry.timestamp) < sevenDaysAgo) {
      delete cache[url];
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await writeCache(cache);
  }
}

// Initialize cache on module load
initializeCache().catch(console.error);
