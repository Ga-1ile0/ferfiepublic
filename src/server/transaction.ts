'use server';

import { db } from '@/lib/db';
import { TransactionType } from '@prisma/client';

/**
 * Create a new transaction record
 */
export const createTransaction = async (
  userId: string,
  amount: number,
  type: TransactionType,
  hash?: string,
  description?: string,
  familyId?: string
) => {
  try {
    if (!userId) return { status: 400, message: 'User ID is required' };
    if (amount <= 0) return { status: 400, message: 'Amount must be greater than 0' };

    const transaction = await db.transaction.create({
      data: {
        userId,
        amount,
        type,
        hash,
        description,
        familyId,
      },
    });
    console.log('Transaction created:', transaction);
    return {
      status: 200,
      data: transaction,
      message: 'Transaction created successfully',
    };
  } catch (error) {
    console.error('Error creating transaction:', error);
    return { status: 500, message: 'Failed to create transaction' };
  }
};

/**
 * Get transactions for a family
 */
export const getFamilyTransactions = async (familyId: string, limit = 6) => {
  try {
    if (!familyId) return { status: 400, message: 'Family ID is required' };

    // Get all users in the family
    const familyMembers = await db.user.findMany({
      where: { familyId },
      select: { id: true },
    });

    const memberIds = familyMembers.map(member => member.id);

    // Get transactions for all family members
    const transactions = await db.transaction.findMany({
      where: {
        userId: { in: memberIds },
        // Exclude spending tracking records from dashboard display
        description: {
          not: {
            contains: 'spending:'
          }
        }
      },
      include: {
        user: {
          select: {
            name: true,
            role: true,
          },
        },
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
    console.error('Error fetching family transactions:', error);
    return { status: 500, message: 'Failed to fetch family transactions' };
  }
};

/**
 * Get transactions for a user
 */
export const getUserTransactions = async (userId: string, limit = 10) => {
  try {
    if (!userId) return { status: 400, message: 'User ID is required' };

    const transactions = await db.transaction.findMany({
      where: {
        userId,
        // Exclude spending tracking records from dashboard display
        description: {
          not: {
            contains: 'spending:'
          }
        }
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
    console.error('Error fetching user transactions:', error);
    return { status: 500, message: 'Failed to fetch user transactions' };
  }
};

/**
 * Get detailed transactions for a child with pagination
 * This is used in the parent dashboard to view activity for a specific child
 */
export const getChildTransactions = async (childId: string, page = 1, pageSize = 10) => {
  try {
    if (!childId) return { status: 400, message: 'Child ID is required' };

    // Calculate pagination
    const skip = (page - 1) * pageSize;

    // Get transactions with pagination
    const transactions = await db.transaction.findMany({
      where: {
        userId: childId,
        // Exclude spending tracking records from dashboard display
        description: {
          not: {
            contains: 'spending:'
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
      include: {
        user: {
          select: {
            name: true,
            image: true,
          },
        },
        family: {
          select: {
            name: true,
            currency: true,
          },
        },
      },
    });

    // Get total count for pagination
    const totalCount = await db.transaction.count({
      where: {
        userId: childId,
        // Exclude spending tracking records from count
        description: {
          not: {
            contains: 'spending:'
          }
        }
      },
    });

    return {
      status: 200,
      data: {
        transactions,
        pagination: {
          total: totalCount,
          page,
          pageSize,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      },
    };
  } catch (error) {
    console.error('Error fetching child transactions:', error);
    return { status: 500, message: 'Failed to fetch child transactions' };
  }
};
