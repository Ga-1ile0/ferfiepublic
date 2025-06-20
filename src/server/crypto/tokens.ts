'use server';

import { db } from '@/lib/db';

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
