/**
 * Bando API utilities for fetching and purchasing gift cards
 */

import axios from 'axios';
import { devLog } from './devlog';

// Country related interfaces
export interface Country {
  id: string;
  name: string;
  isoAlpha2: string;
  isoAlpha3: string;
  isCurrent: boolean;
  capital: string;
  fiatCurrency: string;
  region: string;
  subregion: string;
  languages: Record<string, string>;
  flagUrl: string;
  timezone: string;
  latitude: number;
  longitude: number;
  callingCode: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CountriesResponse {
  message: string;
  data: {
    count: number;
    results: Country[];
  };
}

// Base URL for Bando API
const BANDO_API_URL = 'https://api.bando.cool/api/v1';

// Quote response interface
export interface BandoQuoteResponse {
  error: string;
  message: string;
  data: {
    id: number;
    fiatCurrency: string;
    fiatAmount: string;
    digitalAsset: string;
    digitalAssetAmount: string;
    totalAmount: string;
    feeAmount: string;
    sku: string;
  };
}



// Define types for Bando API responses
export interface BandoQuote {
  id: string;
  fiatCurrency: string;
  fiatAmount: number;
  digitalAsset: string;
  digitalAssetAmount: string;
  sku: string;
  chainId: number;
  fee: number;
  transactionRequest: {
    to: string;
    data: string;
    value: string;
  };
  expiresAt: string;
}

// Base product variant type
export interface BandoProductVariant {
  id: string;
  fupId: string;
  brand: string;
  country: string;
  notes: string;
  sku: string;
  price: {
    fiatCurrency: string;
    fiatValue: string;
    stableCoinCurrency: string;
  };
  productType: string;
  referenceType: {
    name: string;
    valueType: string;
    regex: string;
  };
  requiredFields: Array<{
    name: string;
    valueType: string;
    regex: string;
  }>;
  shortNotes: string;
  subTypes: string[];
  supportedCountries: string[];
  imageUrl: string;
  evmServiceId?: number;
  svmServiceId?: number;
  sendCurrency?: string;
  sendPrice?: string;
}

// Brand product type (from API response)
export interface BandoBrandProduct {
  brandName: string;
  brandSlug: string;
  imageUrl: string;
  order: number;
  variants: BandoProductVariant[];
}

// Flattened product type for our UI
export interface BandoProduct {
  id: string;
  brandName: string;
  brandSlug: string;
  type: string;
  productSubType: string;
  sku: string;
  country: string;
  fiatPrice: number;
  fiatCurrency: string;
  imageUrl: string;
  referenceType: string;
  requiredFields: Array<{
    name: string;
    valueType: string;
    regex: string;
  }>;
  serviceIds: {
    evm: string;
    svm: string;
  };
}

export interface BandoTransaction {
  id: string;
  status: string;
  countryIso: string;
  productType: string;
  productSubType: string;
  sku: string;
  fiatUnitPrice: number;
  fiatCurrency: string;
  quantity: number;
  productMetadata: any;
  userWalletAddress: string;
  chainId: number;
  tokenUsed: string;
  tokenAmountPaid: string;
  createdAt: string;
  updatedAt: string;
  imageUrl: string;
  brandName: string;
  blockchainTransactionHash: string;
  reference: string;
}

export interface BandoCatalogResponse {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  products: BandoBrandProduct[];
}

export interface BandoTransactionResponse {
  id: string;
  status: string;
  price: {
    fiat: {
      currency: string;
      value: number;
    };
    token: {
      currency: string;
      value: string;
    };
  };
  product: {
    type: string;
    sku: string;
  };
  quantity: number;
  chainId: number;
  tokenUsed: string;
  tokenAmountPaid: string;
  imageUrl: string;
  createdAt: string;
  brandName: string;
  userWalletAddress: string;
  blockchainTransactionHash: string;
  reference: string;
}

// Cache for product catalog to avoid excessive API calls
const catalogCache: {
  data: BandoCatalogResponse | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Base Bando API client for making requests
 */
const bandoApiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BANDO_API_URL || 'https://api.bando.cool',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add request interceptor to include API key
bandoApiClient.interceptors.request.use((config) => {
  // Add API key if available
  if (process.env.NEXT_PUBLIC_BANDO_API_KEY) {
    config.headers['x-api-key'] = process.env.NEXT_PUBLIC_BANDO_API_KEY;
  }
  return config;
});

/**
 * Fetches gift card products from the Bando API
 * @param countryCode ISO country code (e.g., 'US')
 * @param productType Product type (e.g., 'GIFT_CARD')
 * @param page Page number for pagination
 * @param limit Number of items per page
 * @param useCache Whether to use cached data if available
 * @returns Catalog response with gift card products
 */
export async function fetchGiftCardProducts(
  countryCode: string = 'US',
  type: string = 'gift_card',
  page: number = 1,
  limit: number = 50,
  useCache: boolean = true
): Promise<BandoCatalogResponse> {
  // Check cache first if enabled
  if (useCache && catalogCache.data && (Date.now() - catalogCache.timestamp) < CACHE_TTL) {
    return catalogCache.data;
  }

  try {
    const response = await bandoApiClient.get('/api/v1/products/grouped/', {
      params: {
        country: countryCode,
        type,
        page,
        limit,
      },
    });

    // Update cache
    catalogCache.data = response.data;
    catalogCache.timestamp = Date.now();

    return response.data;
  } catch (error) {
    console.error('Error fetching gift card products:', error);
    throw error;
  }
}

/**
 * Gets a quote for purchasing a gift card
 * @param fiatCurrency Fiat currency code (e.g., 'USD')
 * @param digitalAsset Digital asset contract address
 * @param sku Product SKU
 * @param chainId Blockchain chain ID (default: 8453 for Base)
 * @returns Quote response
 */
export async function getGiftCardQuote(
  fiatCurrency: string,
  digitalAsset: string,
  sku: string,
  chainId: number = 8453
): Promise<BandoQuoteResponse> {
  try {
    const response = await axios.post(
      `${BANDO_API_URL}/quotes/`,
      {
        fiatCurrency,
        digitalAsset,
        sku,
        chainId,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    devLog.error('Error fetching gift card quote:', error);
    throw new Error('Failed to fetch gift card quote');
  }
}

/**
 * Creates a transaction to purchase a gift card
 * @param sku Product SKU
 * @param quantity Quantity to purchase
 * @param chainId Blockchain chain ID
 * @param token Token to use for payment
 * @param walletAddress User's wallet address
 * @param quoteId Quote ID from getGiftCardQuote
 * @returns Transaction response
 */
export async function createGiftCardTransaction(
  sku: string,
  quantity: number,
  chainId: number,
  token: string,
  walletAddress: string,
  quoteId: string
): Promise<BandoTransactionResponse> {
  try {
    const response = await bandoApiClient.post(`/wallets/${walletAddress}/transactions`, {
      transactionIntent: {
        sku,
        quantity,
        chain: chainId,
        token,
        wallet: walletAddress,
        quote_id: quoteId,
        integrator: 'ferfiefam',
        termsAccepted: true,
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error creating gift card transaction:', error);
    throw error;
  }
}

/**
 * Fetches a user's gift card transaction history
 * @param walletAddress User's wallet address
 * @param limit Number of transactions to fetch
 * @param offset Offset for pagination
 * @returns Array of transaction responses
 */
export async function getGiftCardTransactions(
  walletAddress: string,
  limit: number = 10,
  offset: number = 0
): Promise<BandoTransactionResponse[]> {
  try {
    const response = await bandoApiClient.get(`/wallets/${walletAddress}/transactions`, {
      params: {
        limit,
        offset,
      },
    });

    return response.data.transactions;
  } catch (error) {
    console.error('Error fetching gift card transactions:', error);
    throw error;
  }
}

/**
 * Fetches details for a specific gift card transaction
 * @param walletAddress User's wallet address
 * @param transactionId Transaction ID
 * @returns Transaction response
 */
export async function getGiftCardTransaction(
  walletAddress: string,
  transactionId: string
): Promise<BandoTransactionResponse> {
  try {
    const response = await bandoApiClient.get(
      `/wallets/${walletAddress}/transactions/${transactionId}`
    );

    return response.data;
  } catch (error) {
    console.error('Error fetching gift card transaction:', error);
    throw error;
  }
}

/**
 * Fetches all countries from the Bando API
 * @returns Promise with the countries response
 */
export async function getCountries(): Promise<CountriesResponse> {
  try {
    const response = await axios.get<CountriesResponse>(
      `${BANDO_API_URL}/countries/`
    );
    devLog.log('getCountries');
    devLog.log(response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching countries:', error);
    throw error;
  }
}

/**
 * Reference validation response interface
 */
export interface ReferenceValidationResponse {
  error?: string;
  message?: string;
  data?: {
    validationId: string;
    [key: string]: any;
  };
}

/**
 * Validates a reference with the Bando API and returns a validationId
 * This function can be called from the client side to reduce server computation
 *
 * @param reference User email or other reference identifier
 * @param requiredFields Required fields for the reference (e.g., name)
 * @param transactionIntent Transaction details including SKU, amount, etc.
 * @returns Promise with the reference validation response containing validationId
 */
export async function validateReference(
  reference: string,
  requiredFields: Array<{key: string, value: string}>,
  transactionIntent: {
    sku: string;
    quantity: number;
    amount: number;
    chain: string | number;
    token: string;
    wallet: string;
    integrator: string;
    has_accepted_terms: boolean;
    quote_id: number | string;
  }
): Promise<ReferenceValidationResponse> {
  try {
    // Prepare the request payload
    const payload = {
      reference,
      requiredFields,
      transactionIntent: {
        ...transactionIntent,
        // Ensure chain is a string
        chain: transactionIntent.chain.toString(),
        // Ensure quote_id is a number
        quote_id: typeof transactionIntent.quote_id === 'string'
          ? parseInt(transactionIntent.quote_id)
          : transactionIntent.quote_id
      }
    };

    devLog.log('[validateReference] Calling /references/ API with payload:', payload);

    // Call the Bando API
    const response = await axios.post(
      'https://api.bando.cool/api/v1/references/',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': '*/*'
        }
      }
    );

    devLog.log('[validateReference] Reference validation response:', response.data);

    return response.data;
  } catch (error: any) {
    devLog.error('[validateReference] Error validating reference:', error);

    // Return a structured error response
    return {
      error: error.response?.data?.error || error.message || 'Failed to validate reference',
      message: error.response?.data?.message || error.message || 'An error occurred during reference validation'
    };
  }
}
