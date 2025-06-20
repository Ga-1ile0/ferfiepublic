'use server';

import { ethers } from 'ethers';
import { db } from '@/lib/db';
import { decryptSensitiveData } from '@/lib/kms-service';

const tokenAbi = [
  'function transfer(address recipient, uint256 amount) public returns (bool)',
  'function decimals() view returns (uint8)',
];

export const withdrawalFunds = async (userId: string, amount: string) => {
  if (!userId || !amount) {
    return { status: 400, error: 'Missing userId or amount' };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      family: true,
    },
  });
  if (!user) {
    return { status: 404, error: 'User not found' };
  }
  if (!user.family?.currencyAddress || !user.privateKey) {
    return { status: 400, error: 'Family wallet not configured' };
  }
  if (!user.address) {
    return { status: 400, error: 'User on-chain address missing' };
  }

  try {
    const key = await decryptSensitiveData(user.privateKey!,user.dek!);
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) throw new Error('RPC_URL not set in env');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const familyWallet = new ethers.Wallet(key, provider);

    const tokenContract = new ethers.Contract(user.family.currencyAddress, tokenAbi, familyWallet);

    const decimals: number = await tokenContract.decimals();

    const amountBn = ethers.parseUnits(amount, decimals);

    const tx = await tokenContract.transfer(user.address, amountBn);

    const receipt = await tx.wait();
    if (receipt.status !== 1) {
      return { status: 500, error: 'Transaction failed on-chain' };
    }

    return {
      status: 200,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
    };
  } catch (err: any) {
    console.error('withdrawalFunds error:', err);
    return {
      status: 500,
      error: err.message ?? 'Unknown error during withdrawal',
    };
  }
};
