'use server';

import { db } from '@/lib/db';
import { AllowanceFrequency } from '@prisma/client';

type AllowanceData = {
  amount: number;
  frequency: AllowanceFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
};

/**
 * Set or update an allowance for a child
 * Note: Allowances are now claimable rather than automatically sent
 */
export const setAllowance = async (childId: string, allowanceData: AllowanceData) => {
  try {
    if (!childId) {
      return { status: 400, message: 'Child ID is required' };
    }

    // Validate the allowance data
    if (!allowanceData.amount || allowanceData.amount <= 0) {
      return { status: 400, message: 'Valid amount is required' };
    }

    if (!allowanceData.frequency) {
      return { status: 400, message: 'Frequency is required' };
    }

    // Calculate the next allowance date
    const nextDate = calculateNextAllowanceDate(allowanceData);

    // Check if the child already has an allowance
    const existingAllowance = await db.allowance.findFirst({
      where: { userId: childId },
    });

    let allowance;

    if (existingAllowance) {
      // Update existing allowance
      allowance = await db.allowance.update({
        where: { id: existingAllowance.id },
        data: {
          amount: allowanceData.amount,
          frequency: allowanceData.frequency,
          dayOfWeek:
            allowanceData.frequency === 'WEEKLY'
              ? getDayOfWeekNumber(allowanceData.dayOfWeek)
              : null,
          dayOfMonth: allowanceData.frequency === 'MONTHLY' ? allowanceData.dayOfMonth : null,
          nextDate,
        },
      });
    } else {
      // Create new allowance
      allowance = await db.allowance.create({
        data: {
          amount: allowanceData.amount,
          frequency: allowanceData.frequency,
          dayOfWeek:
            allowanceData.frequency === 'WEEKLY'
              ? getDayOfWeekNumber(allowanceData.dayOfWeek)
              : null,
          dayOfMonth: allowanceData.frequency === 'MONTHLY' ? allowanceData.dayOfMonth : null,
          nextDate,
          userId: childId,
        },
      });
    }

    // No longer creating a transaction record here
    // Transactions will be created when the allowance is claimed

    return {
      status: 200,
      data: allowance,
      message: 'Allowance set successfully',
    };
  } catch (error) {
    console.error('Error setting allowance:', error);
    return { status: 500, message: 'Failed to set allowance' };
  }
};

/**
 * Get allowance for a child
 */
export const getChildAllowance = async (childId: string) => {
  try {
    if (!childId) {
      return { status: 400, message: 'Child ID is required' };
    }

    const allowance = await db.allowance.findFirst({
      where: { userId: childId },
    });

    return {
      status: 200,
      data: allowance,
      message: allowance ? 'Allowance found' : 'No allowance set',
    };
  } catch (error) {
    console.error('Error getting allowance:', error);
    return { status: 500, message: 'Failed to get allowance' };
  }
};

/**
 * Get all allowances for a parent's children
 */
export const getChildrenAllowances = async (parentId: string) => {
  try {
    if (!parentId) {
      return { status: 400, message: 'Parent ID is required' };
    }

    // Get the parent's family
    const family = await db.family.findFirst({
      where: { parentId },
      include: {
        members: {
          where: { role: 'KID' },
          include: { allowances: true },
        },
      },
    });

    if (!family) {
      return { status: 404, message: 'Family not found' };
    }

    return {
      status: 200,
      data: family.members,
      message: 'Children allowances retrieved',
    };
  } catch (error) {
    console.error('Error getting children allowances:', error);
    return { status: 500, message: 'Failed to get children allowances' };
  }
};

/**
 * Helper function to calculate the next allowance date based on frequency
 */
function calculateNextAllowanceDate(allowanceData: AllowanceData): Date {
  const now = new Date();
  let nextDate = new Date(now);

  switch (allowanceData.frequency) {
    case 'DAILY':
      // Next day
      nextDate.setDate(now.getDate() + 1);
      break;
    case 'WEEKLY':
      // Next occurrence of the specified day of week
      const dayOfWeek = getDayOfWeekNumber(allowanceData.dayOfWeek);
      const daysUntilNext = (dayOfWeek - now.getDay() + 7) % 7;
      nextDate.setDate(now.getDate() + (daysUntilNext === 0 ? 7 : daysUntilNext));
      break;
    case 'MONTHLY':
      // Next occurrence of the specified day of month
      const dayOfMonth = allowanceData.dayOfMonth || 1;
      nextDate.setMonth(now.getMonth() + 1);
      nextDate.setDate(
        Math.min(dayOfMonth, getDaysInMonth(nextDate.getFullYear(), nextDate.getMonth()))
      );
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

/**
 * Helper function to convert day of week string to number (0-6, Sunday-Saturday)
 */
function getDayOfWeekNumber(dayOfWeek?: number | string): number {
  if (typeof dayOfWeek === 'number' && dayOfWeek >= 0 && dayOfWeek <= 6) {
    return dayOfWeek;
  }

  // Default to Monday (1) if not specified or invalid
  if (!dayOfWeek) return 1;

  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  return dayMap[dayOfWeek.toString().toLowerCase()] || 1;
}
