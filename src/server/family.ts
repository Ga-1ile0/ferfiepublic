'use server';

import { db } from '@/lib/db';
import { decryptSensitiveData } from '@/lib/kms-service';
import { TokenType } from '@prisma/client';

/**
 * Get family data including currency information
 */
export const getFamilyData = async (familyId: string) => {
  try {
    if (!familyId) return { status: 403, message: 'Family ID is required' };

    const family = await db.family.findUnique({
      where: { id: familyId },
    });

    if (!family) {
      return { status: 404, message: 'Family not found' };
    }

    return {
      status: 200,
      data: family,
    };
  } catch (error) {
    console.error('Error fetching family data:', error);
    return { status: 500, message: 'Failed to fetch family data' };
  }
};

export const getFamilyPrivateKey = async (userId: string) => {
  try {
    if (!userId) return { status: 403, message: 'User ID is required' };

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { status: 404, message: 'User not found' };
    }

    if(user.privateKeyDownloaded){
      return { status: 403, message: 'Private key already downloaded' };
    }

    const key = await decryptSensitiveData(user.privateKey!,user.dek!);
    console.log('Family private key:', key);
    return {
      status: 200,
      data: { privateKey: key },
    };
  } catch (error) {
    console.error('Error fetching family private key:', error);
    return { status: 500, message: 'Failed to fetch family private key' };
  }
};

/**
 * Update family currency
 */
export const updateFamilyCurrency = async (
  familyId: string,
  currency: TokenType,
  currencyAddress?: string
) => {
  try {
    if (!familyId) return { status: 403, message: 'Family ID is required' };

    const family = await db.family.findUnique({
      where: { id: familyId },
    });

    if (!family) {
      return { status: 404, message: 'Family not found' };
    }

    // Update family currency
    const updatedFamily = await db.family.update({
      where: { id: familyId },
      data: {
        currency,
        currencyAddress,
      },
    });

    return {
      status: 200,
      data: updatedFamily,
      message: 'Family currency updated successfully',
    };
  } catch (error) {
    console.error('Error updating family currency:', error);
    return { status: 500, message: 'Failed to update family currency' };
  }
};
