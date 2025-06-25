'use server';

import { db } from '@/lib/db';

/**
 * Get permissions for a specific kid user
 */
export const getKidPermissions = async (kidId: string) => {
  try {
    if (!kidId) return { status: 403, message: 'Kid ID is required' };

    const permissions = await db.permission.findUnique({
      where: { userId: kidId },
    });

    // If no permissions exist yet, return default permissions
    if (!permissions) {
      return {
        status: 200,
        data: {
          tradingEnabled: true,
          nftEnabled: true,
          giftCardsEnabled: true,
          maxTradeAmount: null,
          maxNftTradeAmount: null,
          maxGiftCardAmount: null,
          requireGiftCardApproval: true,
          // Daily spending limits
          dailySpendingLimit: null,
          dailyTradingLimit: null,
          dailyNftLimit: null,
          dailyTransferLimit: null,
          // Crypto transfer settings
          cryptoTransferEnabled: false,
          maxTransferAmount: null,
          allowedRecipientAddresses: [],
          recipientNicknames: {},
          includeFamilyWallet: true,
          allowEth: true,
          allowUsdc: true,
          allowBase: true,
          allowedTokenSymbols: [],
          allowGamingGiftCards: true,
          allowEntertainmentGiftCards: true,
          allowShoppingGiftCards: false,
          allowedGiftCardCategories: [],
          allowedNftSlugs: [],
          // Gift card settings
          giftCardCountry: 'US',
          giftCardEmail: ''
        },
      };
    }

    return {
      status: 200,
      data: permissions,
    };
  } catch (error) {
    console.error('Error fetching kid permissions:', error);
    return { status: 500, message: 'Failed to fetch permissions' };
  }
};

/**
 * Update permissions for a kid user
 */
export const updateKidPermissions = async (
  kidId: string,
  permissions: {
    tradingEnabled?: boolean;
    nftEnabled?: boolean;
    giftCardsEnabled?: boolean;
    maxTradeAmount?: number | null;
    maxNftTradeAmount?: number | null;
    maxGiftCardAmount?: number | null;
    requireGiftCardApproval?: boolean;
    // Daily spending limits
    dailySpendingLimit?: number | null;
    dailyTradingLimit?: number | null;
    dailyNftLimit?: number | null;
    dailyTransferLimit?: number | null;
    // Crypto transfer permissions
    cryptoTransferEnabled?: boolean;
    maxTransferAmount?: number | null;
    allowedRecipientAddresses?: string[];
    allowEth?: boolean;
    allowUsdc?: boolean;
    allowBase?: boolean;
    allowedTokenSymbols?: string[];
    allowGamingGiftCards?: boolean;
    allowFoodGiftCards?: boolean;
    allowEntertainmentGiftCards?: boolean;
    allowShoppingGiftCards?: boolean;
    allowedGiftCardCategories?: string[];
    allowedNftSlugs?: string[];
    // Gift card settings
    giftCardCountry?: string;
    giftCardEmail?: string;
  }
) => {
  try {
    if (!kidId) return { status: 403, message: 'Kid ID is required' };

    // Check if permissions already exist for this kid
    const existingPermissions = await db.permission.findUnique({
      where: { userId: kidId },
    });

    let updatedPermissions;

    if (existingPermissions) {
      // Update existing permissions
      updatedPermissions = await db.permission.update({
        where: { userId: kidId },
        data: permissions,
      });
    } else {
      // Create new permissions
      // Ensure default values for new array fields if not provided
      const createData = {
        userId: kidId,
        ...permissions,
        allowedTokenSymbols: permissions.allowedTokenSymbols ?? [],
        allowedGiftCardCategories: permissions.allowedGiftCardCategories ?? [],
        allowedNftSlugs: permissions.allowedNftSlugs ?? [],
      };
      updatedPermissions = await db.permission.create({
        data: createData,
      });
    }

    // Update sidebar options based on permissions
    // await updateSidebarBasedOnPermissions(kidId, permissions);

    return {
      status: 200,
      data: updatedPermissions,
      message: 'Permissions updated successfully',
    };
  } catch (error) {
    console.error('Error updating kid permissions:', error);
    return { status: 500, message: 'Failed to update permissions' };
  }
};

/**
 * Check if a user can make an NFT transaction based on permissions
 */
export const canMakeNFTTransaction = async (kidId: string, amount: number) => {
  const perms = await getKidPermissions(kidId);
  if (perms.status !== 200 || !perms.data) {
    return false;
  }
  const data = perms.data;
  if (!data.nftEnabled) {
    return false;
  }
  if (data.maxNftTradeAmount !== null && amount > data.maxNftTradeAmount) {
    return false;
  }
  return true;
};

/**
 * Check if a user can make a trading transaction based on permissions
 */
export const canMakeTradingTransaction = async (kidId: string, amount: number) => {
  const perms = await getKidPermissions(kidId);
  if (perms.status !== 200 || !perms.data) {
    return false;
  }
  const data = perms.data;
  if (!data.tradingEnabled) {
    return false;
  }
  if (data.maxTradeAmount !== null && amount > data.maxTradeAmount) {
    return false;
  }
  return true;
};

/**
 * Check if a user can make a crypto transfer based on permissions
 */
export const canMakeCryptoTransfer = async (kidId: string, amount: number) => {
  const perms = await getKidPermissions(kidId);
  if (perms.status !== 200 || !perms.data) {
    return false;
  }
  const data = perms.data;
  if (!data.cryptoTransferEnabled) {
    return false;
  }
  if (data.maxTransferAmount !== null && amount > data.maxTransferAmount) {
    return false;
  }
  return true;
};

/**
 * Get remaining daily spending limits for a user
 */
export const getDailySpendingLimits = async (kidId: string) => {
  try {
    const { getDailySpendingSummary } = await import('./spending-tracker');

    const perms = await getKidPermissions(kidId);
    if (perms.status !== 200 || !perms.data) {
      return { success: false, message: 'Unable to fetch permissions' };
    }

    const permissions = perms.data;
    const spendingSummary = await getDailySpendingSummary(kidId);

    return {
      success: true,
      data: {
        dailyTradingLimit: permissions.maxTradeAmount,
        dailyNftLimit: permissions.maxNftTradeAmount,
        dailyTransferLimit: permissions.maxTransferAmount,
        spentToday: spendingSummary,
        remainingLimits: {
          trading: permissions.maxTradeAmount && permissions.maxTradeAmount > 0 ? Math.max(0, permissions.maxTradeAmount - spendingSummary.tradingSpent) : null,
          nft: permissions.maxNftTradeAmount && permissions.maxNftTradeAmount > 0 ? Math.max(0, permissions.maxNftTradeAmount - spendingSummary.nftSpent) : null,
          transfer: permissions.maxTransferAmount && permissions.maxTransferAmount > 0 ? Math.max(0, permissions.maxTransferAmount - spendingSummary.transferSpent) : null
        }
      }
    };
  } catch (error) {
    console.error('Error getting daily spending limits:', error);
    return { success: false, message: 'Failed to get spending limits' };
  }
};
