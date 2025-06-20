'use server';

import { db } from '@/lib/db';
import { ethers, parseEther } from 'ethers';
import { revalidatePath } from 'next/cache';
import { getKidPermissions } from '@/server/permissions';
import { availableTokens } from '@/lib/tokens';
import { TransactionType } from '@prisma/client';
import { getExchangeRate } from '@/lib/tokens';
import { PermissionData } from './transfer-types';
import { decryptSensitiveData } from '@/lib/kms-service';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, createWalletClient, Hex, http } from 'viem';
import { base } from 'viem/chains';

// ABI for ERC20 transfer function
const ERC20_ABI = [
  'function transfer(address to, uint amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

interface TransferResult {
  status: number;
  message: string;
  txHash?: string;
}

/**
 * Get a user's private key from the database
 */
async function getUserPrivateKey(userId: string): Promise<string | null> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { privateKey: true, dek: true },
    });

    if (!user) {
      return null;
    }

    const key = await decryptSensitiveData(user?.privateKey!,user?.dek!);
    return key || null;
  } catch (error) {
    console.error('Error fetching user private key:', error);
    return null;
  }
}

/**
 * Get user's family currency address
 */
async function getUserFamilyCurrency(userId: string): Promise<string | null> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        family: {
          select: {
            currencyAddress: true,
          },
        },
      },
    });

    return user?.family?.currencyAddress || null;
  } catch (error) {
    console.error('Error fetching user family currency:', error);
    return null;
  }
}

/**
 * Check if a user has permission to send crypto
 * Returns: {allowed: boolean, reason: string | null}
 */
async function checkTransferPermissions(
  userId: string,
  tokenSymbol: string,
  amount: number,
  recipientAddress: string
): Promise<{ allowed: boolean; reason: string | null }> {
  try {
    // Get permissions
    const permsResponse = await getKidPermissions(userId);
    if (permsResponse.status !== 200 || !permsResponse.data) {
      return { allowed: false, reason: 'Failed to fetch permissions' };
    }

    const permissions = permsResponse.data as PermissionData;

    // Check if trading is enabled
    if (!permissions.tradingEnabled) {
      return { allowed: false, reason: 'Trading is disabled for your account' };
    }

    // Check if the token is allowed
    if (
      permissions.allowedTokenSymbols &&
      permissions.allowedTokenSymbols.length > 0 &&
      !permissions.allowedTokenSymbols.includes(tokenSymbol)
    ) {
      return { allowed: false, reason: `You are not allowed to transfer ${tokenSymbol}` };
    }

    // Check if crypto transfer is enabled
    if (permissions.cryptoTransferEnabled === false) {
      return { allowed: false, reason: 'Crypto transfers are disabled for your account' };
    }

    // Check if recipient is in allowed list (if any are specified)
    if (
      permissions.allowedRecipientAddresses &&
      permissions.allowedRecipientAddresses.length > 0 &&
      !permissions.allowedRecipientAddresses.some(
        (addr: string) => addr.toLowerCase() === recipientAddress.toLowerCase()
      )
    ) {
      return { allowed: false, reason: 'You are not allowed to send to this recipient' };
    }

    // Check max transfer amount (specific to transfers)
    if (permissions.maxTransferAmount !== null && permissions.maxTransferAmount !== undefined) {
      const token = availableTokens.find(t => t.symbol === tokenSymbol);
      if (!token) {
        return { allowed: false, reason: `Token ${tokenSymbol} not found` };
      }

      const familyCurrencyAddress = await getUserFamilyCurrency(userId);
      if (!familyCurrencyAddress) {
        return { allowed: false, reason: 'Family currency not found' };
      }

      const exchangeRate = await getExchangeRate(token.contract, familyCurrencyAddress);
      const valueInFamilyCurrency = amount * exchangeRate;

      if (valueInFamilyCurrency > permissions.maxTransferAmount) {
        return {
          allowed: false,
          reason: `Amount exceeds your maximum transfer limit of ${permissions.maxTransferAmount}`,
        };
      }
    }

    // Check max transfer amount (in family currency)
    if (permissions.maxTradeAmount !== null) {
      // Get token contract
      const token = availableTokens.find(t => t.symbol === tokenSymbol);
      if (!token) {
        return { allowed: false, reason: `Token ${tokenSymbol} not found` };
      }

      // Get family currency address
      const familyCurrencyAddress = await getUserFamilyCurrency(userId);
      if (!familyCurrencyAddress) {
        return { allowed: false, reason: 'Family currency not found' };
      }

      // Get exchange rate and calculate value in family currency
      const exchangeRate = await getExchangeRate(token.contract, familyCurrencyAddress);
      const valueInFamilyCurrency = amount * exchangeRate;

      if (valueInFamilyCurrency > permissions.maxTradeAmount) {
        return {
          allowed: false,
          reason: `Amount exceeds your maximum transfer limit of ${permissions.maxTradeAmount}`,
        };
      }
    }

    return { allowed: true, reason: null };
  } catch (error) {
    console.error('Error checking transfer permissions:', error);
    return { allowed: false, reason: 'An error occurred while checking permissions' };
  }
}

/**
 * Send tokens to another address
 */
export async function sendTokens(
  senderId: string,
  tokenSymbol: string,
  amount: number,
  recipientAddress: string,
  nickname: string
): Promise<TransferResult> {
  try {
    // Validate parameters
    if (!senderId || !tokenSymbol || !amount || !recipientAddress) {
      return { status: 400, message: 'Missing required parameters' };
    }

    // Check permissions
    const permissionCheck = await checkTransferPermissions(
      senderId,
      tokenSymbol,
      amount,
      recipientAddress
    );
    if (!permissionCheck.allowed) {
      return { status: 403, message: permissionCheck.reason || 'Not allowed to transfer tokens' };
    }

    const user = await db.user.findUnique({
      where: { id: senderId },
      include: {
        family: {
          select: {
            currency: true,
            owner: {
              select: {
                privateKey: true,
                dek: true,
              },
            },
          },
        },
      },
    });

    // Get sender private key
    const privateKey = await getUserPrivateKey(senderId);
    if (!privateKey) {
      return { status: 500, message: 'Failed to retrieve private key' };
    }

    // Find token by symbol
    const token = availableTokens.find(t => t.symbol === tokenSymbol);
    if (!token) {
      return { status: 404, message: `Token ${tokenSymbol} not found` };
    }

    // Set up provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    const HARDCODED_GAS_AMOUNT = parseEther('0.000005'); // 0.000005 ETH for gas
       if (balance < HARDCODED_GAS_AMOUNT) {
          const familyKey = await decryptSensitiveData(user?.family?.owner.privateKey!,user?.family?.owner.dek!);
          const publicClient = createPublicClient({ chain: base, transport: http() });
          const gasAcc = privateKeyToAccount(familyKey as Hex);
          const gasClient = createWalletClient({ account: gasAcc, chain: base, transport: http() });
          const gasAddr = gasAcc.address;

          // 1. Fund swap wallet for gas
          const bal = await publicClient.getBalance({ address: gasAddr });
          if (bal < HARDCODED_GAS_AMOUNT) {
            throw new Error('Insufficient balance in gas wallet');
          }

          const gasTx = await gasClient.sendTransaction({
            account: gasAcc,
            to: wallet.address as `0x${string}`,
            value: HARDCODED_GAS_AMOUNT,
            chain: base,
          });
          await publicClient.waitForTransactionReceipt({ hash: gasTx });
        }

    let txHash: string;

    // Handle ETH case (native token)
    if (tokenSymbol === 'ETH') {
      const tx = await wallet.sendTransaction({
        to: recipientAddress,
        value: ethers.parseEther(amount.toString()),
      });

      await tx.wait();
      txHash = tx.hash;
    } else {
      // For ERC20 tokens
      const contract = new ethers.Contract(token.contract, ERC20_ABI, wallet);

      // Get decimals for the token
      const decimals = await contract.decimals();

      // Parse amount with proper decimals
      const tokenAmount = ethers.parseUnits(amount.toString(), decimals);

      // Send tokens
      const tx = await contract.transfer(recipientAddress, tokenAmount);
      await tx.wait();
      txHash = tx.hash;
    }

    // Add transaction to database
    let txamount = 0;
    if (tokenSymbol === user?.family?.currency) {
      txamount = amount;
    }
    await db.transaction.create({
      data: {
        amount: txamount,
        type: TransactionType.TOKEN_TRANSFER,
        hash: txHash,
        description: `Sent ${amount} ${tokenSymbol} to ${nickname}`,
        status: 'completed',
        userId: senderId,
      },
    });

    // Revalidate cache
    revalidatePath('/dashboard');

    return {
      status: 200,
      message: 'Transfer completed successfully',
      txHash,
    };
  } catch (error) {
    console.error('Error sending tokens:', error);
    return {
      status: 500,
      message: error instanceof Error ? error.message : 'Failed to send tokens',
    };
  }
}

/**
 * Get a user's wallet address
 */
export async function getUserAddress(userId: string): Promise<string | null> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { address: true },
    });

    return user?.address || null;
  } catch (error) {
    console.error('Error fetching user address:', error);
    return null;
  }
}
