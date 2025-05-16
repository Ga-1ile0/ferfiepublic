'use server'
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { availableTokens } from '../lib/tokens';

const prisma = new PrismaClient();

// Add type declaration for global token fetch tracking
declare global {
  var __lastTokenPriceFetch: number | undefined;
}

// Fetch the current USD price for a token using Dexscreener API
export async function fetchTokenPrice(contract: string): Promise<number | null> {
  try {
    const tokenApiUrl = `https://api.dexscreener.com/latest/dex/tokens/${contract}`;
    const response = await axios.get(tokenApiUrl);
    const data = response.data;

    if (data.pairs && data.pairs.length > 0) {
      const usdPrice = parseFloat(data.pairs[0].priceUsd);
      return usdPrice;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching token price for ${contract}:`, error);
    return null;
  }
}

// Store token price in the database using Prisma, only if not already present for the current hour ±2 minutes
export async function storeTokenPrice(contract: string, usdPrice: number) {
  try {
    const now = new Date();
    // Start of the current hour
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    // ±2 minutes window
    const windowStart = new Date(hourStart.getTime() - 1 * 60 * 1000);
    const windowEnd = new Date(hourStart.getTime() + 1 * 60 * 1000);

    // Check if a TokenRate already exists in the window
    const existing = await prisma.tokenRate.findFirst({
      where: {
        contract: contract.toLowerCase(),
        timestamp: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    });
    if (existing) {
      // Already exists for this hour window
      return false;
    }

    // Insert new TokenRate
    await prisma.tokenRate.create({
      data: {
        contract: contract.toLowerCase(),
        usdPrice,
        timestamp: now,
      },
    });
    return true;
  } catch (error) {
    console.error(`Error storing token price for ${contract}:`, error);
    return false;
  }
}

// Store prices for all available tokens
// Store prices for all available tokens, but only insert if not already present for this hour window
export async function storeAllTokenPrices() {
  // Fetch all prices in parallel for availableTokens
  const pricePromises = availableTokens.map(token => fetchTokenPrice(token.contract));
  const prices = await Promise.all(pricePromises);

  // Store each token price in parallel as well
  const storePromises = prices.map((price, idx) => {
    const token = availableTokens[idx];
    if (price !== null) {
      return storeTokenPrice(token.contract, price).then(stored => ({
        token: token.symbol,
        price,
        stored,
      })).catch(() => ({
        token: token.symbol,
        price,
        stored: false,
      }));
    } else {
      return Promise.resolve({
        token: token.symbol,
        price: null,
        stored: false,
      });
    }
  });

  const results = await Promise.all(storePromises);

  // Clean up old entries (delete only entries older than 24 hours)
  await cleanupOldRates();

  return {
    success: true,
    results,
  };
}

// Get historical token rates for a specific contract
export async function getTokenRateHistory(contract: string, limit = 24) {
  try {
    const history = await prisma.tokenRate.findMany({
      where: { contract: contract.toLowerCase() },
      orderBy: { timestamp: 'asc' },
      take: limit,
    });
    return history;
  } catch (error) {
    console.error(`Error fetching token rate history for ${contract}:`, error);
    return [];
  }
}

// Get exchange rate history between two tokens
export async function getExchangeRateHistory(
  fromContract: string,
  toContract: string,
  limit = 24
) {
  try {
    // Get the rate history for both tokens
    const fromRates = await getTokenRateHistory(fromContract, limit) as Array<{
      id: string;
      contract: string;
      usdPrice: number;
      timestamp: Date;
    }>;

    const toRates = await getTokenRateHistory(toContract, limit) as Array<{
      id: string;
      contract: string;
      usdPrice: number;
      timestamp: Date;
    }>;

    if (fromRates.length === 0 || toRates.length === 0) {
      return [];
    }

    // Create a map of timestamp -> price for easier lookup
    const toRatesMap = new Map<number, number>();

    toRates.forEach((rate) => {
      toRatesMap.set(rate.timestamp.getTime(), rate.usdPrice);
    });

    // Calculate exchange rates at each point where we have data for both tokens
    const exchangeRates = fromRates
      .filter((fromRate) => {
        // Find the closest time in toRates
        const fromTime = fromRate.timestamp.getTime();
        return toRatesMap.has(fromTime);
      })
      .map((fromRate) => {
        const timestamp = fromRate.timestamp;
        const fromPrice = fromRate.usdPrice;
        const toPrice = toRatesMap.get(timestamp.getTime());

        const rate = fromPrice / (toPrice || 1); // Prevent division by zero

        return {
          time: `${Math.floor((Date.now() - timestamp.getTime()) / (60 * 60 * 1000))}h`,
          timestamp,
          price: rate,
        };
      });

    return exchangeRates;
  } catch (error) {
    console.error(`Error calculating exchange rate history:`, error);
    return [];
  }
}

// Clean up old token rate entries, deleting only entries older than 24 hours from now
async function cleanupOldRates() {
  try {
    // Calculate the cutoff date (24 hours ago from now)
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Find all rates older than cutoff
    const oldRates = await prisma.tokenRate.findMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
      select: { id: true },
    });
    if (oldRates.length === 0) {
      // No old rates to delete
      return true;
    }
    const idsToDelete = oldRates.map(r => r.id);
    await prisma.tokenRate.deleteMany({
      where: { id: { in: idsToDelete } },
    });
    return true;
  } catch (error) {
    console.error('Error cleaning up old token rates:', error);
    return false;
  }
}
