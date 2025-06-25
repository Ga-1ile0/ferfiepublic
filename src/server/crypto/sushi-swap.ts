'use server';

import { getSwap, ChainId } from 'sushi';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  zeroAddress,
  formatEther,
  parseEther,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { db } from '@/lib/db';
import { createTransaction } from '@/server/transaction';
import { TransactionType } from '@prisma/client';
import { decryptSensitiveData } from '@/lib/kms-service';
import { recordSpending } from '@/server/spending-tracker';

// Constants
//@ts-ignore
const MAX_UINT256 = 2n ** 256n - 1n;
const HARDCODED_GAS_AMOUNT = parseEther('0.000005'); // 0.000005 ETH for gas
const SUSHI_ROUTER = '0xAC4c6e212A361c968F1725b4d055b47E63F80b75';
const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function transfer(address recipient, uint256 amount) public returns (bool)',
]);
const platformFeeAddress = '0xfE4F1E808B8594d03C3B693fa4726cd323fFEeA5';
const platformFeePercentage = 0.02;

export async function executeSushiSwap(
  userId: string,
  fromToken: string,
  toToken: string, // Keep original toToken here
  amountIn: bigint,
  minAmountOut: bigint,
  fromSymbol: string,
  toSymbol: string,
  isTrade: boolean,
  amountInStable: number
) {
  try {
    // Fetch user and family (parent) keys
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { family: { include: { owner: true } } },
    });

    // This logic for Sushi API input/output is fine
    let checkedFrom = fromToken;
    let checkedTo = toToken;
    if (fromToken === zeroAddress) {
      checkedFrom = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }
    if (toToken === zeroAddress) {
      checkedTo = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    }

    if (!user?.privateKey || !user.family?.owner.privateKey) {
      throw new Error('Missing private keys for swap or gas wallet');
    }
    const key = await decryptSensitiveData(user.privateKey!,user.dek!);

    // Setup clients and accounts
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const swapAcc = privateKeyToAccount(key as Hex);
    const swapClient = createWalletClient({ account: swapAcc, chain: base, transport: http() });
    const swapAddr = swapAcc.address;

    const balance = await publicClient.getBalance({ address: swapAddr });
    if (balance < HARDCODED_GAS_AMOUNT) {
      const familyKey = await decryptSensitiveData(user.family.owner.privateKey!,user.family.owner.dek!);
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
        to: swapAddr,
        value: HARDCODED_GAS_AMOUNT,
        chain: base,
      });
      await publicClient.waitForTransactionReceipt({ hash: gasTx });
    }

    // 2. Approve router to spend token
    // Using checkedFrom here is correct for the approval step targeting the Sushi router
    if (checkedFrom !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
      const allowance = await publicClient.readContract({
        address: fromToken as `0x${string}`,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [swapAddr, SUSHI_ROUTER],
      });
      if ((allowance as bigint) < amountIn) {
        const apprTx = await swapClient.writeContract({
          account: swapAcc,
          address: fromToken as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [SUSHI_ROUTER, MAX_UINT256],
          chain: base,
        });
        await publicClient.waitForTransactionReceipt({ hash: apprTx });
      }
    }

    // 3. Build swap transaction via Sushi API
    const swapResult = await getSwap({
      chainId: ChainId.BASE,
      tokenIn: checkedFrom as `0x${string}`,
      tokenOut: checkedTo as `0x${string}`,
      sender: swapAddr,
      amount: amountIn,
      maxSlippage: 0.02,
    });

    if (swapResult.status !== 'Success' || !('tx' in swapResult)) {
      throw new Error(
        `Swap quote failed: ${'error' in swapResult && swapResult.error ? String(swapResult.error) : 'unknown error'}`
      );
    }

    // 4. Log pending trade
    const record = await db.tokenTrade.create({
      data: {
        userId,
        fromAmount: parseFloat(formatEther(amountIn)),
        toAmount: parseFloat(formatEther(minAmountOut)),
        fromToken: fromSymbol as any,
        toToken: toSymbol as any,
        exchangeRate: parseFloat(formatEther(minAmountOut)) / parseFloat(formatEther(amountIn)),
        txHash: '',
      },
    });

    // 5. Execute swap
    const tx = swapResult.tx;
    const swapHash = await swapClient.sendTransaction({
      account: swapAcc,
      to: tx.to,
      data: tx.data,
      value: tx.value || BigInt(0),
      chain: base,
    });
    await publicClient.waitForTransactionReceipt({ hash: swapHash });

    // 5. Send platform fee
    if (isTrade) {
      // Calculate 2% fee from minAmountOut (output token)
      const feeAmount =
        (BigInt(minAmountOut) * BigInt(Math.floor(platformFeePercentage * 10000))) / BigInt(10000);
      // Correctly determine if the fee token is native
      const isNative =
        toToken === zeroAddress || checkedTo === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // Use original toToken or checkedTo check

      if (feeAmount > 0n) {
        if (isNative) {
          // Send native ETH
          const feeTxHash = await swapClient.sendTransaction({
            account: swapAcc,
            to: platformFeeAddress,
            value: feeAmount,
            chain: base,
          });
          await publicClient.waitForTransactionReceipt({ hash: feeTxHash });
        } else {
          // Send ERC20 token
          // Use the original `toToken` address for the ERC20 contract interaction
          // No need for the intermediate `erc20FeeContract` object or redundant `tokenAbi`
          const feeTxHash = await swapClient.writeContract({
            account: swapAcc, // Use the swap wallet account
            address: toToken as `0x${string}`, // Use the original toToken address as the contract address
            abi: erc20Abi, // Use the defined erc20Abi
            functionName: 'transfer',
            args: [platformFeeAddress as `0x${string}`, feeAmount], // Cast platformFeeAddress for type safety
            chain: base, // Ensure correct chain is specified
          });
          await publicClient.waitForTransactionReceipt({ hash: feeTxHash });
        }
      }
    }

    // 6. Update trade record
    await db.tokenTrade.update({
      where: { id: record.id },
      data: { txHash: swapHash, completedAt: new Date() },
    });

    // 7. Log transaction using helper
    // Assuming fee is calculated on minAmountOut before deduction for logging
    const netAmountOut = isTrade
      ? minAmountOut -
        (BigInt(minAmountOut) * BigInt(Math.floor(platformFeePercentage * 10000))) / BigInt(10000)
      : minAmountOut;
    await createTransaction(
      userId,
      Number(amountInStable.toFixed(2)), // Log the net amount
      TransactionType.TOKEN_TRADE,
      swapHash,
      `Swap ${fromSymbol} to ${toSymbol}`,
      user.family?.id
    );

    // 8. Record spending for daily limits tracking
    if (isTrade) {
      await recordSpending({
        userId,
        category: 'TRADING',
        originalAmount: Number(amountInStable.toFixed(2)),
        originalToken: 'USD',
        amountInStablecoin: Number(amountInStable.toFixed(2)),
        transactionHash: swapHash
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error('executeSushiSwap error:', err);
    return { success: false, message: err.message || 'Swap failed' };
  }
}
