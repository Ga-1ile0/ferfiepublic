'use server';

import { db } from '@/lib/db';
import { ChoreStatus, TransactionType } from '@prisma/client';
import { Chore } from '../types';
import { ethers } from 'ethers';
import { decryptSensitiveData } from '@/lib/kms-service';
import { availableTokens } from '@/lib/tokens';

interface Token {
  contract: string;
  decimals: number;
  [key: string]: any; // For other properties we don't care about
}

export type ChoreAssignmentType = 'individual' | 'all' | 'first-to-complete';

interface CreateChoreParams {
  title: string;
  description?: string;
  reward: number;
  dueDate?: Date;
  createdById: string;
  assignmentType: ChoreAssignmentType;
  assignedToId?: string; // Required for individual assignment
  familyId?: string; // Required for 'all' and 'first-to-complete' assignments
}

interface UpdateChoreParams {
  id: string;
  title?: string;
  description?: string;
  reward?: number;
  dueDate?: Date;
  status?: ChoreStatus;
  evidence?: string;
  feedback?: string;
  completedAt?: Date;
}

interface CompleteChoreParams {
  id: string;
  evidence?: string;
  childId: string;
}

interface ApproveChoreParams {
  id: string;
  feedback?: string;
  parentId: string;
}

interface RejectChoreParams {
  id: string;
  feedback: string;
  parentId: string;
}

// Create a new chore
export async function createChore(params: CreateChoreParams) {
  try {
    const { assignmentType, familyId, ...choreData } = params;

    // For individual assignment
    if (assignmentType === 'individual') {
      if (!params.assignedToId) {
        return { status: 400, message: 'assignedToId is required for individual chores' };
      }

      const chore = await db.chore.create({
        data: {
          ...choreData,
          assignmentType: 'individual',
          assignedToId: params.assignedToId,
        },
      });

      return { status: 201, data: chore };
    }

    // For 'all' or 'first-to-complete' assignments
    if (!familyId) {
      return { status: 400, message: 'familyId is required for all or first-to-complete chores' };
    }

    // Get all children in the family
    const familyChildren = await db.user.findMany({
      where: {
        familyId,
        role: 'KID',
      },
    });

    if (familyChildren.length === 0) {
      return { status: 404, message: 'No children found in this family' };
    }

    // Create a chore for each child or just the first one based on assignment type
    if (assignmentType === 'all') {
      // Create a chore for each child
      const chores = await Promise.all(
        familyChildren.map(child =>
          db.chore.create({
            data: {
              ...choreData,
              assignmentType: 'all',
              familyId,
              assignedToId: child.id,
            },
          })
        )
      );

      return { status: 201, data: chores };
    } else {
      // For first-to-complete, create a chore for each child but mark them as first-to-complete
      // This way, when one child completes it, we can handle it appropriately
      const chores = await Promise.all(
        familyChildren.map(child =>
          db.chore.create({
            data: {
              ...choreData,
              assignmentType: 'first-to-complete',
              familyId,
              isFirstToComplete: true,
              assignedToId: child.id,
            },
          })
        )
      );

      return { status: 201, data: chores };
    }
  } catch (error) {
    console.error('Error creating chore:', error);
    return { status: 500, message: 'Failed to create chore' };
  }
}

// Get chores for a specific child
export async function getChoresByChildId(childId: string): Promise<{ status: number; data: Chore[] } | { status: number; message: string }> {
  try {
    if (!childId) return { status: 400, message: 'Child ID is required' };

    const chores = await db.chore.findMany({
      where: {
        assignedToId: childId,
      },
      include: {
        assignedTo: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Check for expired chores (past due date but still active)
    const processedChores = chores.map(chore => {
      // Format first-to-complete chores to show in the UI
      if (chore.isFirstToComplete && chore.status === 'ACTIVE') {
        return {
          ...chore,
          title: `${chore.title} (First to Complete)`,
        };
      }

      // Use the exact due date time for expiration check instead of setting to end of day
      const dueDateEnd = new Date(chore.dueDate ? chore.dueDate.getTime() : new Date().getTime());
      if (chore.status === 'ACTIVE' && chore.dueDate && dueDateEnd < new Date()) {
        // Update the chore status to EXPIRED in the database
        db.chore.update({
          where: { id: chore.id },
          data: { status: 'EXPIRED' },
        }).catch(err => console.error(`Failed to update expired chore ${chore.id}:`, err));

        // Return the chore with updated status for the frontend
        return { ...chore, status: 'EXPIRED' };
      }
      return chore;
    });
// @ts-ignore
    return { status: 200, data: processedChores };
  } catch (error) {
    console.error('Error fetching chores for child:', error);
    return { status: 500, message: 'Failed to fetch chores' };
  }
}

// Get chores created by a specific parent
export async function getChoresByParentId(parentId: string) {
  try {
    const chores = await db.chore.findMany({
      where: {
        createdById: parentId,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { status: 200, data: chores };
  } catch (error) {
    console.error('Error fetching chores:', error);
    return { status: 500, message: 'Failed to fetch chores' };
  }
}

// Get chores for a specific family
export async function getChoresByFamilyId(familyId: string) {
  try {
    // Get all family members
    const familyMembers = await db.user.findMany({
      where: {
        familyId,
      },
      select: {
        id: true,
      },
    });

    const memberIds = familyMembers.map(member => member.id);

    // Get all chores assigned to family members
    const chores = await db.chore.findMany({
      where: {
        OR: [
          {
            assignedToId: {
              in: memberIds,
            },
          },
          {
            createdById: {
              in: memberIds,
            },
          },
        ],
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { status: 200, data: chores };
  } catch (error) {
    console.error('Error fetching family chores:', error);
    return { status: 500, message: 'Failed to fetch family chores' };
  }
}

// Update a chore
export async function updateChore(params: UpdateChoreParams) {
  try {
    const { id, ...updateData } = params;

    const chore = await db.chore.update({
      where: { id },
      data: updateData,
    });

    return { status: 200, data: chore };
  } catch (error) {
    console.error('Error updating chore:', error);
    return { status: 500, message: 'Failed to update chore' };
  }
}

// Mark a chore as completed by a child
export async function completeChore(params: CompleteChoreParams) {
  try {
    const { id, evidence, childId } = params;

    // Verify the chore belongs to this child
    const chore = await db.chore.findFirst({
      where: {
        id,
        assignedToId: childId,
      },
    });

    if (!chore) {
      return { status: 404, message: 'Chore not found or not assigned to this child' };
    }

    // Check if the chore is already completed or pending approval
    if (chore.status !== ChoreStatus.ACTIVE) {
      return {
        status: 400,
        message: `Chore cannot be completed because it is ${chore.status.toLowerCase()}`
      };
    }

    // Update the chore status
    const updatedChore = await db.chore.update({
      where: { id },
      data: {
        status: ChoreStatus.PENDING_APPROVAL,
        evidence,
        completedAt: new Date(),
      },
    });

    // If this is a first-to-complete chore, mark all other related chores as expired
    if (chore.isFirstToComplete && chore.familyId) {
      // Find all other chores with the same title in the family that are still active
      await db.chore.updateMany({
        where: {
          id: { not: id },
          title: chore.title,
          familyId: chore.familyId,
          isFirstToComplete: true,
          status: ChoreStatus.ACTIVE,
        },
        data: {
          status: ChoreStatus.EXPIRED,
        },
      });
    }

    return { status: 200, data: updatedChore };
  } catch (error) {
    console.error('Error completing chore:', error);
    return { status: 500, message: 'Failed to complete chore' };
  }
}

// Approve a completed chore
export async function approveChore(params: ApproveChoreParams) {
  try {
    const { id, feedback, parentId } = params;

    // Verify the chore was created by this parent
    const chore = await db.chore.findFirst({
      where: {
        id,
        createdById: parentId,
      },
      include: {
        assignedTo: true,
      },
    });

    if (!chore) {
      return { status: 404, message: 'Chore not found or not created by this parent' };
    }

    // Check if the chore is pending approval
    if (chore.status !== ChoreStatus.PENDING_APPROVAL) {
      return {
        status: 400,
        message: `Chore cannot be approved because it is ${chore.status.toLowerCase()}`
      };
    }
    // Transfer the reward to the child
    const transferResult = await transferReward(chore.assignedToId, chore.reward, `Reward for completing: ${chore.title}`);

    if (transferResult.status !== 200) {
      return { status: transferResult.status, message: transferResult.message || 'Failed to transfer reward' };
    }

    // Update the chore status
    const updatedChore = await db.chore.update({
      where: { id },
      data: {
        status: ChoreStatus.COMPLETED,
        feedback,
      },
    });


    // If this was a first-to-complete chore, make sure all other related chores are expired
    if (chore.isFirstToComplete && chore.familyId) {
      await db.chore.updateMany({
        where: {
          id: { not: id },
          title: chore.title,
          familyId: chore.familyId,
          isFirstToComplete: true,
          status: { not: ChoreStatus.COMPLETED }, // Don't change completed chores
        },
        data: {
          status: ChoreStatus.EXPIRED,
        },
      });
    }

    return { status: 200, data: updatedChore };
  } catch (error) {
    console.error('Error approving chore:', error);
    return { status: 500, message: 'Failed to approve chore' };
  }
}

// Reject a completed chore
export async function rejectChore(params: RejectChoreParams) {
  try {
    const { id, feedback, parentId } = params;

    // Verify the chore was created by this parent
    const chore = await db.chore.findFirst({
      where: {
        id,
        createdById: parentId,
      },
    });

    if (!chore) {
      return { status: 404, message: 'Chore not found or not created by this parent' };
    }

    // Check if the chore is pending approval
    if (chore.status !== ChoreStatus.PENDING_APPROVAL) {
      return {
        status: 400,
        message: `Chore cannot be rejected because it is ${chore.status.toLowerCase()}`
      };
    }

    // Update the chore status
    const updatedChore = await db.chore.update({
      where: { id },
      data: {
        status: ChoreStatus.REJECTED,
        feedback,
      },
    });

    return { status: 200, data: updatedChore };
  } catch (error) {
    console.error('Error rejecting chore:', error);
    return { status: 500, message: 'Failed to reject chore' };
  }
}

// Transfer reward to a child
export async function transferReward(childId: string, amount: number, description: string) {
  try {
    if (!childId) return { status: 400, message: 'Child ID is required' };
    if (amount <= 0) return { status: 400, message: 'Amount must be greater than 0' };

    // Get the child's information including their wallet address
    const child = await db.user.findUnique({
      where: { id: childId },
      include: {
        family: true
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

    // Create a transaction record for the reward
    const transaction = await db.transaction.create({
      data: {
        amount,
        type: TransactionType.CHORE_REWARD,
        description,
        userId: childId,
        familyId: child.familyId
      },
    });

    // Perform the blockchain transfer
    try {
      const key = await decryptSensitiveData(family.owner.privateKey!,family.owner.dek!);
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const wallet = new ethers.Wallet(key, provider);

      // Create contract instance for the token
      const tokenAbi = ['function transfer(address recipient, uint256 amount) public returns (bool)'];
      const tokenContract = new ethers.Contract(family.currencyAddress, tokenAbi, wallet);

      if (!family.currencyAddress) {
        throw new Error('Family has no currency address configured');
      }

      // Get token decimals from availableTokens or default to 18
      const tokenInfo = availableTokens.find(
        (token: Token) => token.contract.toLowerCase() === family.currencyAddress!.toLowerCase()
      );
      const tokenDecimals = tokenInfo?.decimals ?? 18;

      // Convert amount to the correct decimal places
      const amountInWei = ethers.parseUnits(amount.toString(), tokenDecimals);

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
        message: 'Reward transferred successfully'
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
    console.error('Error transferring reward:', error);
    return { status: 500, message: 'Failed to transfer reward' };
  }
}

// Delete a chore
export async function deleteChore(id: string, parentId: string) {
  try {
    // Verify the chore was created by this parent
    const chore = await db.chore.findFirst({
      where: {
        id,
        createdById: parentId,
      },
    });

    if (!chore) {
      return { status: 404, message: 'Chore not found or not created by this parent' };
    }

    // Delete the chore
    await db.chore.delete({
      where: { id },
    });

    return { status: 200, message: 'Chore deleted successfully' };
  } catch (error) {
    console.error('Error deleting chore:', error);
    return { status: 500, message: 'Failed to delete chore' };
  }
}
