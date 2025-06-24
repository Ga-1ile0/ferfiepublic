'use server';

import { db } from '@/lib/db';
import { ethers } from 'ethers';
import { TransactionType } from '@prisma/client';
import { decryptSensitiveData } from '@/lib/kms-service';
import { availableTokens } from '@/lib/tokens';

interface Token {
  contract: string;
  decimals: number;
  [key: string]: any; // For other properties
}

/**
 * Send funds from parent to child
 * Transfers the specified amount from family wallet to child wallet
 */
export const sendFundsToChild = async (parentId: string, childId: string, amount: number) => {
  try {
    // Validate inputs
    if (!parentId || !childId) {
      return { status: 400, message: 'Parent ID and Child ID are required' };
    }

    if (!amount || amount <= 0) {
      return { status: 400, message: 'Amount must be greater than 0' };
    }

    // Get parent and child information
    const parent = await db.user.findUnique({
      where: { id: parentId },
      include: {
        family: true,
      },
    });

    const child = await db.user.findUnique({
      where: { id: childId },
      include: {
        family: true
      }
    });

    if (!parent) {
      return { status: 404, message: 'Parent not found' };
    }

    if (!child) {
      return { status: 404, message: 'Child not found' };
    }

    if (!parent.family) {
      return { status: 400, message: 'Parent does not have a family' };
    }

    if (!child.address) {
      return { status: 400, message: 'Child has no wallet address' };
    }

    if (child.familyId !== parent.family.id) {
      return { status: 400, message: 'Child does not belong to the parent\'s family' };
    }

    if (!parent.privateKey) {
      return { status: 400, message: 'Parent has no private key' };
    }

    if (!parent.family.currencyAddress) {
      return { status: 400, message: 'Family has no currency address configured' };
    }

    // We'll create the transactions after successful blockchain transfer

    // Perform the blockchain transfer
    try {
      const key = await decryptSensitiveData(parent.privateKey, parent.dek!);
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      const wallet = new ethers.Wallet(key, provider);

      // Create contract instance for the token
      const tokenAbi = ['function transfer(address recipient, uint256 amount) public returns (bool)'];
      const tokenContract = new ethers.Contract(parent.family.currencyAddress, tokenAbi, wallet);

      // Get token decimals from availableTokens or default to 18
      const tokenInfo = availableTokens.find(
        (token: Token) => token.contract.toLowerCase() === (parent.family?.currencyAddress ?? '').toLowerCase()
      );
      const tokenDecimals = tokenInfo?.decimals ?? 18;

      // Convert amount to the correct decimal places
      const amountInWei = ethers.parseUnits(amount.toString(), tokenDecimals);

      // Execute the transfer
      const tx = await tokenContract.transfer(child.address, amountInWei);
      const receipt = await tx.wait();
      
      // Create a transaction record for the child (receiving funds) after successful blockchain transfer
      const childTransaction = await db.transaction.create({
        data: {
          amount: amount,
          type: TransactionType.DEPOSIT,
          description: `You deposited tokens`,
          userId: childId,
          familyId: parent.family.id,
          hash: receipt.hash
        },
      });

      // Create a transaction record for the parent (sending funds) after successful blockchain transfer
      const parentTransaction = await db.transaction.create({
        data: {
          amount: -amount, // Negative amount for outgoing funds
          type: TransactionType.TOKEN_TRANSFER,
          description: `You sent tokens`,
          userId: parentId,
          familyId: parent.family.id,
          hash: receipt.hash
        },
      });

      return {
        status: 200,
        data: {
          childTransaction,
          parentTransaction
        },
        message: 'Funds sent successfully'
      };
    } catch (blockchainError) {
      console.error('Blockchain transfer error:', blockchainError);

      // No database transactions were created since the blockchain transfer failed
      return {
        status: 400,
        message: 'Blockchain transfer failed. No funds were sent.'
      };
    }
  } catch (error) {
    console.error('Error sending funds:', error);
    return { status: 500, message: 'Failed to send funds' };
  }
};

/**
 * Get family balance
 * Retrieves the current balance of the family wallet
 */
export const getFamilyBalance = async (familyId: string) => {
  try {
    if (!familyId) return { status: 400, message: 'Family ID is required' };

    // Get the family information
    const family = await db.family.findUnique({
      where: { id: familyId },
      include: {
        owner: true
      }
    });

    if (!family) {
      return { status: 404, message: 'Family not found' };
    }

    if (!family.currencyAddress) {
      return { status: 400, message: 'Family has no currency address configured' };
    }

    // Get token decimals from availableTokens or default to 18
    const tokenInfo = availableTokens.find(
      (token: Token) => token.contract.toLowerCase() === family.currencyAddress!.toLowerCase()
    );
    const tokenDecimals = tokenInfo?.decimals ?? 18;

    // Create a provider to connect to the blockchain
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    // Create contract instance for the token
    const tokenAbi = ['function balanceOf(address owner) view returns (uint256)'];
    const tokenContract = new ethers.Contract(family.currencyAddress, tokenAbi, provider);

    // Get the balance
    const balanceWei = await tokenContract.balanceOf(family.owner.familyAddress);
    const balance = parseFloat(ethers.formatUnits(balanceWei, tokenDecimals));

    return {
      status: 200,
      data: {
        balance,
        currency: family.currency
      },
      message: 'Family balance retrieved successfully'
    };
  } catch (error) {
    console.error('Error getting family balance:', error);
    return { status: 500, message: 'Failed to get family balance' };
  }
};
