'use server';

import { db } from '@/lib/db';
import { parseEther, ethers } from 'ethers';
import { TransactionType } from '@prisma/client';
import { decryptSensitiveData } from '@/lib/kms-service';

/**
 * Get allowance transactions for a specific child
 */
export const getChildAllowanceTransactions = async (childId: string, limit = 10) => {
  try {
    if (!childId) return { status: 400, message: 'Child ID is required' };

    const transactions = await db.transaction.findMany({
      where: {
        userId: childId,
        type: 'ALLOWANCE'
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return {
      status: 200,
      data: transactions,
    };
  } catch (error) {
    console.error('Error fetching allowance transactions:', error);
    return { status: 500, message: 'Failed to fetch allowance transactions' };
  }
};

/**
 * Claim allowance for a child
 * Transfers the allowance amount from family wallet to child wallet
 */
export const claimAllowance = async (childId: string) => {
  try {
    if (!childId) return { status: 400, message: 'Child ID is required' };

    // Get the child's information including their wallet address and family
    const child = await db.user.findUnique({
      where: { id: childId },
      include: {
        family: true,
        allowances: true
      }
    });

    if (!child) {
      return { status: 404, message: 'Child not found' };
    }

    if (!child.address) {
      return { status: 400, message: 'Child has no wallet address' };
    }

    if (!child.familyId) {
      return { status: 400, message: 'Child is not associated with a family' };
    }

    if (!child.allowances || child.allowances.length === 0) {
      return { status: 400, message: 'Child has no allowance set' };
    }

    const allowance = child.allowances[0];

    // Check if the allowance is due (current date >= nextDate)
    const now = new Date();
    if (now < allowance.nextDate) {
      return {
        status: 400,
        message: 'Allowance is not yet available to claim',
        nextDate: allowance.nextDate
      };
    }

    // Get the parent's information (family owner) to get their private key
    const family = await db.family.findUnique({
      where: { id: child.familyId },
      include: {
        owner: true
      }
    });

    if (!family) {
      return { status: 404, message: 'Family not found' };
    }

    if (!family.owner.privateKey) {
      return { status: 400, message: 'Parent has no private key' };
    }

    if (!family.currencyAddress) {
      return { status: 400, message: 'Family has no currency address configured' };
    }

    // Create a transaction record for the allowance
    const transaction = await db.transaction.create({
      data: {
        amount: allowance.amount,
        type: TransactionType.ALLOWANCE,
        description: `Allowance (${allowance.frequency.toLowerCase()})`,
        userId: childId,
        familyId: child.familyId
      },
    });

    // Calculate the next allowance date
    const nextDate = calculateNextAllowanceDate(allowance);

    // Update the allowance with the new next date
    await db.allowance.update({
      where: { id: allowance.id },
      data: { nextDate }
    });

    // Perform the blockchain transfer
    try {
      const key = await decryptSensitiveData(family.owner.privateKey!,family.owner.dek!);
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const wallet = new ethers.Wallet(key, provider);

      // Create contract instance for the token
      const tokenAbi = ['function transfer(address recipient, uint256 amount) public returns (bool)'];
      const tokenContract = new ethers.Contract(family.currencyAddress, tokenAbi, wallet);

      // Convert amount to wei (assuming 18 decimals for the token)
      const amountInWei = parseEther(allowance.amount.toString());

      // Execute the transfer
      const tx = await tokenContract.transfer(child.address, amountInWei);
      const receipt = await tx.wait();

      // Update the transaction with the blockchain hash
      await db.transaction.update({
        where: { id: transaction.id },
        data: { hash: receipt.hash }
      });

      return {
        status: 200,
        data: {
          ...transaction,
          hash: receipt.hash
        },
        message: 'Allowance claimed successfully'
      };
    } catch (blockchainError) {
      console.error('Blockchain transfer error:', blockchainError);

      // The database transaction was created, but the blockchain transfer failed
      return {
        status: 202,
        data: transaction,
        message: 'Transaction recorded but blockchain transfer failed'
      };
    }
  } catch (error) {
    console.error('Error claiming allowance:', error);
    return { status: 500, message: 'Failed to claim allowance' };
  }
};

/**
 * Helper function to calculate the next allowance date based on frequency
 */
function calculateNextAllowanceDate(allowance: any): Date {
  const now = new Date();
  let nextDate = new Date(now);

  switch (allowance.frequency) {
    case 'DAILY':
      // Next day
      nextDate.setDate(now.getDate() + 1);
      break;
    case 'WEEKLY':
      // Next occurrence of the specified day of week
      const dayOfWeek = allowance.dayOfWeek !== null ? allowance.dayOfWeek : 1; // Default to Monday (1)
      const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7;
      nextDate.setDate(now.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));
      break;
    case 'MONTHLY':
      // Next occurrence of the specified day of month
      const dayOfMonth = allowance.dayOfMonth || 1;
      nextDate.setMonth(now.getMonth() + 1);
      nextDate.setDate(Math.min(dayOfMonth, getDaysInMonth(nextDate.getFullYear(), nextDate.getMonth())));
      break;
  }

  // Set time to 9:00 AM
  nextDate.setHours(9, 0, 0, 0);

  return nextDate;
}

/**
 * Helper function to get the number of days in a month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
