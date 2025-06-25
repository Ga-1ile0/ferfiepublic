'use server'
import { getTokenPriceUSD, getRealExchangeRate } from '@/lib/tokens';
import { getKidPermissions } from './permissions';
import { db } from '@/lib/db';

// Use existing enum from schema
type SpendingCategory = 'TRADING' | 'NFT' | 'TRANSFER' | 'GIFT_CARD';

export interface SpendingRecord {
  userId: string;
  category: SpendingCategory;
  originalAmount: number;
  originalToken: string;
  amountInStablecoin: number;
  transactionHash?: string;
}

export interface DailySpendingSummary {
  totalSpent: number;
  tradingSpent: number;
  nftSpent: number;
  transferSpent: number;
  giftCardSpent: number;
}

/**
 * Convert amount to family stablecoin equivalent
 */
export async function convertToFamilyStablecoin(
  amount: number,
  fromToken: string,
  familyStablecoin: string
): Promise<number> {
  try {
    if (fromToken === familyStablecoin) {
      return amount;
    }

    // Get exchange rate from source token to family stablecoin
    const rate = await getRealExchangeRate(fromToken, familyStablecoin);
    return amount * rate;
  } catch (error) {
    console.error('Error converting to family stablecoin:', error);
    // Fallback: try to get USD prices and convert
    try {
      const fromPrice = await getTokenPriceUSD(fromToken);
      const toPrice = await getTokenPriceUSD(familyStablecoin);
      if (fromPrice && toPrice) {
        return (amount * fromPrice) / toPrice;
      }
      return amount; // Fallback: assume 1:1 if prices unavailable
    } catch (fallbackError) {
      console.error('Fallback conversion failed:', fallbackError);
      return amount; // Last resort: assume 1:1
    }
  }
}

/**
 * Record a spending transaction
 */
export async function recordSpending(record: SpendingRecord): Promise<{ success: boolean; error?: string }> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create daily spending record
    await db.dailySpending.create({
      data: {
        userId: record.userId,
        date: today,
        category: record.category,
        amountInStablecoin: record.amountInStablecoin,
        originalAmount: record.originalAmount,
        originalToken: record.originalToken,
        transactionHash: record.transactionHash,
        description: `${record.category} spending: ${record.originalAmount} ${record.originalToken}`
      }
    });

    // Also create transaction record for compatibility
    const transactionType = record.category === 'TRADING' ? 'TOKEN_TRADE' :
                           record.category === 'NFT' ? 'NFT_TRADE' :
                           record.category === 'TRANSFER' ? 'TOKEN_TRANSFER' :
                           record.category === 'GIFT_CARD' ? 'GIFT_CARD_PURCHASE' : 'TOKEN_TRANSFER';

    await db.transaction.create({
      data: {
        userId: record.userId,
        type: transactionType,
        amount: record.originalAmount,
        description: `${record.category} spending: ${record.originalAmount} ${record.originalToken}`,
        hash: record.transactionHash
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error recording spending:', error);
    return { success: false, error: 'Failed to record spending' };
  }
}

/**
 * Check if user can make a spending transaction
 */
export async function canMakeSpending(
  userId: string,
  category: SpendingCategory,
  amount: number,
  token: string
): Promise<{ canSpend: boolean; reason?: string; remainingLimit?: number }> {
  try {
    const permissionsResult = await getKidPermissions(userId);
    if (permissionsResult.status !== 200 || !permissionsResult.data) {
      return { canSpend: false, reason: 'Unable to fetch permissions' };
    }

    const permissions = permissionsResult.data;

    // Get user's family stablecoin for conversion
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { family: true }
    });

    if (!user?.family) {
      return { canSpend: false, reason: 'User family not found' };
    }

    const familyStablecoin = user.family.currencyAddress || '';
    const amountInStablecoin = await convertToFamilyStablecoin(amount, token, familyStablecoin);

    // Get daily spending summary
    const spendingSummary = await getDailySpendingSummary(userId);

    // Check category-specific limits using existing schema fields
    let categoryLimit: number | null = null;
    let categorySpent: number = 0;
    let limitName: string = '';

    switch (category) {
      case 'TRADING':
        categoryLimit = permissions.maxTradeAmount;
        categorySpent = spendingSummary.tradingSpent;
        limitName = 'daily trading limit';
        break;
      case 'NFT':
        categoryLimit = permissions.maxNftTradeAmount;
        categorySpent = spendingSummary.nftSpent;
        limitName = 'daily NFT limit';
        break;
      case 'TRANSFER':
        categoryLimit = permissions.maxTransferAmount;
        categorySpent = spendingSummary.transferSpent;
        limitName = 'daily transfer limit';
        break;
      case 'GIFT_CARD':
        // No specific limit for gift cards in current schema
        return { canSpend: true };
    }

    if (categoryLimit !== null && categoryLimit > 0) {
      const newCategorySpent = categorySpent + amountInStablecoin;
      if (newCategorySpent > categoryLimit) {
        const remaining = Math.max(0, categoryLimit - categorySpent);
        return {
          canSpend: false,
          reason: `Exceeds ${limitName} of ${categoryLimit}`,
          remainingLimit: remaining
        };
      }
    }

    return { canSpend: true };
  } catch (error) {
    console.error('Error checking spending permission:', error);
    return { canSpend: false, reason: 'Error checking permissions' };
  }
}

/**
 * Get daily spending summary for a user
 */
export async function getDailySpendingSummary(userId: string): Promise<DailySpendingSummary> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get daily spending records for today
    const dailySpending = await db.dailySpending.findMany({
      where: {
        userId,
        date: today
      }
    });

    const summary: DailySpendingSummary = {
      totalSpent: 0,
      tradingSpent: 0,
      nftSpent: 0,
      transferSpent: 0,
      giftCardSpent: 0
    };

    dailySpending.forEach((spending) => {
      const amountInStablecoin = spending.amountInStablecoin;
      summary.totalSpent += amountInStablecoin;

      switch (spending.category) {
        case 'TRADING':
          summary.tradingSpent += amountInStablecoin;
          break;
        case 'NFT':
          summary.nftSpent += amountInStablecoin;
          break;
        case 'TRANSFER':
          summary.transferSpent += amountInStablecoin;
          break;
        case 'GIFT_CARD':
          summary.giftCardSpent += amountInStablecoin;
          break;
      }
    });

    return summary;
  } catch (error) {
    console.error('Error getting daily spending summary:', error);
    return {
      totalSpent: 0,
      tradingSpent: 0,
      nftSpent: 0,
      transferSpent: 0,
      giftCardSpent: 0
    };
  }
}

/**
 * Get weekly spending summary for a specific category
 */
export async function getWeeklySpendingSummary(userId: string, category: SpendingCategory): Promise<number> {
  try {
    // Get the start of the current week (Sunday)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Get the end of the week (Saturday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const transactions = await db.transaction.findMany({
      where: {
        userId,
        type: {
          in: ['TOKEN_TRADE', 'NFT_TRADE', 'TOKEN_TRANSFER', 'GIFT_CARD_PURCHASE']
        },
        createdAt: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      }
    });

    return transactions
      .filter((transaction: any) => {
        const metadata = transaction.metadata as any;
        return metadata?.category === category;
      })
      .reduce((total: number, transaction: any) => {
        const metadata = transaction.metadata as any;
        return total + (metadata?.amountInStablecoin || 0);
      }, 0);
  } catch (error) {
    console.error('Error getting weekly spending summary:', error);
    return 0;
  }
}
