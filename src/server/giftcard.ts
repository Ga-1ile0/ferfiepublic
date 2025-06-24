'use server';

import { db } from '@/lib/db';
import { decryptSensitiveData } from '@/lib/kms-service';
import { createPublicClient, createWalletClient, http, parseEther, parseUnits, formatUnits, zeroAddress, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { TransactionType } from '@prisma/client';
import { devLog } from '@/lib/devlog';

// Placeholder for BandoRouterProxy address - should be in .env
const BANDO_ROUTER_PROXY_ADDRESS = (process.env.BANDO_ROUTER_PROXY_ADDRESS || '0x2D9A53f52dD0Cdc922140bE6893381330a9e39FC') as Hex;
const HARDCODED_GAS_AMOUNT = parseEther('0.0000025'); // For funding user wallet if needed

const ERC20_APPROVE_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
        { "internalType": "address", "name": "owner", "type": "address" },
        { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const BANDO_ROUTER_ABI = [
  {
    "type": "function",
    "name": "requestService",
    "inputs": [
      { "name": "serviceID", "type": "uint256", "internalType": "uint256" },
      {
        "name": "request",
        "type": "tuple",
        "internalType": "struct FulFillmentRequest",
        "components": [
          { "name": "payer", "type": "address", "internalType": "address" },
          { "name": "weiAmount", "type": "uint256", "internalType": "uint256" },
          { "name": "fiatAmount", "type": "uint256", "internalType": "uint256" },
          { "name": "serviceRef", "type": "string", "internalType": "string" }
        ]
      }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "requestERC20Service",
    "inputs": [
      { "name": "serviceID", "type": "uint256", "internalType": "uint256" },
      {
        "name": "request",
        "type": "tuple",
        "internalType": "struct ERC20FulFillmentRequest",
        "components": [
          { "name": "payer", "type": "address", "internalType": "address" },
          { "name": "fiatAmount", "type": "uint256", "internalType": "uint256" },
          { "name": "serviceRef", "type": "string", "internalType": "string" },
          { "name": "token", "type": "address", "internalType": "address" },
          { "name": "tokenAmount", "type": "uint256", "internalType": "uint256" }
        ]
      }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "nonpayable"
  },
  { "type": "error", "name": "AddressEmptyCode", "inputs": [{ "name": "target", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "AddressInsufficientBalance", "inputs": [{ "name": "account", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "ERC1967InvalidImplementation", "inputs": [{ "name": "implementation", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "ERC1967NonPayable", "inputs": [] },
  { "type": "error", "name": "EnforcedPause", "inputs": [] },
  { "type": "error", "name": "ExpectedPause", "inputs": [] },
  { "type": "error", "name": "FailedInnerCall", "inputs": [] },
  { "type": "error", "name": "InsufficientAmount", "inputs": [] },
  { "type": "error", "name": "InvalidAddress", "inputs": [{ "name": "address_", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "InvalidFiatAmount", "inputs": [] },
  { "type": "error", "name": "InvalidInitialization", "inputs": [] },
  { "type": "error", "name": "InvalidRef", "inputs": [] },
  { "type": "error", "name": "NotInitializing", "inputs": [] },
  { "type": "error", "name": "OwnableInvalidOwner", "inputs": [{ "name": "owner", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "OwnableUnauthorizedAccount", "inputs": [{ "name": "account", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "PayerMismatch", "inputs": [{ "name": "payer", "type": "address", "internalType": "address" }, { "name": "sender", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "SafeERC20FailedOperation", "inputs": [{ "name": "token", "type": "address", "internalType": "address" }] },
  { "type": "error", "name": "UUPSUnauthorizedCallContext", "inputs": [] },
  { "type": "error", "name": "UUPSUnsupportedProxiableUUID", "inputs": [{ "name": "slot", "type": "bytes32", "internalType": "bytes32" }] },
  { "type": "error", "name": "UnsupportedToken", "inputs": [{ "name": "token", "type": "address", "internalType": "address" }] }
] as const;

interface PurchaseGiftCardParams {
  userId: string;
  variantSku: string;
  evmServiceId: number; // from variant.evmServiceId
  quoteId: string; // from quote.data.id, used for logging or other purposes
  validationId?: string; // from /references/ API response (data.validationId), used as serviceRef
  fiatAmountForContract: string; // fiatAmount from quote, formatted (multiplied by 100, toFixed(0))
  paymentToken: {
    contract: string; // Address of the payment token, or NATIVE_ETH_SENTINEL
    decimals: number;
    symbol: string;
  };
  digitalAssetAmountFromQuote: string; // from quote.data.digitalAssetAmount (amount of crypto for contract)
  totalAmountFromQuoteInWeiForNative?: bigint; // msg.value for native token purchase, from quote.data.totalAmount
  brandName: string;
  fiatCurrency: string; // e.g., "USD", for logging purposes
}

export async function purchaseGiftCardServerAction(
  params: PurchaseGiftCardParams
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  devLog.log('[purchaseGiftCardServerAction] Received params:', params);

  const {
    userId,
    variantSku,
    evmServiceId,
    quoteId, // Retained for now, ensure it's clear this is not for serviceRef
    validationId,
    fiatAmountForContract,
    paymentToken,
    digitalAssetAmountFromQuote,
    totalAmountFromQuoteInWeiForNative,
    brandName
  } = params;

  try {
    // 1. Fetch user and permissions
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        family: { include: { owner: true } },
        permissions: true,
      },
    });

    if (!user) return { success: false, error: 'User not found' };
    if (!user.privateKey || !user.dek) return { success: false, error: 'User private key not found' };
    if (!user.address) return { success: false, error: 'User wallet address not found' };
    if (!user.family?.owner?.privateKey || !user.family?.owner?.dek) return { success: false, error: 'Family owner private key not found for gas funding.' };

    const userEmail = user.permissions?.giftCardEmail || user.email;
    if (!userEmail) {
      return { success: false, error: 'No email address found for gift card delivery. Please set it in your profile or ask your parent to set it in permissions.' };
    }

    // 2. Decrypt private key and set up wallet
    const decryptedUserKey = await decryptSensitiveData(user.privateKey, user.dek);
    const userAccount = privateKeyToAccount(decryptedUserKey as Hex);

    const publicClient = createPublicClient({ chain: base, transport: http() });
    const userWalletClient = createWalletClient({
      account: userAccount,
      chain: base,
      transport: http(),
    });

    // 3. Check user's ETH balance for gas, fund if necessary from family wallet
    const userEthBalance = await publicClient.getBalance({ address: userAccount.address });
    if (userEthBalance < HARDCODED_GAS_AMOUNT) {
      devLog.log(`[purchaseGiftCardServerAction] User ETH balance ${formatUnits(userEthBalance, 18)} is low. Attempting to fund from family wallet.`);
      const familyKey = await decryptSensitiveData(user.family.owner.privateKey, user.family.owner.dek);
      const familyAccount = privateKeyToAccount(familyKey as Hex);
      const familyWalletClient = createWalletClient({ account: familyAccount, chain: base, transport: http() });

      const familyEthBalance = await publicClient.getBalance({ address: familyAccount.address });
      if (familyEthBalance < HARDCODED_GAS_AMOUNT) {
        return { success: false, error: 'Insufficient ETH in family wallet for gas.' };
      }

      const gasTxHash = await familyWalletClient.sendTransaction({
        to: userAccount.address,
        value: HARDCODED_GAS_AMOUNT,
      });
      devLog.log(`[purchaseGiftCardServerAction] Sent gas to user: ${gasTxHash}`);
      await publicClient.waitForTransactionReceipt({ hash: gasTxHash });
      devLog.log('[purchaseGiftCardServerAction] Gas transaction confirmed.');
    }

    let purchaseTxHash: Hex | undefined;
    let serviceRef = validationId;
    const tokenAmountInSmallestUnit = parseUnits(digitalAssetAmountFromQuote, paymentToken.decimals);

    // Create initial pending transaction record in DB first, so we can update it in case of errors
    const dbTxRecord = await db.transaction.create({
      data: {
        amount: parseFloat(formatUnits(tokenAmountInSmallestUnit, paymentToken.decimals)), // Store amount in token's main unit
        type: TransactionType.GIFT_CARD_PURCHASE,
        description: `Purchase ${brandName} Gift Card for ${parseFloat(fiatAmountForContract)/100} ${params.fiatCurrency || 'USD'}`, // fiatAmountForContract is in cents
        status: 'pending',
        userId: user.id,
        familyId: user.familyId || undefined,
      },
    });

    // Check if validationId is provided from client-side validation
    if (serviceRef) {
      devLog.log('[purchaseGiftCardServerAction] Using validationId provided from client:', serviceRef);
    } else {
      // If validationId is not provided, call the /references/ API from server to get one
      // This is a fallback in case client-side validation fails or is not implemented
      try {
        devLog.log('[purchaseGiftCardServerAction] No validationId provided, calling /references/ API as fallback');

        // Prepare the request payload for the /references/ API
        const referencePayload = {
          reference: userEmail, // Use the user's email as the reference
          requiredFields: [
            {
              key: "Name",
              value: user.name || "User" // Use the user's name or default to "User"
            }
          ],
          transactionIntent: {
            sku: variantSku,
            quantity: 1,
            amount: parseFloat(fiatAmountForContract) / 100, // Convert from cents to dollars
            chain: "8453", // Base chain ID
            token: paymentToken.contract,
            wallet: userAccount.address,
            integrator: "ferfiefam-app",
            has_accepted_terms: true,
            quote_id: parseInt(quoteId)
          }
        };

        // Call the /references/ API
        const response = await fetch('https://api.bando.money/references/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*'
          },
          body: JSON.stringify(referencePayload)
        });

        if (!response.ok) {
          throw new Error(`Failed to validate reference: ${response.status} ${response.statusText}`);
        }

        const responseData = await response.json();
        devLog.log('[purchaseGiftCardServerAction] Reference validation response:', responseData);

        if (responseData.error) {
          throw new Error(`Reference validation error: ${responseData.error}`);
        }

        // Extract the validationId from the response
        serviceRef = responseData.data?.validationId;

        if (!serviceRef) {
          throw new Error('No validationId returned from reference validation');
        }

        devLog.log('[purchaseGiftCardServerAction] Obtained validationId from server fallback:', serviceRef);
      } catch (error: any) {
        devLog.error('[purchaseGiftCardServerAction] Error validating reference:', error);
        await db.transaction.update({
          where: { id: dbTxRecord.id },
          data: { status: 'error', description: `Reference validation error: ${error.message}` }
        });
        throw new Error(`Failed to validate reference: ${error.message}`);
      }
    }

      // ERC20 Token purchase
      // 4a. Approve BandoRouterProxy to spend tokens
      const currentAllowance = await publicClient.readContract({
        address: paymentToken.contract as Hex,
        abi: ERC20_APPROVE_ABI,
        functionName: 'allowance',
        args: [userAccount.address, BANDO_ROUTER_PROXY_ADDRESS],
      });

      devLog.log(`[purchaseGiftCardServerAction] Current allowance: ${currentAllowance}, Required amount: ${tokenAmountInSmallestUnit}`);

      // Always approve the exact amount needed to ensure sufficient allowance
      // This is safer than checking if currentAllowance < tokenAmountInSmallestUnit
      // because some tokens may have approval issues or require resetting allowance
      devLog.log(`[purchaseGiftCardServerAction] Approving ${BANDO_ROUTER_PROXY_ADDRESS} to spend ${tokenAmountInSmallestUnit} of ${paymentToken.symbol}`);
      // Add a 5% buffer to the approval amount to ensure there's enough allowance
      const bufferMultiplier = 105n; // 105% of the required amount
      const bufferDivisor = 100n;
      const approvalAmount = (tokenAmountInSmallestUnit * bufferMultiplier) / bufferDivisor;

      devLog.log(`[purchaseGiftCardServerAction] Approving with buffer: Required ${tokenAmountInSmallestUnit}, Approving ${approvalAmount}`);

      const approveTxHash = await userWalletClient.writeContract({
        address: paymentToken.contract as Hex,
        abi: ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [BANDO_ROUTER_PROXY_ADDRESS, approvalAmount],
      });

      // Wait for the approval transaction to be confirmed
      const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
      devLog.log(`[purchaseGiftCardServerAction] Approval transaction ${approveTxHash} confirmed with status: ${approvalReceipt.status}`);

      // Verify the allowance after approval to ensure it was successful
      const newAllowance = await publicClient.readContract({
        address: paymentToken.contract as Hex,
        abi: ERC20_APPROVE_ABI,
        functionName: 'allowance',
        args: [userAccount.address, BANDO_ROUTER_PROXY_ADDRESS],
      });

      devLog.log(`[purchaseGiftCardServerAction] New allowance after approval: ${newAllowance}`);

      if (newAllowance < tokenAmountInSmallestUnit) {
        throw new Error(`Failed to approve token spending. Required: ${tokenAmountInSmallestUnit}, Approved: ${newAllowance}`);
      }

      devLog.log(`[purchaseGiftCardServerAction] Approval successful. Required: ${tokenAmountInSmallestUnit}, Available allowance: ${newAllowance}`);
      // Convert fiatAmount (e.g., "1.05") to cents for the contract
      const fiatAmountInCents = BigInt(Math.round(parseFloat(fiatAmountForContract) * 100));

      const payload = {
        payer: userAccount.address,
        fiatAmount: fiatAmountInCents,
        serviceRef: (serviceRef || '').toString(), // Ensure serviceRef is not undefined before calling toString()
        token: paymentToken.contract as Hex,
        tokenAmount: tokenAmountInSmallestUnit,
      };
      devLog.log('[purchaseGiftCardServerAction] Calling requestERC20Service with payload:', payload);

      purchaseTxHash = await userWalletClient.writeContract({
        address: BANDO_ROUTER_PROXY_ADDRESS,
        abi: BANDO_ROUTER_ABI,
        functionName: 'requestERC20Service',
        args: [BigInt(evmServiceId), payload],
      });


    devLog.log(`[purchaseGiftCardServerAction] Purchase transaction sent: ${purchaseTxHash}`);
    await publicClient.waitForTransactionReceipt({ hash: purchaseTxHash });
    devLog.log(`[purchaseGiftCardServerAction] Purchase transaction ${purchaseTxHash} confirmed.`);

    // 5. Update transaction record in DB
    await db.transaction.update({
      where: { id: dbTxRecord.id },
      data: { hash: purchaseTxHash, status: 'success' },
    });

    return { success: true, txHash: purchaseTxHash };

  } catch (error: any) {
    console.error('[purchaseGiftCardServerAction] Error:', error);
    // Attempt to update DB record if it exists
    const pendingTx = await db.transaction.findFirst({ where: { userId, status: 'pending', type: TransactionType.GIFT_CARD_PURCHASE }});
    if (pendingTx) {
      await db.transaction.update({
        where: { id: pendingTx.id },
        data: { status: 'error', description: `Purchase failed: ${error.message || 'Unknown error'}` }
      }).catch(dbError => console.error("Failed to update transaction to error state:", dbError));
    }
    return { success: false, error: error.message || 'Failed to purchase gift card.' };
  }
}
