'use server';

import { db } from '@/lib/db';
import { ethers } from 'ethers';
import { availableTokens } from '@/lib/tokens';

// ERC-20 ABI for balanceOf
const ERC20_ABI = ['function balanceOf(address owner) view returns (uint256)'];

/**
 * Get a user's token balances for all available tokens
 */
export async function getTokenBalances(userAddress: string): Promise<Record<string, string>> {
  const balances: Record<string, string> = {};
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);

  try {
    // Get balances for all tokens
    const balancePromises = availableTokens.map(async token => {
      try {
        const contract = new ethers.Contract(token.contract, ERC20_ABI, provider);
        const balanceWei = await contract.balanceOf(userAddress);

        // Convert balance from smallest unit to human-readable format
        const balance = ethers.formatUnits(balanceWei, token.decimals);

        // Store using token symbol as key
        balances[token.symbol] = balance;
      } catch (error) {
        console.error(`Error fetching balance for ${token.symbol}:`, error);
        balances[token.symbol] = '0';
      }
    });

    await Promise.all(balancePromises);
    return balances;
  } catch (error) {
    console.error('Error fetching token balances:', error);
    return {};
  }
}

/**
 * Get a user's trade history from the database
 */
export async function getTradeHistory(userId: string) {
  try {
    const trades = await db.tokenTrade.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // Limit to 10 most recent trades
    });

    return trades.map(trade => ({
      id: trade.id,
      fromAmount: trade.fromAmount,
      fromToken: trade.fromToken,
      toAmount: trade.toAmount,
      toToken: trade.toToken,
      exchangeRate: trade.exchangeRate,
      txHash: trade.txHash,
      createdAt: trade.createdAt,
      completedAt: trade.completedAt,
    }));
  } catch (error) {
    console.error('Error fetching trade history:', error);
    return [];
  }
}
