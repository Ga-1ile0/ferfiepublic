'use server';

import { revalidatePath } from 'next/cache';
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { db } from '@/lib/db';
import { canMakeNFTTransaction } from '../permissions';
import { getClient, Execute, createClient, reservoirChains } from '@reservoir0x/reservoir-sdk';
import { OpenSeaSDK, Chain } from 'opensea-js';
import { ethers } from 'ethers';
import { decryptSensitiveData } from '@/lib/kms-service';
import { NftCollection } from '@prisma/client';
import { availableNfts, HardcodedNft } from '@/lib/nfts';
// Configure Reservoir Client
// Using any type assertion to bypass TypeScript errors with the SDK configuration

createClient({
  chains: [
    {
      ...reservoirChains.base,
      active: true,
    },
  ],
  source: 'https://app.ferfie.com/',
  apiKey: process.env.RESERVOIR_API_KEY,
});

/**
 * List an NFT token for sale using OpenSea SDK
 * @param userId The ID of the user listing the NFT
 * @param tokenId The token ID to list
 * @param contractAddress The contract address of the NFT
 * @param priceEth The price in ETH to list the NFT for
 * @param expirationDays Number of days until the listing expires
 * @returns Promise that resolves to listing info
 */
export async function listNFTForSale(
  userId: string,
  tokenId: string,
  contractAddress: string,
  priceEth: number,
  expirationDays = 7
): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
  try {
    // 1) Authorization check
    const allowed = await canMakeNFTTransaction(userId, priceEth);
    if (!allowed) {
      return { success: false, error: 'Not authorized to list NFT for sale' };
    }

    // 2) Load user & private key
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { family: true },
    });
    if (!user?.privateKey) {
      console.error('[listNFTForSale] Missing private key');
      return { success: false, error: 'Missing private key for wallet' };
    }

    // 3) Compute expiration
    const expirationTime = Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60;
    console.log(
      `[listNFTForSale] Expiration time: ${new Date(expirationTime * 1000).toISOString()}`
    );

    // 4) Create a placeholder transaction record
    const txRecord = await db.transaction.create({
      data: {
        amount: 0,
        type: 'NFT_TRADE',
        description: 'Listed NFT for sale',
        userId: user.id,
        familyId: user.familyId ?? undefined,
      },
    });

    // 5) Setup ethers & OpenSea SDK
    const provider = new ethers.JsonRpcProvider(
      process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
    );
    const userKey = await decryptSensitiveData(user.privateKey, user.dek!);
    const wallet = new ethers.Wallet(userKey, provider);
    const openseaSDK = new OpenSeaSDK(wallet, {
      chain: Chain.Base,
      apiKey: process.env.OPENSEA_API_KEY,
    });

    // 6) Create the listing on OpenSea
    const listing = await openseaSDK.createListing({
      asset: { tokenId, tokenAddress: contractAddress },
      accountAddress: wallet.address,
      startAmount: priceEth.toFixed(6),
      expirationTime,
      paymentTokenAddress: '0x0000000000000000000000000000000000000000' /* ETH */,
    });
    console.log('[listNFTForSale] Listing created:', listing);

    // 7) Persist OrderV2 and link to Transaction
    const orderHash = listing.orderHash;
    if (orderHash) {
      // 7b) update the transaction row to link them
      await db.transaction.update({
        where: { id: txRecord.id },
        data: {
          hash: orderHash,
          orderHash: orderHash,
        },
      });
    }

    console.log('[listNFTForSale] NFT listed successfully');
    return { success: true, transactionHash: orderHash || undefined };
  } catch (err: any) {
    console.error('[listNFTForSale] Error:', err);
    return { success: false, error: err.message || 'Listing failed' };
  }
}

export async function cancelListing(
  userId: string,
  orderHash: string,
  userAddy: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Fetch user info with private key
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { family: true },
    });

    if (!user?.privateKey) {
      console.error('[cancelListing] Missing private key');
      return { success: false, error: 'Missing private key for wallet' };
    }

    // Create a record of the cancellation attempt
    console.log('[cancelListing] Recording transaction in DB');
    const txRecord = await db.transaction.create({
      data: {
        amount: 0, // Amount is zero for cancellation
        type: 'NFT_TRADE',
        description: 'Canceled NFT listing',
        userId: user.id,
        familyId: user.familyId || undefined,
        orderHash: orderHash, // Link to the order being canceled
      },
    });

    const userKey = await decryptSensitiveData(user.privateKey, user.dek!);
    const userAccount = privateKeyToAccount(userKey as `0x${string}`);
    const userWalletClient = createWalletClient({
      account: userAccount,
      chain: base,
      transport: http(),
    });

    try {
      const params = {
        ids: [orderHash],
        wallet: userWalletClient,
      };
      const sdkResult = await getClient()?.actions.cancelOrder({
        ...params,
        onProgress: (steps: Execute['steps']) => console.log('[buyNFT] onProgress steps:', steps),
      });
      if (!sdkResult) {
        await db.transaction.update({
          where: { id: txRecord.id },
          data: { description: 'Failed to cancel NFT listing', status: 'error' },
        });
        console.error('[cancelListing] No result from cancelOrder');
        return { success: false, error: 'No result from cancelOrder' };
      }

      console.log('[cancelListing] NFT listing canceled successfully');
      await db.transaction.update({
        where: { id: txRecord.id },
        data: { description: 'NFT listing canceled successfully', status: 'success' },
      });
      return { success: true, txHash: orderHash };
    } catch (error: any) {
      console.error('[cancelListing] Inner catch error:', error);
      await db.transaction.update({
        where: { id: txRecord.id },
        data: { description: 'Failed to cancel NFT listing', status: 'error' },
      });
      return { success: false, error: error.message || 'Failed to cancel NFT listing' };
    }
  } catch (error: any) {
    console.error('[cancelListing] Outer catch error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process cancellation request',
    };
  }
}

// Constants

const PLATFORM_FEE_ADDRESS = '0xfE4F1E808B8594d03C3B693fa4726cd323fFEeA5';
const PLATFORM_FEE_PERCENTAGE = 0.02; // 2%
const HARDCODED_GAS_AMOUNT = parseEther('0.0000003'); // Gas for NFT purchase

/**
 * Buy an NFT token using Reservoir SDK
 * @param userId The ID of the user making the purchase
 * @param tokenId The token ID to purchase
 * @param contractAddress The contract address of the NFT
 * @param price The price to pay for the NFT
 * @param currencyAddress The address of the currency to use for payment
 * @returns Promise that resolves to transaction info
 */
export async function buyNFT(
  userId: string,
  tokenId: string,
  contractAddress: string,
  price: number,
  currencyAddress: string,
  stableAddress: string,
  ethRate: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  console.log(
    `[buyNFT] Entering buyNFT. userId=${userId}, token=${contractAddress}:${tokenId}, price=${price}, currency=${currencyAddress}`
  );
  try {
    console.log('[buyNFT] Checking permissions...');
    const allowed = await canMakeNFTTransaction(userId, price);
    console.log(`[buyNFT] Permission allowed=${allowed}`);
    if (!allowed) {
      return { success: false, error: 'Not authorized to make NFT transaction' };
    }

    console.log('[buyNFT] Fetching user and family info from DB');
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { family: { include: { owner: true } } },
    });
    console.log(`[buyNFT] User found=${!!user}, has privateKey=${!!user?.privateKey}`);

    if (!user?.privateKey || !user.family?.owner.privateKey) {
      console.error('[buyNFT] Missing private keys');
      return { success: false, error: 'Missing private keys for wallets' };
    }

    if (!user.address) {
      console.error('[buyNFT] User has no wallet address');
      return { success: false, error: 'User has no wallet address' };
    }

    console.log('[buyNFT] Setting up viem clients');
    const publicClient = createPublicClient({ chain: base, transport: http() });
const key = await decryptSensitiveData(user.privateKey, user.dek!);
    const userAccount = privateKeyToAccount(key as `0x${string}`);
    console.log(`[buyNFT] User account address=${userAccount.address}`);
    const userWalletClient = createWalletClient({
      account: userAccount,
      chain: base,
      transport: http(),
    });
    const userAddress = userAccount.address;
    const userBalance = await publicClient.getBalance({ address: userAddress });
    if (userBalance < parseEther('0.0000003')) {
        const familyKey = await decryptSensitiveData(user.family.owner.privateKey, user.family.owner.dek!);
      const familyAccount = privateKeyToAccount(familyKey as `0x${string}`);
      console.log(`[buyNFT] Family account address=${familyAccount.address}`);
      const familyWalletClient = createWalletClient({
        account: familyAccount,
        chain: base,
        transport: http(),
      });
      const familyAddress = familyAccount.address;

      console.log('[buyNFT] Checking family wallet balance for gas');
      const familyBalance = await publicClient.getBalance({ address: familyAddress });
      console.log(`[buyNFT] Family balance=${formatEther(familyBalance)} ETH`);
      if (familyBalance < HARDCODED_GAS_AMOUNT) {
        console.error('[buyNFT] Insufficient gas in family wallet');
        return {
          success: false,
          error: 'Not enough ETH for gas in family wallet, please notify parent',
        };
      }

      console.log(`[buyNFT] Sending gas tx of ${formatEther(HARDCODED_GAS_AMOUNT)} ETH to user`);
      const gasTxHash = await familyWalletClient.sendTransaction({
        to: userAddress,
        value: HARDCODED_GAS_AMOUNT,
      });
      console.log(`[buyNFT] Gas tx sent: ${gasTxHash}`);

      console.log('[buyNFT] Awaiting gas tx receipt...');
      await publicClient.waitForTransactionReceipt({ hash: gasTxHash });
      console.log('[buyNFT] Gas tx confirmed');
    }
    console.log('[buyNFT] Calculating platform fee');

    const se = await getStableToEthRate(stableAddress);
    console.log(`[buyNFT] Stable to ETH rate=${se}`);
    const ethAmount = price * ethRate;
    console.log(`[buyNFT] ETH amount=${ethAmount}`);
    const platformFeeAmount = ethAmount * PLATFORM_FEE_PERCENTAGE;
    const platformFeeBigint = parseEther(platformFeeAmount.toFixed(18));
    console.log(`[buyNFT] Platform fee=${formatEther(platformFeeBigint)} ETH`);

    console.log('[buyNFT] Preparing buyParams for Reservoir SDK');
    const fullTokenId = `${contractAddress}:${tokenId}`;
    const buyParams = {
      items: [
        {
          token: fullTokenId,
          quantity: 1,
        },
      ],
      wallet: userWalletClient,
      onProgress: () => {}, // We'll handle this server-side
      options: {
        feesOnTop: [`${PLATFORM_FEE_ADDRESS}:${platformFeeBigint.toString()}`],
        excludeEOA: true,
        currency: currencyAddress,
      },
    };
    console.log(
      '[buyNFT] buyParams:',
      JSON.stringify({ items: buyParams.items, options: buyParams.options })
    );

    console.log('[buyNFT] Recording transaction in DB');
    const txRecord = await db.transaction.create({
      data: {
        amount: price || 0,
        type: 'NFT_TRADE',
        description: `Purchase of NFT`,
        status: 'pending',
        userId: user.id,
        familyId: user.familyId || undefined,
      },
    });
    console.log(`[buyNFT] Transaction record created: id=${txRecord.id}`);

    console.log('[buyNFT] Executing actions.buyToken');
    try {
      const sdkResult = await getClient()?.actions.buyToken({
        ...buyParams,
        onProgress: (steps: Execute['steps']) => console.log('[buyNFT] onProgress steps:', steps),
      });
      console.log('[buyNFT] sdkResult:', sdkResult);
      //   const txHash = sdkResult.items.txHashes.tsHash;
      const txHash = 'success';
      if (!txHash && !sdkResult) {
        console.error('[buyNFT] No txHash in sdkResult steps');
        await db.transaction.update({
          where: { id: txRecord.id },
          data: { description: 'No transaction hash received from purchase', status: 'error' },
        });
        return { success: false, error: 'No transaction hash received' };
      }
      console.log(`[buyNFT] Updating DB with txHash=${txHash}`);
      await db.transaction.update({
        where: { id: txRecord.id },
        data: { hash: txHash, status: 'success' },
      });
      console.log('[buyNFT] Purchase completed');
      return { success: true, txHash };
    } catch (err: any) {
      console.error('[buyNFT] actions.buyToken error:', err);
      await db.transaction.update({
        where: { id: txRecord.id },
        data: { description: `Purchase failed: ${err.message || err}`, amount: 0 },
      });
      return { success: false, error: err.message || 'Purchase failed' };
    }
  } catch (error: any) {
    console.error('[buyNFT] outer catch error:', error);
    return {
      success: false,
      error: error.message || 'Failed to process NFT purchase',
    };
  }
}

/**
 * Make an offer on an NFT token using OpenSea SDK
 * @param kidId The ID of the kid making the offer
 * @param tokenId The token ID to make an offer on
 * @param contractAddress The contract address of the NFT
 * @param offerAmount The amount to offer in the user's family currency
 * @param expirationDays Number of days until the offer expires
 * @returns Promise that resolves to an offer ID
 */
export async function makeOffer(
  kidId: string,
  tokenId: string,
  contractAddress: string,
  offerAmount: number,
  expirationDays: number = 7
): Promise<{ success: boolean; offerId?: string; error?: string; txHash?: string }> {
  try {
    // 1) Authorization check
    const allowed = await canMakeNFTTransaction(kidId, offerAmount);
    if (!allowed) {
      return { success: false, error: 'Not authorized to make NFT transaction' };
    }

    // 2) Load user & private key
    const user = await db.user.findUnique({
      where: { id: kidId },
      include: { family: true },
    });

    if (!user?.privateKey) {
      console.error('[makeOffer] Missing private key');
      return { success: false, error: 'Missing private key for wallet' };
    }

    // 3) Check if user has enough ETH
    const provider = new ethers.JsonRpcProvider(
      process.env.BASE_RPC_URL ?? 'https://mainnet.base.org'
    );
    const userKey = await decryptSensitiveData(user.privateKey, user.dek!);
    const wallet = new ethers.Wallet(userKey, provider);

    // Get ETH balance
    const ethBalance = await provider.getBalance(wallet.address);
    const ethBalanceNumber = parseFloat(formatEther(ethBalance));

    // 4) Convert offer from family currency to ETH
    const familyCurrencyAddress =
      user?.family?.currencyAddress || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'; // Default to USDC on Base
    const safeStablecoinAddress =
      typeof familyCurrencyAddress === 'string'
        ? familyCurrencyAddress
        : '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';

    // Get the ETH/stablecoin rate
    const ethStableRate = await getEthToStableRate(safeStablecoinAddress);

    // Convert from family currency to ETH
    const offerAmountEth = offerAmount / ethStableRate;
    console.log(`[makeOffer] Converting ${offerAmount} family currency to ${offerAmountEth} ETH`);

    // Make sure the user has enough ETH
    if (ethBalanceNumber < offerAmountEth) {
      return {
        success: false,
        error: `Insufficient ETH balance. You need ${offerAmountEth.toFixed(6)} ETH but have ${ethBalanceNumber.toFixed(6)} ETH.`,
      };
    }

    // 5) Create a placeholder transaction record
    const txRecord = await db.transaction.create({
      data: {
        amount: offerAmount,
        type: 'NFT_TRADE',
        description: `Made offer on NFT #${tokenId}`,
        userId: user.id,
        familyId: user.familyId ?? undefined,
      },
    });

    // 6) Setup OpenSea SDK
    const openseaSDK = new OpenSeaSDK(wallet, {
      chain: Chain.Base,
      apiKey: process.env.OPENSEA_API_KEY,
    });

    // 7) Calculate expiration time
    const expirationTime = Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60;
    console.log(`[makeOffer] Expiration time: ${new Date(expirationTime * 1000).toISOString()}`);

    // 8) Create the offer
    console.log(
      `[makeOffer] Creating offer for ${offerAmountEth} ETH on NFT ${tokenId} from contract ${contractAddress}`
    );
    const offer = await openseaSDK.createOffer({
      asset: {
        tokenId,
        tokenAddress: contractAddress,
      },
      accountAddress: wallet.address,
      startAmount: offerAmountEth.toFixed(6),
      expirationTime,
      // By default, this uses WETH (wrapped ETH)
    });

    console.log('[makeOffer] Offer created:', offer);

    // 9) Update transaction record
    if (offer.orderHash) {
      await db.transaction.update({
        where: { id: txRecord.id },
        data: {
          hash: offer.orderHash,
          orderHash: offer.orderHash,
        },
      });
    }

    return {
      success: true,
      offerId: offer.orderHash || `offer_${Date.now()}`,
      txHash: offer.orderHash || undefined,
    };
  } catch (error: any) {
    console.error('[makeOffer] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to place offer. Please try again.',
    };
  }
}
//Not implamented yet

// export async function listNFTForSale(
//   userId: string,
//   tokenId: string,
//   contractAddress: string,
//   priceEth: number,
//   expirationDays: number = 7
// ): Promise<{ success: boolean; listingId?: string; error?: string }> {
//   try {
//     // Check if the user is allowed to perform NFT transactions
//     const allowed = await canMakeNFTTransaction(userId, priceEth);
//     if (!allowed) {
//       return { success: false, error: 'Not authorized to list NFT for sale' };
//     }

//     // Fetch user info with private key
//     const user = await db.user.findUnique({
//       where: { id: userId },
//       include: { family: true },
//     });

//     if (!user?.privateKey) {
//       console.error('[listNFTForSale] Missing private key');
//       return { success: false, error: 'Missing private key for wallet' };
//     }

//     // Set up wallet client
//     const userAccount = privateKeyToAccount(user.privateKey as `0x${string}`);
//     const userWalletClient = createWalletClient({
//       account: userAccount,
//       chain: base,
//       transport: http()
//     });

//     // Calculate expiration time in milliseconds
//     const expirationTime = Math.floor(Date.now() + (expirationDays * 24 * 60 * 60 * 1000));
//     const expirationSeconds = Math.floor(new Date(expirationTime).getTime() / 1000);
//     console.log(`[listNFTForSale] Expiration time: ${new Date(expirationTime).toISOString()}`);

//     // Convert price to wei
//     const weiPrice = parseEther(priceEth.toString());
//     console.log(`[listNFTForSale] Price in wei: ${weiPrice}`);

//     // Prepare listing parameters
//     const listings = [{
//       token: `${contractAddress}:${tokenId}`,
//       weiPrice: weiPrice.toString(),
//       orderKind: "seaport-v1.6" as const,
//       expirationTime: expirationSeconds.toString(),
//       options: {
//         'seaport-v1.4': {useOffChainCancellation: true},
//         'seaport-v1.5': {useOffChainCancellation: true},
//         'seaport-v1.6': {useOffChainCancellation: true},
//         mintify: {useOffChainCancellation: true},
//         'payment-processor-v2': {useOffChainCancellation: true},
//         'payment-processor-v2.1': {useOffChainCancellation: true},
//         alienswap: {useOffChainCancellation: true}
//       },
//       orderBook: "opensea"
//     }];

//     console.log('[listNFTForSale] Prepared listing params:', JSON.stringify(listings));

//     // Create a record of the listing attempt
//     console.log('[listNFTForSale] Recording transaction in DB');
//     const txRecord = await db.transaction.create({
//       data: {
//         amount: priceEth,
//         type: 'NFT_TRADE',
//         description: `Listed NFT for sale`,
//         userId: user.id,
//         familyId: user.familyId || undefined
//       }
//     });

//     // Execute the listing action
//     console.log('[listNFTForSale] Executing listToken action');
//     try {
//       const listingResult = await getClient()?.actions.listToken({
//         listings,
//         wallet: userWalletClient,
//         onProgress: (steps: Execute['steps']) => {
//           console.log('[listNFTForSale] onProgress steps:', steps);
//         }
//       });

//       console.log('[listNFTForSale] Listing result:', listingResult);

//       // Process the result and update transaction
//       if (!listingResult) {
//         console.error('[listNFTForSale] No result returned from listToken');
//         await db.transaction.update({
//           where: { id: txRecord.id },
//           data: { description: `Failed to list NFT`,
//             amount: 0,
//            }
//         });
//         return { success: false, error: 'No response from listing service' };
//       }

//     //   // Extract the transaction hash if available
//     //   let txHash;
//     //   //@ts-ignore
//     //   if (typeof listingResult === 'object' && Array.isArray(listingResult.steps)) {
//     //     //@ts-ignore
//     //     txHash = listingResult.steps.find((s: any) => s && typeof s === 'object' && 'txHash' in s && s.txHash)?.txHash;
//     //   }

//     //   if (txHash) {
//     //     console.log(`[listNFTForSale] Updating DB with txHash=${txHash}`);
//     //     await db.transaction.update({
//     //       where: { id: txRecord.id },
//     //       data: { hash: txHash }
//     //     });
//     //   }

//       console.log('[listNFTForSale] NFT listed successfully');
//       return {
//         success: true,
//       };
//     } catch (error: any) {
//       console.error('[listNFTForSale] Error in listToken:', error);
//       await db.transaction.update({
//         where: { id: txRecord.id },
//         data: { description: `Failed to list NFT` }
//       });
//       return { success: false, error: error.message || 'Failed to list NFT for sale' };
//     }
//   } catch (error: any) {
//     console.error('[listNFTForSale] Outer catch error:', error);
//     return { success: false, error: error.message || 'Failed to process NFT listing' };
//   }
// }

/**
 * Accept an offer for an NFT token using Reservoir SDK
 * @param userId The ID of the user accepting the offer
 * @param tokenId The token ID with the offer
 * @param contractAddress The contract address of the NFT
 * @param expectedOfferEth Expected offer price in ETH (for verification)
 * @returns Promise that resolves to transaction info
 */
export async function acceptNFTOffer(
  userId: string,
  tokenId: string,
  contractAddress: string,
  expectedOfferEth?: number
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  console.log(`[acceptNFTOffer] Starting. userId=${userId}, token=${contractAddress}:${tokenId}`);
  try {
    // Fetch user info with private key
    console.log('[acceptNFTOffer] Fetching user from DB');
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { family: { include: { owner: true } } },
    });
    console.log(`[acceptNFTOffer] User found=${!!user}, has privateKey=${!!user?.privateKey}`);

    if (!user?.privateKey) {
      console.error('[acceptNFTOffer] Missing private key');
      return { success: false, error: 'Missing private key for wallet' };
    }

    if (!user.address) {
      console.error('[acceptNFTOffer] User has no wallet address');
      return { success: false, error: 'User has no wallet address' };
    }

    // Setup wallet client
    console.log('[acceptNFTOffer] Setting up viem clients');
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const userKey = await decryptSensitiveData(user.privateKey, user.dek!);
    const userAccount = privateKeyToAccount(userKey as `0x${string}`);
    console.log(`[acceptNFTOffer] User account address=${userAccount.address}`);
    const userWalletClient = createWalletClient({
      account: userAccount,
      chain: base,
      transport: http(),
    });

    // Setup family wallet (for gas if needed)
    if (user.family?.owner.privateKey) {
      const familyKey = await decryptSensitiveData(user.family.owner.privateKey, user.family.owner.dek!);
      const familyAccount = privateKeyToAccount(familyKey as `0x${string}`);
      console.log(`[acceptNFTOffer] Family account available: ${familyAccount.address}`);

      // Check if we need to send gas
      const userBalance = await publicClient.getBalance({ address: userAccount.address });
      if (userBalance < parseEther('0.0000003')) {
        console.log('[acceptNFTOffer] User wallet needs gas');

        // Make sure family has enough balance
        const familyBalance = await publicClient.getBalance({ address: familyAccount.address });
        if (familyBalance < HARDCODED_GAS_AMOUNT) {
          console.error('[acceptNFTOffer] Insufficient gas in family wallet');
          return {
            success: false,
            error: 'Not enough ETH for gas in family wallet, please notify parent',
          };
        }

        // Send gas from family to user
        const familyWalletClient = createWalletClient({
          account: familyAccount,
          chain: base,
          transport: http(),
        });

        console.log(
          `[acceptNFTOffer] Sending gas of ${formatEther(HARDCODED_GAS_AMOUNT)} ETH to user`
        );
        const gasTxHash = await familyWalletClient.sendTransaction({
          to: userAccount.address,
          value: HARDCODED_GAS_AMOUNT,
        });
        console.log(`[acceptNFTOffer] Gas tx sent: ${gasTxHash}`);

        // Wait for gas tx to confirm
        console.log('[acceptNFTOffer] Awaiting gas tx receipt...');
        await publicClient.waitForTransactionReceipt({ hash: gasTxHash });
        console.log('[acceptNFTOffer] Gas tx confirmed');
      } else {
        console.log(`[acceptNFTOffer] User has sufficient gas: ${formatEther(userBalance)} ETH`);
      }
    }
    const platformFeeAmount = expectedOfferEth || 0.0000001 * PLATFORM_FEE_PERCENTAGE;
    const platformFeeBigint = parseEther(platformFeeAmount.toFixed(18));
    // Prepare offer acceptance parameters
    console.log('[acceptNFTOffer] Preparing acceptOffer params');
    const acceptParams = {
      items: [
        {
          token: `${contractAddress}:${tokenId}`,
          quantity: 1,
        },
      ],
      wallet: userWalletClient,
      onProgress: () => {}, // Will handle through promise below
      options: {
        feesOnTop: [`${PLATFORM_FEE_ADDRESS}:${platformFeeBigint.toString()}`],
      },
    };

    // Add expected price check if provided
    if (expectedOfferEth) {
      console.log(`[acceptNFTOffer] Using expected price of ${expectedOfferEth} ETH`);
      const ethZeroAddress = '0x0000000000000000000000000000000000000000';
      (acceptParams as any).expectedPrice = {
        [ethZeroAddress]: {
          amount: expectedOfferEth,
          raw: parseEther(expectedOfferEth.toString()).toString(),
          currencyAddress: ethZeroAddress,
          currencyDecimals: 18,
        },
      };
    }

    console.log(
      '[acceptNFTOffer] acceptParams:',
      JSON.stringify({
        items: acceptParams.items,
        expectedPrice: (acceptParams as any).expectedPrice,
      })
    );

    // Create a record of the transaction
    console.log('[acceptNFTOffer] Recording transaction in DB');
    const txRecord = await db.transaction.create({
      data: {
        amount: expectedOfferEth || 0, // We don't know the exact amount until after accepting
        type: 'NFT_TRADE',
        description: `Sold NFT`,
        userId: user.id,
        familyId: user.familyId || undefined,
      },
    });
    console.log(`[acceptNFTOffer] Transaction record created: id=${txRecord.id}`);

    // Execute the accept offer action
    console.log('[acceptNFTOffer] Executing acceptOffer action');
    try {
      const acceptResult = await getClient()?.actions.acceptOffer({
        ...acceptParams,
        onProgress: (steps: Execute['steps']) => {
          console.log('[acceptNFTOffer] onProgress steps:', steps);
        },
      });

      console.log('[acceptNFTOffer] Accept result:', acceptResult);

      // Handle the result
      if (!acceptResult) {
        console.error('[acceptNFTOffer] No result returned from acceptOffer');
        await db.transaction.update({
          where: { id: txRecord.id },
          data: { description: `Failed to accept NFT offer: No response from SDK` },
        });
        return { success: false, error: 'No response from offer service' };
      }

      // Extract transaction hash
      let txHash;
      if (typeof acceptResult === 'object' && Array.isArray(acceptResult.steps)) {
        //@ts-ignore
        txHash = acceptResult.steps.find(
          (s: any) => s && typeof s === 'object' && 'txHash' in s && s.txHash
          //@ts-ignore
        )?.txHash;
      }
      if (!txHash) {
        txHash = 'success';
      }

      // Update transaction record with hash
      console.log(`[acceptNFTOffer] Updating DB with txHash=${txHash}`);
      await db.transaction.update({
        where: { id: txRecord.id },
        data: { hash: txHash },
      });

      // If we need to update the amount with the actual sale price, we'd do that here
      // This would require additional API calls to get the details of the accepted offer

      console.log('[acceptNFTOffer] Offer accepted successfully');
      return { success: true, txHash };
    } catch (error: any) {
      console.error('[acceptNFTOffer] Error in acceptOffer:', error);
      await db.transaction.update({
        where: { id: txRecord.id },
        data: { description: `Failed to accept NFT offer: ${error.message || error}` },
      });
      return { success: false, error: error.message || 'Failed to accept NFT offer' };
    }
  } catch (error: any) {
    console.error('[acceptNFTOffer] Outer catch error:', error);
    return { success: false, error: error.message || 'Failed to process NFT offer acceptance' };
  }
}

/**
 * Convert ETH amount to user's family currency
 * @param ethAmount Amount in ETH
 * @param familyCurrencyAddress Address of the family's currency token
 * @returns Promise that resolves to the converted amount
 */
export async function convertEthToFamilyCurrency(
  ethAmount: number,
  familyCurrencyAddress: string
): Promise<number> {
  try {
    // Get exchange rate from ETH to family currency
    const exchangeRate = await getEthToStableRate(familyCurrencyAddress);

    // Calculate and return converted amount
    return ethAmount * exchangeRate;
  } catch (error) {
    console.error('Error converting ETH to family currency:', error);
    return ethAmount; // Return original amount if conversion fails
  }
}

/**
 * Get exchange rate from ETH to a stablecoin
 * @param stablecoinAddress Address of the stablecoin to get rate for
 * @returns Promise that resolves to the exchange rate (ETH to stablecoin)
 */
export async function getEthToStableRate(stablecoinAddress: string): Promise<number> {
  try {
    // Base ETH address
    const ethAddress = '0x0000000000000000000000000000000000000000';

    // Set up API call to get price (in a real implementation, you might use an oracle or price feed)
    const apiUrl = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${stablecoinAddress}&vs_currencies=eth`;

    // Make the API call
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rate: ${response.status}`);
    }

    const data = await response.json();

    // Extract the rate (inverse it since we want ETH to stablecoin, not stablecoin to ETH)
    const rate = data[stablecoinAddress.toLowerCase()]?.eth;

    if (!rate) {
      throw new Error('Could not find exchange rate in response');
    }

    // Return the inverse (ETH to stablecoin)
    return 1 / rate;
  } catch (error) {
    console.error('Error getting ETH to stablecoin rate:', error);
    // Default to a hard-coded fallback rate if we can't get the real one
    // This would be better stored in a database or config and updated regularly
    return 0; // Example: 1 ETH = $1800 USD
  }
}

interface ReservoirCollection {
  id: string;
  name: string;
  image: string | null;
  description: string | null;
  slug: string | null;
  creator: string | null;
  tokenCount: string;
  isSpam: boolean;
  isNsfw: boolean;
  primaryContract: string;
  banner?: string;
  bannerImageUrl?: string;
}

interface ReservoirCollectionDetails {
  collection: {
    banner: string | null;
    bannerImageUrl: string | null;
    [key: string]: any;
  };
}

export async function getReservoirCollection(contractAddress: string): Promise<ReservoirCollection> {
  const url = `https://api-base.reservoir.tools/collections/v7?contract=${contractAddress}`;
  const response = await fetch(url, {
    headers: {
      'x-api-key': process.env.NEXT_PUBLIC_RESERVOIR_API_KEY || '',
    },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch collection from Reservoir');
  }
  const data = await response.json();
  return data.collections[0];
}

export async function getReservoirCollectionDetails(contractAddress: string): Promise<{ banner: string | null }> {
  try {
    const url = `https://api-base.reservoir.tools/collection/v3?id=${contractAddress}`;
    const response = await fetch(url, {
      headers: {
        'x-api-key': process.env.NEXT_PUBLIC_RESERVOIR_API_KEY || '',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch collection details: ${response.status} ${response.statusText}`);
      return { banner: null };
    }

    const data: ReservoirCollectionDetails = await response.json();

    // Return the banner URL, falling back to bannerImageUrl if banner is not available
    return {
      banner: data.collection?.banner || data.collection?.bannerImageUrl || null
    };
  } catch (error) {
    console.error('Error fetching collection details:', error);
    return { banner: null };
  }
}

export async function addCustomNftCollection(
  familyId: string,
  collection: ReservoirCollection
): Promise<NftCollection> {
  // Fetch additional collection details to get the banner image
  const collectionDetails = await getReservoirCollectionDetails(collection.primaryContract);

  const newCollection = await db.nftCollection.create({
    data: {
      name: collection.name,
      contractAddress: collection.primaryContract,
      imageUrl: collection.image,
      bannerUrl: collectionDetails?.banner || null, // Use the banner URL from collection details
      description: collection.description,
      slug: collection.slug,
      creator: collection.creator,
      tokenCount: collection.tokenCount,
      isSpam: collection.isSpam,
      isNsfw: collection.isNsfw,
      family: {
        connect: {
          id: familyId,
        },
      },
    },
  });

  // Refresh collection data on Reservoir in the background
  // We don't await this since it can take some time and we don't want to block the response
  try {
    const refreshUrl = 'https://api-base.reservoir.tools/collections/refresh/v2';
    await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NEXT_PUBLIC_RESERVOIR_API_KEY || '',
      },
      body: JSON.stringify({
        collection: collection.primaryContract,
        overrideCoolDown: false,
        refreshTokens: true,
      }),
    });
    console.log(`Refreshed collection data for ${collection.name} on Reservoir`);
  } catch (error) {
    console.error('Error refreshing collection on Reservoir:', error);
    // Non-blocking error - we still want to return the collection
  }

  revalidatePath('/dashboard'); // Revalidate path to show new collection
  return newCollection;
}

export async function getCustomNftCollections(familyId: string): Promise<NftCollection[]> {
  const collections = await db.nftCollection.findMany({
    where: {
      familyId: familyId,
    },
  });
  return collections;
}

export async function getNftCollections(familyId: string) {
  const hardcodedCollections: HardcodedNft[] = availableNfts;
  const customCollections = await getCustomNftCollections(familyId);
  return { hardcoded: hardcodedCollections, custom: customCollections };
}

export async function getStableToEthRate(stablecoinAddress: string): Promise<number> {
  try {
    // Base ETH address
    const ethAddress = '0x0000000000000000000000000000000000000000';

    // Set up API call to get price (in a real implementation, you might use an oracle or price feed)
    const apiUrl = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${stablecoinAddress}&vs_currencies=eth`;

    // Make the API call
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch exchange rate: ${response.status}`);
    }

    const data = await response.json();
    const rate = data[stablecoinAddress.toLowerCase()]?.eth;
    if (!rate) {
      throw new Error('Could not find exchange rate in response');
    }

    return rate;
  } catch (error) {
    console.error('Error getting ETH to stablecoin rate:', error);
    return 0;
  }
}
