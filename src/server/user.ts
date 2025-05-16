'use server';
import { db } from '@/lib/db';
import { encryptSensitiveData } from '@/lib/kms-service';
import { ethers } from 'ethers';

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

export const onAuthenticateUser = async (address: string) => {
  try {
    if (!address) {
      return { status: 403 };
    }
    const userExists = await db.user.findUnique({
      where: { address: address },
      omit: {
        privateKey: true,
      },
      include: {
        family: true,
      },
    });

    if (userExists) {
      return {
        status: 200,
        user: userExists,
      };
    }

    // If user doesn't exist, create a new user
    const wallet = await generateNewWallet();
    if (wallet.status !== 200 || !wallet.data) {
      console.error('Failed to create wallet');
      return { status: 500 };
    }
    const encryptedData = await encryptSensitiveData(wallet.data.privateKey);
    const newUser = await db.user.create({
      data: {
        address: address,
        role: 'PARENT',
        familyAddress: wallet.data.address,
        privateKey: encryptedData.encryptedDataB64,
        dek: encryptedData.encryptedDekB64,
      },
    });

    const family = await db.family.create({
      data: {
        name: `Parent's Family`,
        parentId: newUser.id,
        currency: 'USDC', // Default currency is USDC
        currencyAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      },
    });
    // Update the user with the family ID
    const user = await db.user.update({
      where: { id: newUser.id },
      data: {
        familyId: family.id
    },
    include: {
      family: true,
    },
    });
    if (user) {
      return {
        status: 201,
        user: user,
        family: family,
      };
    }
    return { status: 404 };
  } catch (error) {
    console.log(error, 'Authentication error');
    return { status: 500 };
  }
};

export const onAuthenticateChild = async (userId: string, address: string) => {
  try {
    if (!userId || !address) {
      return { status: 403, message: 'Child ID and address are required' };
    }
    const child = await db.user.findUnique({
      where: { id: userId },
      include: {
        family: true,
        allowances: true,
        permissions: true,
      },
    });
    if (!child || child.address !== address || child.role !== 'KID') {
      return { status: 403, message: 'Authentication failed' };
    }
    return { status: 200, user: child };
  } catch (error) {
    console.error('Authentication error for child:', error);
    return { status: 500, message: 'Server error' };
  }
};

/**
 * Update a user's name
 */
export const updateUserName = async (userId: string, name: string) => {
  try {
    // Validate inputs
    if (!userId) {
      return { status: 400, message: 'User ID is required' };
    }

    if (!name || name.trim() === '') {
      return { status: 400, message: 'Name is required' };
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { status: 404, message: 'User not found' };
    }

    // Update the user's name
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { name: name.trim() },
    });

    return {
      status: 200,
      message: 'User name updated successfully',
      data: updatedUser,
    };
  } catch (error) {
    console.error('Error updating user name:', error);
    return { status: 500, message: 'Failed to update user name' };
  }
};

/**
 * Fetch children for a parent user
 */
export const getChildrenForParent = async (parentId: string) => {
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

    // Find all users who are members of that family with role KID
    const children = await db.user.findMany({
      where: {
        role: 'KID',
        familyId: family.id, // Only get children from this family
      },
      include: {
        allowances: true,
        permissions: true,
      },
    });

    return {
      status: 200,
      data: children,
    };
  } catch (error) {
    console.error('Error fetching children:', error);
    return { status: 500, message: 'Failed to fetch children' };
  }
};
