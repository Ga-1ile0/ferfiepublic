'use server';

import { db } from '@/lib/db';

/**
 * Get sidebar options for a specific user
 */
export const getUserSidebarOptions = async (userId: string) => {
  try {
    if (!userId) return { status: 403, message: 'User ID is required' };

    const sidebarOptions = await db.sidebarOption.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      status: 200,
      data: sidebarOptions,
    };
  } catch (error) {
    console.error('Error fetching sidebar options:', error);
    return { status: 500, message: 'Failed to fetch sidebar options' };
  }
};

/**
 * Update sidebar options for a kid user
 */
export const updateKidSidebarOptions = async (
  kidId: string,
  options: {
    allowTrade: boolean;
    allowGiftCards: boolean;
    allowChores: boolean;
    allowSettings: boolean;
  }
) => {
  try {
    if (!kidId) return { status: 403, message: 'Kid ID is required' };

    // Update permissions in the database to match sidebar options
    const existingPermissions = await db.permission.findUnique({
      where: { userId: kidId },
    });

    // Update or create permissions record
    if (existingPermissions) {
      await db.permission.update({
        where: { userId: kidId },
        data: {
          tradingEnabled: options.allowTrade,
          giftCardsEnabled: options.allowGiftCards,
        },
      });
    } else {
      await db.permission.create({
        data: {
          userId: kidId,
          tradingEnabled: options.allowTrade,
          giftCardsEnabled: options.allowGiftCards,
        },
      });
    }

    // Delete existing sidebar options for this kid
    await db.sidebarOption.deleteMany({
      where: { userId: kidId },
    });

    // Create default options that are always available
    const defaultOptions = [
      {
        name: 'Home',
        link: '/',
        userId: kidId,
      },
      {
        name: 'Allowance',
        link: '/allowance',
        userId: kidId,
      },
    ];

    // Add conditional options based on permissions
    const conditionalOptions = [
      // Show 'Spend' option if either trading or gift cards are enabled
      (options.allowTrade || options.allowGiftCards) && {
        name: 'Spend',
        link: '/spend',
        userId: kidId,
      },
      options.allowChores && {
        name: 'Chores',
        link: '/chores',
        userId: kidId,
      },
      options.allowSettings && {
        name: 'Settings',
        link: '/settings',
        userId: kidId,
      },
    ].filter(Boolean);

    // Combine and create all options
    const allOptions = [...defaultOptions, ...conditionalOptions];
    await db.sidebarOption.createMany({
      // @ts-ignore
      data: allOptions,
    });

    return {
      status: 200,
      message: 'Sidebar options updated successfully',
    };
  } catch (error) {
    console.error('Error updating sidebar options:', error);
    return { status: 500, message: 'Failed to update sidebar options' };
  }
};

/**
 * Sync sidebar options with permissions
 * This function ensures that sidebar options and permissions are in sync
 */
export const syncSidebarWithPermissions = async (userId: string) => {
  try {
    const permissions = await db.permission.findUnique({
      where: { userId },
    });

    if (!permissions) return { status: 404, message: 'Permissions not found' };

    // Map permissions to sidebar options
    const sidebarOptions = {
      allowTrade: permissions.tradingEnabled,
      allowGiftCards: permissions.giftCardsEnabled,
      allowChores: true, // Always allow chores for now
      allowSettings: true, // Always allow settings for now
    };

    // Update sidebar options
    return await updateKidSidebarOptions(userId, sidebarOptions);
  } catch (error) {
    console.error('Error syncing sidebar with permissions:', error);
    return { status: 500, message: 'Failed to sync sidebar with permissions' };
  }
};
