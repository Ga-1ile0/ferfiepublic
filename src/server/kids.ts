'use server';

import { ethers } from 'ethers';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { decryptSensitiveData,encryptSensitiveData } from '@/lib/kms-service';
/**
 * Generate a new Ethereum wallet
 */
export const generateNewWallet = async () => {
  try {
    const wallet = ethers.Wallet.createRandom();
    return {
      status: 200,
      data: {
        address: wallet.address,
        privateKey: wallet.privateKey,
      },
    };
  } catch (error) {
    console.error('Error generating wallet:', error);
    return { status: 500, message: 'Failed to generate wallet' };
  }
};

/**
 * Import an existing wallet using private key
 */
export const importWallet = async (privateKey: string) => {
  try {
    if (!privateKey.startsWith('0x')) {
      privateKey = '0x' + privateKey;
    }

    const wallet = new ethers.Wallet(privateKey);
    return {
      status: 200,
      data: {
        address: wallet.address,
        privateKey: wallet.privateKey,
      },
    };
  } catch (error) {
    console.error('Error importing wallet:', error);
    return { status: 500, message: 'Invalid private key' };
  }
};

/**
 * Create a child account with crypto wallet
 */
export const createChildWithWallet = async (
  name: string,
  parentAddress: any,
  walletData?: { privateKey?: string }
) => {
  try {
    if (!name || !parentAddress) {
      return { status: 400, message: 'Name and parent ID are required' };
    }

    // Find the parent user
    const parent = await db.user.findUnique({
      where: { address: parentAddress },
    });

    if (!parent) {
      return { status: 404, message: 'Parent not found' };
    }

    // Check if parent already has a family
    let family = await db.family.findFirst({
      where: { parentId: parent.id },
    });

    // If no family exists, create one
    if (!family) {
      family = await db.family.create({
        data: {
          name: `${parent.name || 'Parent'}'s Family`,
          parentId: parent.id,
          currency: 'USDC', // Default currency is USD
          currencyAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // No stablecoin address by default
        },
      });
    }

    // Generate or import wallet
    const walletResult = walletData?.privateKey
      ? await importWallet(walletData.privateKey)
      : await generateNewWallet();

    if (walletResult.status !== 200 || !walletResult.data) {
      return walletResult;
    }

    const { address, privateKey } = walletResult.data;

    const encryptedData = await encryptSensitiveData(privateKey);
    // Create child account in database with family relationship
    const child = await db.user.create({
      data: {
        name,
        address,
        privateKey: encryptedData.encryptedDataB64,
        dek: encryptedData.encryptedDekB64,
        role: 'KID',
        familyId: family.id, // Associate child with the family
        privateKeyDownloaded: walletData?.privateKey ? true : false, // Mark as downloaded if imported
        permissions: {
          create: {
            tradingEnabled: true,
            giftCardsEnabled: false,
          },
        },
        SidebarOption: {
          create: [
            { name: 'Home', link: '/' },
            { name: 'Earn', link: '/earn' },
            { name: 'Portfolio', link: '/portfolio' },
            { name: 'Spend', link: '/spend' },
            { name: 'Settings', link: '/settings' },
          ],
        },
      },
    });

    return {
      status: 200,
      data: {id: child.id, address: child.address, name: child.name, privateKey: privateKey},
      message: 'Child account created successfully',
    };
  } catch (error) {
    console.error('Error creating child account:', error);
    return { status: 500, message: 'Failed to create child account' };
  }
};

/**
 * Mark a child's private key as downloaded
 */
export const markPrivateKeyDownloaded = async (childId: string) => {
  try {
    if (!childId) {
      return { status: 400, message: 'Child ID is required' };
    }

    // Find the child user
    const child = await db.user.findUnique({
      where: { id: childId },
    });

    if (!child) {
      return { status: 404, message: 'Child not found' };
    }

    // Update the privateKeyDownloaded field
    const updatedChild = await db.user.update({
      where: { id: childId },
      data: { privateKeyDownloaded: true },
    });

    return {
      status: 200,
      message: 'Private key marked as downloaded',
    };
  } catch (error) {
    console.error('Error marking private key as downloaded:', error);
    return { status: 500, message: 'Failed to update private key download status' };
  }
};

/**
 * Get children who need private key download
 */
export const getChildrenNeedingKeyDownload = async (parentId: string) => {
  try {
    if (!parentId) {
      return { status: 400, message: 'Parent ID is required' };
    }

    // Find the parent user
    const parent = await db.user.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      return { status: 404, message: 'Parent not found' };
    }

    // Find the family where parent is the owner
    const family = await db.family.findFirst({
      where: { parentId: parentId },
    });

    if (!family) {
      return { status: 200, data: [] }; // No family means no children
    }

    // Find all KID users in the family who haven't had their private key downloaded
    const children = await db.user.findMany({
      where: {
        role: 'KID',
        familyId: family.id,
        privateKeyDownloaded: false,
        privateKey: { not: null }, // Must have a private key
      },
      select: {
        id: true,
        name: true,
        privateKey: true,
        dek: true,
      },
    });

    const decryptedChildren = children.map(async (child) => {
      const key = await decryptSensitiveData(child.privateKey!,child.dek!);
      return {
        ...child,
        privateKey: key,
      };
    });
    return {
      status: 200,
      data: decryptedChildren,
    };
  } catch (error) {
    console.error('Error fetching children needing key download:', error);
    return { status: 500, message: 'Failed to fetch children' };
  }
};

/**
 * Delete a child account
 */
export const deleteChild = async (childId: string) => {
  try {
    if (!childId) {
      return { status: 400, message: 'Child ID is required' };
    }

    // Find the child user to verify it exists and is a KID role
    const child = await db.user.findUnique({
      where: { id: childId },
      include: {
        permissions: true,
        SidebarOption: true,
      },
    });

    if (!child) {
      return { status: 404, message: 'Child not found' };
    }

    if (child.role !== 'KID') {
      return { status: 400, message: 'Only child accounts can be deleted with this function' };
    }

    // Delete related records first (to avoid foreign key constraints)
    // Delete permissions if they exist
    if (child.permissions) {
      await db.permission.delete({
        where: { userId: childId },
      });
    }

    // Delete sidebar options if they exist
    if (child.SidebarOption && child.SidebarOption.length > 0) {
      await db.sidebarOption.deleteMany({
        where: { userId: childId },
      });
    }

    // Delete any allowances associated with the child
    await db.allowance.deleteMany({
      where: { userId: childId },
    });

    // Delete any allowance transactions associated with the child
    await db.transaction.deleteMany({
      where: { userId: childId },
    });

    // Delete any chores associated with the child
    await db.chore.deleteMany({
      where: { assignedToId: childId },
    });

    // Finally, delete the user record
    await db.user.delete({
      where: { id: childId },
    });
    // Revalidate the /children path after successful deletion
    revalidatePath('/children');
    return {
      status: 200,
      message: 'Child account deleted successfully',
    };
  } catch (error) {
    console.error('Error deleting child account:', error);
    return { status: 500, message: 'Failed to delete child account' };
  }
};
