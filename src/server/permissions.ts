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
          maxGiftCardAmount: null,
          requireGiftCardApproval: true,
          // Crypto transfer settings
          cryptoTransferEnabled: false,
          maxTransferAmount: null,
          allowedRecipientAddresses: [],
          recipientNicknames: {}, // Empty object for address-to-nickname mappings
          includeFamilyWallet: true, // Default to true - allow transfer to family wallet
          // Legacy fields
          allowEth: true,
          allowUsdc: true,
          allowBase: true,
          allowedTokenSymbols: [], // Default to empty array
          allowGamingGiftCards: true, // Keep for backward
          allowFoodGiftCards: true, // Keep for backward compatibility
          allowEntertainmentGiftCards: true, // Keep for backward compatibility
          allowShoppingGiftCards: false, // Keep for backward compatibility
          allowedGiftCardCategories: [], // Default to empty array
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
    maxGiftCardAmount?: number | null;
    requireGiftCardApproval?: boolean;
    // Crypto transfer permissions
    cryptoTransferEnabled?: boolean;
    maxTransferAmount?: number | null;
    allowedRecipientAddresses?: string[];
    // Legacy fields
    allowEth?: boolean;
    allowUsdc?: boolean; // Keep for backward compatibility
    allowBase?: boolean; // Keep for backward compatibility
    allowedTokenSymbols?: string[]; // New field
    allowGamingGiftCards?: boolean; // Keep for backward compatibility
    allowFoodGiftCards?: boolean; // Keep for backward compatibility
    allowEntertainmentGiftCards?: boolean; // Keep for backward compatibility
    allowShoppingGiftCards?: boolean; // Keep for backward compatibility
    allowedGiftCardCategories?: string[]; // New field
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
  if (data.maxTradeAmount !== null && amount > data.maxTradeAmount) {
    return false;
  }
  return true;
};

/**
 * Update sidebar options based on permission changes
 */
// async function updateSidebarBasedOnPermissions(
//   kidId: string,
//   permissions: {
//     tradingEnabled?: boolean;
//     giftCardsEnabled?: boolean;
//   }
// ) {
//   try {
//     // Get current sidebar options
//     const sidebarOptions = await db.sidebarOption.findMany({
//       where: { userId: kidId },
//     });

//     // Determine which options should be available based on permissions
//     const allowTrade = permissions.tradingEnabled !== false; // Default to true if not specified
//     const allowGiftCards = permissions.giftCardsEnabled !== false; // Default to true if not specified

//     // Always allow these options
//     const allowChores = true;
//     const allowSettings = true;

//     // Update sidebar options
//     await db.sidebarOption.deleteMany({
//       where: { userId: kidId },
//     });

//     // Create default options that are always available
//     const defaultOptions = [
//       {
//         name: 'Home',
//         link: '/',
//         userId: kidId,
//       },
//       {
//         name: 'Allowance',
//         link: '/allowance',
//         userId: kidId,
//       },
//     ];

//     // Add conditional options based on permissions
//     const conditionalOptions = [
//       allowTrade && {
//         name: 'Trade',
//         link: '/trade',
//         userId: kidId,
//       },
//       allowGiftCards && {
//         name: 'Gift Cards',
//         link: '/gift-cards',
//         userId: kidId,
//       },
//       allowChores && {
//         name: 'Chores',
//         link: '/chores',
//         userId: kidId,
//       },
//       allowSettings && {
//         name: 'Settings',
//         link: '/settings',
//         userId: kidId,
//       },
//     ].filter(Boolean);

//     // Combine and create all options
//     const allOptions = [...defaultOptions, ...conditionalOptions];
//     await db.sidebarOption.createMany({
//       data: allOptions,
//     });

//     return true;
//   } catch (error) {
//     console.error('Error updating sidebar based on permissions:', error);
//     return false;
//   }
// }
