'use client';

import { availableTokens } from './tokens';

// Client-side functions for fetching exchange rates and token information
export async function fetchExchangeRate(
  fromTokenSymbol: string,
  toTokenSymbol: string
): Promise<number> {
  const fromToken = availableTokens.find(t => t.symbol === fromTokenSymbol);
  const toToken = availableTokens.find(t => t.symbol === toTokenSymbol);

  if (!fromToken || !toToken) {
    throw new Error('Invalid token symbols');
  }

  try {
    const apiUrl = `/api/exchange-rate?fromToken=${fromToken.contract}&toToken=${toToken.contract}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rate');
    }

    const data = await response.json();
    return data.exchangeRate;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    return 0;
  }
}

export function getTokenBySymbol(symbol: string) {
  return availableTokens.find(t => t.symbol === symbol);
}

export function getTokenByContract(contract: string) {
  return availableTokens.find(t => t.contract.toLowerCase() === contract.toLowerCase());
}

export function formatTokenAmount(amount: number | string, decimals: number = 6): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) return '0.00';

  // For very small amounts, show more decimals
  if (numAmount > 0 && numAmount < 0.001) {
    return numAmount.toFixed(8);
  }

  return numAmount.toFixed(decimals);
}
