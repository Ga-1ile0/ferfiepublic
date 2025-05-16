/**
 * Reservoir API utilities for fetching NFT data
 */

/**
 * Fetches data from the Reservoir API
 * @param url The API endpoint URL
 * @param params Query parameters
 * @param data Additional request options
 * @returns The API response
 */
export const fetcher = async (
  url: string,
  params: Record<string, any> = {},
  data: RequestInit = {}
) => {
  const headers = new Headers();

  // Add API key if available
  if (process.env.NEXT_PUBLIC_RESERVOIR_API_KEY) {
    headers.set('x-api-key', process.env.NEXT_PUBLIC_RESERVOIR_API_KEY);
  }

  // Add Base chain specific headers
  headers.set('accept', '*/*');
  headers.set('x-marketplace', 'pfp-swap');

  // Add normalize royalties parameter if not explicitly set
  if (params.normalizeRoyalties === undefined) {
    params.normalizeRoyalties = true;
  }

  // Add params to URL
  const path = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      path.searchParams.set(key, value.toString());
    }
  });

  const response = await fetch(path.href, {
    headers,
    ...data,
  });

  if (!response.ok) {
    throw new Error(`Reservoir API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return { data: json, response };
};

/**
 * Optimizes an image URL for better performance
 * @param imageUrl The original image URL
 * @param width The desired width
 * @returns The optimized image URL
 */
export const optimizeImage = (imageUrl?: string, width = 250): string => {
  if (!imageUrl) return '/placeholder.svg';

  // Handle IPFS URLs
  if (imageUrl.startsWith('ipfs://')) {
    const ipfsHash = imageUrl.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${ipfsHash}`;
  }

  // Return the original URL if it's already optimized or a data URL
  if (imageUrl.startsWith('data:') || imageUrl.includes('?w=') || imageUrl.includes('&w=')) {
    return imageUrl;
  }

  // Add width parameter to URL
  try {
    const url = new URL(imageUrl);
    url.searchParams.set('w', width.toString());
    return url.toString();
  } catch (e) {
    // If URL parsing fails, return the original URL
    return imageUrl;
  }
};

/**
 * Truncates an address for display
 * @param address The address to truncate
 * @returns The truncated address
 */
export const truncateAddress = (address: string): string => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};
