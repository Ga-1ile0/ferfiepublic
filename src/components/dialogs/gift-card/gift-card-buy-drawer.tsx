'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Gift } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Currency } from '@/components/shared/currency-symbol';
import { useAuth } from '@/contexts/authContext';
import { getKidPermissions } from '@/server/permissions';
import { availableTokens, getMultiTokenBalances } from '@/lib/tokens';
import type {
    BandoProductVariant,
    BandoQuoteResponse,
    ReferenceValidationResponse,
} from '@/lib/bando-api';
import { devLog } from '@/lib/devlog';
import { getGiftCardQuote, validateReference } from '@/lib/bando-api';
import { purchaseGiftCardServerAction } from '@/server/giftcard';

interface GiftCardBuyDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variant: BandoProductVariant | null;
    brandName: string;
    brandImageUrl: string;
}

export function GiftCardBuyDrawer({
    open,
    onOpenChange,
    variant,
    brandName,
    brandImageUrl,
}: GiftCardBuyDrawerProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [maxGiftCardAmount, setMaxGiftCardAmount] = useState<number | null>(null);
    const [giftCardEnabled, setGiftCardEnabled] = useState<boolean>(true);
    const [isLoadingPermissions, setIsLoadingPermissions] = useState<boolean>(false);
    const [isLoadingBalances, setIsLoadingBalances] = useState<boolean>(false);
    const [stablecoinBalance, setStablecoinBalance] = useState<number>(0);
    const [hasSufficientBalance, setHasSufficientBalance] = useState<boolean>(false);
    const [quote, setQuote] = useState<BandoQuoteResponse | null>(null);
    const [isFetchingQuote, setIsFetchingQuote] = useState<boolean>(false);
    const [quoteError, setQuoteError] = useState<string | null>(null);
    const [paymentToken, setPaymentToken] = useState<{
        symbol: string;
        image: string;
        contract: string;
        decimals: number;
    } | null>(null);
    const { user, refreshBalance } = useAuth();

    // Reset state when drawer opens/closes
    useEffect(() => {
        if (!open) {
            setIsProcessing(false);
        } else {
            // Reset stablecoin balance when drawer opens
            setStablecoinBalance(0);
        }
    }, [open]);

    // Fetch gift card quote
    const fetchQuote = useCallback(async () => {
        if (!variant || !user?.family?.currencyAddress) return;

        try {
            setIsFetchingQuote(true);
            setQuoteError(null);

            const quoteResponse = await getGiftCardQuote(
                variant.price.fiatCurrency, // fiatCurrency
                user.family.currencyAddress, // digitalAsset (token contract address)
                variant.sku, // SKU
                8453 // chainId (Base)
            );

            setQuote(quoteResponse);

            // Update balance check based on the quote
            if (stablecoinBalance > 0) {
                const totalAmount = parseFloat(quoteResponse.data.totalAmount);
                setHasSufficientBalance(stablecoinBalance >= totalAmount);
            }
        } catch (error) {
            console.error('Error fetching gift card quote:', error);
            setQuoteError('Failed to fetch quote. Please try again.');
            toast.error('Failed to get quote for gift card');
        } finally {
            setIsFetchingQuote(false);
        }
    }, [variant, user?.family?.currencyAddress, stablecoinBalance]);

    // Fetch user permissions & stable rate
    useEffect(() => {
        const fetchPermissions = async () => {
            if (!user) {
                setGiftCardEnabled(false);
                setMaxGiftCardAmount(null);
                return;
            }
            try {
                setIsLoadingPermissions(true);
                const response = await getKidPermissions(user.id);
                if (response.status === 200 && response.data) {
                    setGiftCardEnabled(response.data.giftCardsEnabled ?? true);
                    setMaxGiftCardAmount(response.data.maxGiftCardAmount ?? null);
                } else {
                    setGiftCardEnabled(true);
                    setMaxGiftCardAmount(null);
                }
            } catch (error) {
                console.error('Error fetching permissions', error);
                setGiftCardEnabled(true);
                setMaxGiftCardAmount(null);
            } finally {
                setIsLoadingPermissions(false);
            }
        };
        if (open) {
            fetchPermissions();
        }
    }, [open, user]);

    // Fetch quote when variant changes or when payment token is set
    useEffect(() => {
        if (open && variant && paymentToken) {
            fetchQuote();
        }
    }, [open, variant, paymentToken, fetchQuote]);

    // Set up payment token info and fetch balance
    useEffect(() => {
        const setupPaymentToken = async () => {
            if (!open || !user?.family) return;

            try {
                setIsLoadingBalances(true);

                // Find the token info based on family currency
                const tokenInfo = availableTokens.find(t => t.symbol === user.family?.currency);

                if (!tokenInfo) {
                    console.error('No token info found for currency:', user.family.currency);
                    return;
                }

                setPaymentToken({
                    symbol: tokenInfo.symbol,
                    image: tokenInfo.image,
                    contract: tokenInfo.contract,
                    decimals: tokenInfo.decimals || 6, // Default to 6 decimals if not specified
                });

                // Get user's balance for this token
                if (user.walletAddress) {
                    const balances = await getMultiTokenBalances(user.walletAddress);
                    const tokenIndex = availableTokens.findIndex(
                        t => t.contract.toLowerCase() === tokenInfo.contract.toLowerCase()
                    );

                    if (tokenIndex >= 0) {
                        const balance = balances[tokenIndex] || 0;
                        setStablecoinBalance(balance);
                        if (variant) {
                            setHasSufficientBalance(balance >= parseFloat(variant.price.fiatValue));
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching stablecoin balance:', error);
                toast.error('Failed to load your balance');
            } finally {
                setIsLoadingBalances(false);
            }
        };
        setupPaymentToken();
    }, [open, variant, user]);

    // Validate reference with Bando API on the client side
    const validateReferenceWithBando = async () => {
        if (!variant || !user || !quote?.data || !paymentToken) {
            throw new Error('Missing required information for reference validation');
        }

        // Get user email for reference - we need to fetch it from the server
        // Since we don't have direct access to the email in the client context
        let userEmail = '';
        try {
            // Fetch permissions to get the email
            const permissionsResponse = await getKidPermissions(user.id);
            if (permissionsResponse.status === 200 && permissionsResponse.data) {
                userEmail = permissionsResponse.data.giftCardEmail || '';
            }

            if (!userEmail) {
                throw new Error(
                    'No email address found for gift card delivery. Please set it in your profile or ask your parent to set it in permissions.'
                );
            }
        } catch (error) {
            console.error('Error fetching user email:', error);
            throw new Error(
                'Failed to get email for gift card delivery. Please try again or contact support.'
            );
        }

        // Prepare required fields (can be expanded based on Bando requirements)
        const requiredFields = [{ key: 'name', value: user.name || 'User' }];

        // Prepare transaction intent
        const transactionIntent = {
            sku: variant.sku,
            quantity: 1,
            amount: parseFloat(variant.price.fiatValue) * 100, // Convert to cents
            chain: 8453, // Base chain ID
            token: paymentToken.contract,
            wallet: user.walletAddress || '',
            integrator: 'bando-app',
            has_accepted_terms: true,
            quote_id: quote.data.id,
        };

        devLog.log('[validateReferenceWithBando] Calling validateReference with:', {
            reference: userEmail,
            requiredFields,
            transactionIntent,
        });

        // Call the client-side validation function
        return await validateReference(userEmail, requiredFields, transactionIntent);
    };

    // Handle purchase action
    const handlePurchase = async () => {
        if (!variant || !user || !quote?.data || !paymentToken || !user.family) {
            toast.error(
                'Missing required information to proceed with purchase. Please wait for all details to load.'
            );
            return;
        }

        if (!variant.evmServiceId) {
            toast.error('Gift card service ID is missing. Cannot proceed.');
            return;
        }

        try {
            setIsProcessing(true);

            // First, validate the reference on the client side
            let validationId: string | undefined;
            try {
                const validationResponse = await validateReferenceWithBando();

                if (validationResponse.error) {
                    throw new Error(validationResponse.message || validationResponse.error);
                }

                if (!validationResponse.data?.validationId) {
                    throw new Error('Failed to obtain validation ID from Bando API');
                }

                validationId = validationResponse.data.validationId;
                devLog.log('[handlePurchase] Obtained validationId:', validationId);
            } catch (validationError: any) {
                console.error('Reference validation failed:', validationError);
                toast.error(`Reference validation failed: ${validationError.message || 'Unknown error'}`);
                setIsProcessing(false);
                return;
            }

            const params = {
                userId: user.id,
                variantSku: variant.sku,
                evmServiceId: variant.evmServiceId,
                quoteId: String(quote.data.id), // Ensure quoteId is a string
                validationId, // Pass the validationId obtained from client-side validation
                fiatAmountForContract: quote.data.fiatAmount, // This is already string '1000' for $10.00
                paymentToken: {
                    contract: paymentToken.contract, // Use the determined payment token contract
                    decimals: paymentToken.decimals,
                    symbol: paymentToken.symbol,
                },
                digitalAssetAmountFromQuote: quote.data.digitalAssetAmount, // This is already string '10000000' for 10 USDC (6 decimals)
                totalAmountFromQuoteInWeiForNative:
                    paymentToken.contract.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
                        paymentToken.contract === '0x0000000000000000000000000000000000000000'
                        ? BigInt(quote.data.totalAmount)
                        : undefined,
                brandName: brandName,
                fiatCurrency: variant.price.fiatCurrency, // Pass fiat currency for logging
            };

            devLog.log('Calling purchaseGiftCardServerAction with params:', params);

            const result = await purchaseGiftCardServerAction(params);

            if (result.success && result.txHash) {
                toast.success(`Gift card purchased successfully! Tx: ${result.txHash.substring(0, 10)}...`);
                // Refresh the balance after successful purchase
                refreshBalance();
                onOpenChange(false); // Close the drawer
            } else {
                toast.error(`Purchase failed: ${result.error || 'Unknown server error'}`);
            }
        } catch (error: any) {
            console.error('Error purchasing gift card:', error);
            toast.error(`Error purchasing gift card: ${error.message || 'Unknown error'}`);
        } finally {
            setIsProcessing(false);
        }
    };

    // Calculate total price from quote or fallback to variant price
    const calculateTotalPrice = () => {
        if (quote?.data) {
            return parseFloat(quote.data.totalAmount);
        }
        if (variant) {
            return parseFloat(variant.price.fiatValue);
        }
        return 0;
    };

    // Get digital asset amount from quote
    const getDigitalAssetAmount = () => {
        if (quote?.data) {
            return parseFloat(quote.data.digitalAssetAmount);
        }
        return 0;
    };

    // Get currency symbol for display
    const currencySymbol =
        variant?.price?.fiatCurrency === 'USD'
            ? '$'
            : variant?.price?.fiatCurrency === 'EUR'
                ? '€'
                : variant?.price?.fiatCurrency === 'CAD'
                    ? 'CA$'
                    : variant?.price?.fiatCurrency === 'BRL'
                        ? 'R$'
                        : variant?.price?.fiatCurrency || '$'; // Default to $ if not matched

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="max-w-md mx-auto bg-[#fff1d6] border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700">
                <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-6">
                        <DrawerHeader className="p-0">
                            <DrawerTitle className="text-[#b74b28]">Purchase Gift Card</DrawerTitle>
                        </DrawerHeader>
                        <DrawerClose className="h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </DrawerClose>
                    </div>

                    {variant ? (
                        <>
                            <div className="flex items-start mb-6">
                                <div className="h-20 w-20 rounded-md overflow-hidden mr-4 border-2 border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700 flex items-center justify-center bg-white">
                                    {brandImageUrl ? (
                                        <img
                                            src={brandImageUrl}
                                            alt={brandName}
                                            className="h-full w-full object-contain"
                                        />
                                    ) : (
                                        <Gift className="h-10 w-10 text-gray-400" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg text-[#b74b28]">{brandName}</h3>
                                    <p className="text-sm text-[#b74b28]">Gift Card</p>
                                    <div className="mt-2">
                                        <p className="font-medium text-[#e87f4e]">
                                            $ {variant.price.fiatValue} {variant.price.fiatCurrency}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div>
                                    <h4 className="text-sm font-medium mb-2 text-[#b74b28]">Payment Method</h4>
                                    <div className="p-3 border-2 border-black rounded-md bg-[#fff1d6] shadow-[-2px_2px_0px_#000000] shadow-yellow-700">
                                        <div className="flex items-center">
                                            {paymentToken ? (
                                                <>
                                                    <img
                                                        src={paymentToken.image}
                                                        alt={paymentToken.symbol}
                                                        className="w-6 h-6 mr-2 rounded-full"
                                                        onError={e => {
                                                            // Fallback to a generic token icon if image fails to load
                                                            (e.target as HTMLImageElement).src = '/token-placeholder.png';
                                                            (e.target as HTMLImageElement).onerror = null;
                                                        }}
                                                    />
                                                    <div>
                                                        <div className="text-[#b74b28]">{paymentToken.symbol}</div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex items-center">
                                                    <div className="w-6 h-6 rounded-full bg-gray-200 mr-2 flex items-center justify-center">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    </div>
                                                    <div>Loading token...</div>
                                                </div>
                                            )}
                                            <div className="ml-auto font-medium text-[#b74b28]">
                                                <Currency amount={stablecoinBalance} />
                                            </div>
                                        </div>
                                    </div>
                                    {!hasSufficientBalance && !isLoadingBalances && (
                                        <p className="text-red-500 text-sm mt-2">
                                            Insufficient {paymentToken?.symbol || 'token'} balance. Please add more{' '}
                                            {paymentToken?.symbol || 'funds'} to your wallet.
                                        </p>
                                    )}
                                    <p className="text-sm text-gray-600 mt-4">
                                        The gift card will be delivered to the email address set by your parent.
                                    </p>
                                </div>

                                <div className="pt-4 border-t">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm text-[#b74b28]">Gift Card Amount</span>
                                        <span className="text-sm text-[#b74b28]">
                                            $ {variant.price.fiatValue} {variant.price.fiatCurrency}
                                        </span>
                                    </div>
                                    <div className="flex justify-between font-medium text-[#b74b28] mb-2">
                                        <span>Total</span>
                                        <div className="text-right">
                                            <div className="text-[#e87f4e]">
                                                <Currency amount={calculateTotalPrice()} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full space-y-2 pt-2 border-t border-white">
                                        {isFetchingQuote ? (
                                            <div className="flex items-center justify-center py-2 text-sm">
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                <span>Calculating quote...</span>
                                            </div>
                                        ) : quoteError ? (
                                            <div className="text-red-500 text-sm text-center py-2">{quoteError}</div>
                                        ) : (
                                            <></>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <DrawerFooter className="p-0 flex-row justify-between items-center">
                                    <div className="font-bold text-lg text-[#b74b28]">
                                        <Currency amount={calculateTotalPrice()} />
                                    </div>
                                    <Button
                                        onClick={handlePurchase}
                                        disabled={
                                            isProcessing ||
                                            isLoadingBalances ||
                                            isLoadingPermissions ||
                                            !giftCardEnabled ||
                                            (maxGiftCardAmount !== null && calculateTotalPrice() > maxGiftCardAmount) ||
                                            !hasSufficientBalance
                                        }
                                        title={
                                            !giftCardEnabled
                                                ? 'Not authorized for gift card purchases'
                                                : maxGiftCardAmount !== null && calculateTotalPrice() > maxGiftCardAmount
                                                    ? `Exceeds your ${currencySymbol}${maxGiftCardAmount} spending limit`
                                                    : !hasSufficientBalance
                                                        ? `Insufficient ${paymentToken?.symbol || 'token'} balance`
                                                        : 'Purchase Gift Card'
                                        }
                                        className="border-[2px] border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700 bg-[#e87f4e] hover:bg-[#d76e3d] text-white"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            'Purchase Now'
                                        )}
                                    </Button>
                                </DrawerFooter>
                                {maxGiftCardAmount !== null && calculateTotalPrice() > maxGiftCardAmount && (
                                    <p className="text-sm text-red-500 mt-2">
                                        Exceeds your spending limit of <Currency amount={maxGiftCardAmount} />
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="py-8 text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                            <p>Loading gift card details...</p>
                        </div>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    );
}
