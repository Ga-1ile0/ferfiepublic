// tokens.ts
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { ethers } from 'ethers';
import axios from 'axios';

// 1) set up a public client pointed at Base
const client = createPublicClient({
  chain: base,
  transport: http(),
});

// 2) minimal ERC-20 ABI for balanceOf + decimals
const erc20Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
];


// Minimal Multicall3 ABI (just the aggregate function)
const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'target', type: 'address' },
          { name: 'callData', type: 'bytes' },
        ],
        name: 'calls',
        type: 'tuple[]',
      },
    ],
    name: 'aggregate',
    outputs: [
      { name: 'blockNumber', type: 'uint256' },
      { name: 'returnData', type: 'bytes[]' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

export const availableTokens = [
  {
    id: 29743,
    contract: '0x532f27101965dd16442e59d40670faf5ebb142e4',
    name: 'Brett',
    symbol: 'BRETT',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/35529/standard/1000050750.png?1709031995',
  },
  {
    id: 27750,
    contract: '0xac1bd2486aaf3b5c0fc3fd868558b082a531b2b4',
    name: 'Toshi',
    symbol: 'TOSHI',
    decimals: 18,
    image:
      'https://assets.coingecko.com/coins/images/31126/standard/Toshi_Logo_-_Circular.png?1721677476',
  },
  {
    id: 29309,
    contract: '0x0d97f261b1e88845184f678e2d1e7a98d9fd38de',
    name: 'Base God',
    symbol: 'TYBG',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/34563/standard/tybg.png?1705400778',
  },
  {
    id: 34285,
    contract: '0x1bc0c42215582d5a085795f4badbac3ff36d1bcb',
    name: 'tokenbot',
    symbol: 'CLANKER',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/51440/standard/CLANKER.png?1731232869',
  },
  // STABLECOINS
  {
    id: 3408,
    contract: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
    image: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694',
  },
  {
    id: 8690,
    contract: '0x043eb4b75d0805c43d7c834902e335621983cf03',
    name: 'CADC',
    symbol: 'CADC',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/14149/standard/cadc_2.png?1696513868',
  },
  {
    id: 20641,
    contract: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    name: 'EURC',
    symbol: 'EURC',
    decimals: 6,
    image: 'https://assets.coingecko.com/coins/images/26045/standard/euro.png?1696525125',
  },
  {
    id: 2,
    contract: '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4',
    name: 'BRZ',
    symbol: 'BRZ',
    decimals: 18,
    image:
      'https://assets.coingecko.com/coins/images/8472/standard/MicrosoftTeams-image_%286%29.png',
  },
  {
    id: 2,
    contract: '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22',
    name: 'IDRX',
    symbol: 'IDRX',
    decimals: 2,
    image:
      'https://assets.coingecko.com/coins/images/34883/standard/IDRX_BLUE_COIN_200x200.png?1734983273',
  },
  {
    id: 2,
    contract: '0x0000000000000000000000000000000000000000',
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628',
  },
  {
    id: 2,
    contract: '0x4200000000000000000000000000000000000006',
    name: 'WETH',
    symbol: 'WETH',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/2518/standard/weth.png?1696503332',
  },
  {
    id:1,
    contract: '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196',
    name: 'Chainlink',
    symbol: 'LINK',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/877/standard/chainlink-new-logo.png?1696502009',
  },{
    id:1,
    contract: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b',
    name: 'Virtuals',
    symbol: 'VIRTUAL',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/34057/standard/LOGOMARK.png?1708356054',
  },{
    id:1,
    contract: '0x50da645f148798f68ef2d7db7c1cb22a6819bb2c',
    name: 'SPX6900',
    symbol: 'SPX6900',
    decimals: 8,
    image: 'https://assets.coingecko.com/coins/images/31401/standard/centeredcoin_%281%29.png?1737048493',
  },{
    id:1,
    contract: '0x940181a94a35a4569e4529a3cdfb74e38fd98631',
    name: 'Aerodrome',
    symbol: 'AERO',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/31745/standard/token.png?1696530564',
  },{
    id:1,
    contract: '0x09be1692ca16e06f536f0038ff11d1da8524adb1',
    name: 'Telcoin',
    symbol: 'TEL',
    decimals: 2,
    image: 'https://assets.coingecko.com/coins/images/1899/standard/tel.png?1696502892',
  },{
    id:1,
    contract: '0x2da56acb9ea78330f947bd57c54119debda7af71',
    name: 'Mog Coin',
    symbol: 'MOG',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/31059/standard/MOG_LOGO_200x200.png?1696529893',
  },{
    id:1,
    contract: '0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825',
    name: 'aixbt',
    symbol: 'AIXBT',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/51784/standard/3.png?1731981138',
  },{
    id:1,
    contract: '0x7d49a065d17d6d4a55dc13649901fdbb98b2afba',
    name: 'Sushi',
    symbol: 'SUSHI',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/12271/standard/512x512_Logo_no_chop.png?1696512101',
  },{
    id:1,
    contract: '0x4ed4e862860bed51a9570b96d89af5e1b0efefed',
    name: 'Degen',
    symbol: 'DEGEN',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/34515/standard/android-chrome-512x512.png?1706198225',
  },{
    id:1,
    contract: '0x768be13e1680b5ebe0024c42c896e3db59ec0149',
    name: 'Ski Mask Dog',
    symbol: 'SKI',
    decimals: 9,
    image: 'https://assets.coingecko.com/coins/images/37195/standard/32992128-F52F-4346-84CA-8E0C48F43606.jpeg?1713676521',
  },{
    id:1,
    contract: '0x6921b130d297cc43754afba22e5eac0fbf8db75b',
    name: 'doginme',
    symbol: 'DOGINME',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/35123/standard/doginme-logo1-transparent200.png?1710856784',
  },{
    id:1,
    contract: '0xb1a03eda10342529bbf8eb700a06c60441fef25d',
    name: 'Mr. Miggles',
    symbol: 'MIGGLES',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/39251/standard/New_LOGO.png?1734294728',
  },{
    id:1,
    contract: '0x2f6c17fa9f9bc3600346ab4e48c0701e1d5962ae',
    name: 'Based Fartcoin',
    symbol: 'FARTCOIN',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/53113/standard/farrtcoin_logo.png?1735241861',
  },{
    id:1,
    contract: '0x52b492a33e447cdb854c7fc19f1e57e8bfa1777d',
    name: 'Based Pepe',
    symbol: 'PEPE',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/39763/standard/based_pepe_transparent.png?1724010222',
  },{
    id:1,
    contract: '0x1111111111166b7fe7bd91427724b487980afc69',
    name: 'Zora',
    symbol: 'ZORA',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/54693/standard/zora.jpg?1741094751',
  },
  {
    id:1,
    contract: '0xbc45647ea894030a4e9801ec03479739fa2485f0',
    name: 'Basenji',
    symbol: 'BENJI',
    decimals: 18,
    image: 'https://assets.coingecko.com/coins/images/36416/standard/ben200x200.jpg?1711420807',
  },
];

export async function getEthPriceUsd() {
  // Return cached value if it's less than 2 minutes old
  const now = Date.now();
  if (ethPriceCache.value !== null && (now - ethPriceCache.timestamp) < (2 * 60 * 1000)) {
    return ethPriceCache.value;
  }

  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'ethereum',
        vs_currencies: 'usd',
      },
    });

    const price = res.data?.ethereum?.usd;
    if (price) {
      // Update cache
      ethPriceCache.value = price;
      ethPriceCache.timestamp = now;
      return price;
    }

    console.error('Unexpected response format from CoinGecko:', res.data);
    return ethPriceCache.value || 0; // Return cached value if available, otherwise 0
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    return ethPriceCache.value || 0; // Return cached value if available, otherwise 0
  }
}
// Cache interfaces
interface CacheEntry {
  value: number;
  timestamp: number;
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Cache stores with timestamps
const stableRateCache: Record<string, CacheEntry> = {};
const ethRateCache: Record<string, CacheEntry> = {};
const ethPriceCache: { value: number | null; timestamp: number } = { value: null, timestamp: 0 };
const coingeckoCache: Record<string, { value: any; timestamp: number }> = {};

// Helper function to check if cache is valid
const isCacheValid = (entry: CacheEntry | undefined): boolean => {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
};

async function fetchWithCoingeckoCache<T>(url: string, cacheKey: string): Promise<T | null> {
  // Check cache first
  const cached = coingeckoCache[cacheKey];
  if (cached && (Date.now() - cached.timestamp) < (2 * 60 * 1000)) {
    return cached.value;
  }

  try {
    const response = await axios.get<T>(url);
    // Update cache
    coingeckoCache[cacheKey] = {
      value: response.data,
      timestamp: Date.now()
    };
    return response.data;
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    return cached?.value || null; // Return cached value if available, otherwise null
  }
}

export async function getEthStableRate(address: string): Promise<number> {
  // Return cached rate if valid
  const cached = ethRateCache[address];
  if (cached && isCacheValid(cached)) {
    return cached.value;
  }

  const fromTokenApiUrl = `https://api.dexscreener.com/latest/dex/tokens/${address}`;

  try {
    // Fetch ETH price from CoinGecko and token price from DexScreener in parallel
    const [ethPriceData, fromResponse] = await Promise.all([
      fetchWithCoingeckoCache<{ ethereum?: { usd: number } }>(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        'eth_usd_price'
      ),
      axios.get(fromTokenApiUrl),
    ]);

    const fromPrice = parseFloat(fromResponse.data?.pairs?.[0]?.priceUsd || '0');

    if (!fromPrice) {
      console.error('Invalid price data from DexScreener');
      return cached?.value || 0; // Return cached value if available, otherwise 0
    }

    const ethUsdPrice = ethPriceData?.ethereum?.usd;
    if (!ethUsdPrice) {
      console.error('Invalid ETH price from CoinGecko');
      return cached?.value || 0; // Return cached value if available, otherwise 0
    }

    // Calculate rate: (1 ETH in USD) / (1 token in USD) = ETH per token
    const rate = ethUsdPrice / fromPrice;

    // Update cache
    ethRateCache[address] = {
      value: rate,
      timestamp: Date.now(),
    };

    return rate;
  } catch (error) {
    console.error('Error in getEthStableRate:', error);
    return cached?.value || 0; // Return cached value if available, otherwise 0
  }
}

export async function getStableEthRate(address: string): Promise<number> {
  // Return cached rate if valid
  const cached = stableRateCache[address];
  if (cached && isCacheValid(cached)) {
    return cached.value;
  }

  const fromTokenApiUrl = `https://api.dexscreener.com/latest/dex/tokens/${address}`;

  try {
    // Fetch ETH price from CoinGecko and token price from DexScreener in parallel
    const [ethPriceData, fromResponse] = await Promise.all([
      fetchWithCoingeckoCache<{ ethereum?: { usd: number } }>(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        'eth_usd_price'
      ),
      fetch(fromTokenApiUrl).then(res => res.json())
    ]);

    const fromPrice = parseFloat(fromResponse.pairs?.[0]?.priceUsd || '0');

    if (!fromPrice) {
      console.error('Invalid price data from DexScreener');
      return cached?.value || 0; // Return cached value if available, otherwise 0
    }

    const ethUsdPrice = ethPriceData?.ethereum?.usd;
    if (!ethUsdPrice) {
      console.error('Invalid ETH price from CoinGecko');
      return cached?.value || 0; // Return cached value if available, otherwise 0
    }

    const rate = fromPrice / ethUsdPrice;

    // Update cache
    stableRateCache[address] = {
      value: rate,
      timestamp: Date.now()
    };

    return rate;
  } catch (error) {
    console.error('Error in getStableEthRate:', error);
    return cached?.value || 0; // Return cached value if available, otherwise 0
  }
}

export async function getExchangeRate(fromContract: string, toContract: string): Promise<number> {
  // Inside the getExchangeRate function:

  const fromToken = availableTokens.find(
    t => t.contract.toLowerCase() === fromContract.toLowerCase()
  );
  const toToken = availableTokens.find(t => t.contract.toLowerCase() === toContract.toLowerCase());

  if (!fromToken || !toToken) {
    throw new Error(`Unknown token contract.`);
  }

  const fromTokenApiUrl = `https://api.dexscreener.com/latest/dex/tokens/${fromToken.contract}`;
  const toTokenApiUrl = `https://api.dexscreener.com/latest/dex/tokens/${toToken.contract}`;

  try {
    const fromResponse = await fetch(fromTokenApiUrl);
    const fromData = await fromResponse.json();
    const fromPrice = parseFloat(fromData.pairs[0].priceUsd); // Extract USD price

    const toResponse = await fetch(toTokenApiUrl);
    const toData = await toResponse.json();
    const toPrice = parseFloat(toData.pairs[0].priceUsd); // Extract USD price

    // Calculate the exchange rate (how many toTokens per fromToken)
    const rate = fromPrice / toPrice;

    return rate;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    // Return a default/fallback rate or re-throw
    return 0; // Default 0 if can't get rate
  }
}

export async function chartData(
  fromContract: string,
  toContract: string
): Promise<{ time: string; price: number }[]> {
  try {
    // First try to get exchange rate history from the database
    const { getExchangeRateHistory } = await import('@/server/tokenRates');
    const historyData = await getExchangeRateHistory(fromContract, toContract);

    // If we have history data from the database, use it
    if (historyData && historyData.length > 0) {
      return historyData.map(item => ({
        time: item.time,
        price: item.price,
      }));
    }

    // Return zero data when there's no database data
    return [];
  } catch (error) {
    console.error('Error generating chart data:', error);
    // Return empty data in case of error
    return [];
  }
}

// Updated to ethers v6 syntax
const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);

// ERC-20 ABI for balanceOf
const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];

// --- Utility Functions ---

/**
 * Gets the USD price of a token using Dexscreener API.
 * @param tokenContract The contract address of the token.
 * @returns The USD price of the token or null if fetching fails.
 */
export async function getTokenPriceUSD(tokenContract: string): Promise<number | null> {
  const token = availableTokens.find(t => t.contract.toLowerCase() === tokenContract.toLowerCase());

  if (!token) {
    console.warn(`Token contract not found in availableTokens: ${tokenContract}`);
    return null;
  }

  // Use the token's contract address directly in the API call
  const apiUrl = `https://api.dexscreener.com/latest/dex/tokens/${token.contract}`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error(`Dexscreener API returned status: ${response.status} for ${token.symbol}`);
      return null;
    }
    const data = await response.json();

    // Find a pair that includes the token and has a USD price
    // Dexscreener might list multiple pairs, find one with priceUsd
    // Also check if pairs array exists and is not empty
    const pair = data.pairs?.find((p: any) => p.priceUsd !== undefined && p.priceUsd !== null);

    if (!pair) {
      console.warn(
        `No USD price pair found on Dexscreener for token: ${token.symbol} (${token.contract})`
      );
      return null;
    }

    const price = parseFloat(pair.priceUsd);

    if (isNaN(price)) {
      console.error(`Could not parse USD price from Dexscreener for ${token.symbol}.`);
      return null;
    }

    return price;
  } catch (error) {
    console.error(`Error fetching token price for ${token.symbol} (${token.contract}):`, error);
    return null;
  }
}

/**
 * Get token balance for a specific address
 * @param tokenContract The contract address of the token
 * @param userAddress The user's wallet address
 * @returns The token balance as a number or null if it fails
 */
export async function getTokenBalance(
  tokenContract: string,
  userAddress: string
): Promise<number | null> {
  try {
    // Find token in available tokens list
    const token = availableTokens.find(
      t => t.contract.toLowerCase() === tokenContract.toLowerCase()
    );

    if (!token) {
      console.warn(`Token with contract ${tokenContract} not found in available tokens`);
      return null;
    }
    const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
    if (tokenContract === ETH_ADDRESS) {
      const balance = await client.getBalance({ address: userAddress as `0x${string}` });
      return Number(balance) / 10 ** 18;
    }
    // Use viem client for better compatibility and performance
    const balance = await client.readContract({
      address: tokenContract as `0x${string}`,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    });

    // Convert balance from wei to tokens using the token's decimals
    return Number(balance) / 10 ** token.decimals;
  } catch (error) {
    console.error(`Error fetching balance for token contract ${tokenContract}:`, error);
    return null;
  }
}

/**
 * Multicall3 implementation to fetch balances of multiple tokens for a user.
 * @param userAddress The address of the user for whom to fetch balances.
 * @returns An array of token balances, with the index corresponding to the index in `availableTokens`.
 */
/**
 * Multicall3 implementation to fetch balances of multiple tokens for a user, including native ETH.
 * @param userAddress The address of the user for whom to fetch balances.
 * @returns An array of token balances (number), with the index corresponding to the index in `availableTokens`.
 */
export async function getMultiTokenBalances(userAddress: string): Promise<number[]> {
  try {
    console.log('Fetching multi-token balances for user:', userAddress);
    const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

    // Separate Native ETH from ERC-20 tokens
    const erc20Tokens = availableTokens.filter(
      token => token.contract.toLowerCase() !== ETH_ADDRESS
    );
    const ethToken = availableTokens.find(token => token.contract.toLowerCase() === ETH_ADDRESS);

    // Prepare calls for Multicall (only for ERC-20 tokens)
    const erc20Calls = erc20Tokens.map(token => ({
      address: token.contract as `0x${string}`,
      abi: erc20Abi, // Use the standard erc20Abi for balanceOf
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    }));

    // Execute Multicall for ERC-20 tokens
    let multicallResults: { status: 'success' | 'failure'; result: any; error?: Error }[] = [];
    if (erc20Calls.length > 0) {
      multicallResults = (await client.multicall({
        contracts: erc20Calls as any,
      })) as { status: 'success' | 'failure'; result: any; error?: Error }[];
      console.log('Multicall results:', multicallResults);
    }

    // Fetch Native ETH balance separately if the token is in the list
    let ethBalance: number = 0;
    if (ethToken) {
      try {
        const rawEthBalance = await client.getBalance({
          address: userAddress as `0x${string}`,
        });
        // Convert balance from wei (BigInt) to ETH (number)
        ethBalance = Number(rawEthBalance) / 10 ** ethToken.decimals;
        console.log(`Fetched Native ETH balance: ${ethBalance}`);
      } catch (error) {
        console.error(`Error fetching Native ETH balance for ${userAddress}:`, error);
        ethBalance = 0; // Set to 0 if fetching fails
      }
    }

    // Combine results into a single array maintaining the original order of availableTokens
    const combinedBalances: number[] = [];
    let erc20ResultIndex = 0;

    availableTokens.forEach(token => {
      if (token.contract.toLowerCase() === ETH_ADDRESS) {
        // This is the Native ETH token, add the fetched ETH balance
        combinedBalances.push(ethBalance);
      } else {
        // This is an ERC-20 token, get its result from multicallResults
        // We need to make sure we match the result to the correct token.
        // Since erc20Calls matches the order of erc20Tokens, we can use the index.
        // We iterate through the original availableTokens list. If it's an ERC20,
        // we find its corresponding result from the multicall array which is
        // ordered according to erc20Tokens.
        const erc20TokenIndex = erc20Tokens.findIndex(
          t => t.contract.toLowerCase() === token.contract.toLowerCase()
        );

        if (erc20TokenIndex !== -1) {
          const result = multicallResults[erc20TokenIndex];
          if (result && result.status === 'success') {
            // Convert balance from token smallest unit (BigInt) to token value (number)
            combinedBalances.push(Number(result.result) / 10 ** token.decimals);
          } else {
            console.error(
              `Failed to get balance for ERC-20 token ${token.symbol} (${token.contract}):`,
              result?.error || 'Unknown error'
            );
            combinedBalances.push(0); // Add 0 for failed fetches
          }
        } else {
          // This case should ideally not happen if logic is correct,
          // but include a fallback.
          console.error(
            `Logic error: ERC-20 token ${token.symbol} not found in erc20Tokens array.`
          );
          combinedBalances.push(0);
        }
      }
    });

    console.log('All balances (in order of availableTokens):', combinedBalances);
    return combinedBalances;
  } catch (error) {
    console.error('Error in getMultiTokenBalances:', error);
    // In case of a catastrophic error, return an array of 0s for all tokens
    return availableTokens.map(() => 0);
  }
}

/**
 * Get an exchange rate between two tokens using real market data
 * This uses the DexScreener API to get real market data
 */
export async function getRealExchangeRate(
  fromContract: string,
  toContract: string
): Promise<number> {
  try {
    // Get USD prices for both tokens
    const fromPrice = await getTokenPriceUSD(fromContract);
    const toPrice = await getTokenPriceUSD(toContract);

    // Calculate exchange rate (how many toTokens you get for 1 fromToken)
    if (fromPrice && toPrice && toPrice > 0) {
      return fromPrice / toPrice;
    }

    // Fallback to the mock exchange rate if we can't get real data
    return getExchangeRate(fromContract, toContract);
  } catch (error) {
    console.error('Error fetching real exchange rate:', error);
    // Fallback to the mock exchange rate
    return getExchangeRate(fromContract, toContract);
  }
}
