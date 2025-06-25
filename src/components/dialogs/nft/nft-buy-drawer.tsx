'use client';

import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Currency } from '@/components/shared/currency-symbol';
import { useAuth } from '@/contexts/authContext';
import { buyNFT } from '@/server/crypto/nft';
import { getKidPermissions } from '@/server/permissions';
import {
  availableTokens,
  getMultiTokenBalances,
  getExchangeRate,
  getEthStableRate,
  getRealExchangeRate,
} from '@/lib/tokens';
import { getDailySpendingLimits } from '@/server/permissions';
import { canMakeSpending, recordSpending } from '@/server/spending-tracker';
import type { Token, TokenData } from '@/types/nft';
import { devLog } from '@/lib/devlog';

interface NFTBuyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: TokenData | null;
}

export function NFTBuyDrawer({ open, onOpenChange, token }: NFTBuyDrawerProps) {
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [maxTradeAmount, setMaxTradeAmount] = useState<number | null>(null);
  const [nftEnabled, setNftEnabled] = useState<boolean>(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState<boolean>(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState<boolean>(false);
  const [tokenBalances, setTokenBalances] = useState<number[]>([]);
  const [userCurrencySymbol, setUserCurrencySymbol] = useState('');
  const [stableRate, setStableRate] = useState<number>(0);
  const [sufficientBalanceTokens, setSufficientBalanceTokens] = useState<
    {
      value: string;
      label: string;
      balance: number;
      convertedBalance: number;
      image: string;
      symbol: string;
      contract: string;
    }[]
  >([]);
  const { user } = useAuth();

  // Spending limits state
  const [spendingLimits, setSpendingLimits] = useState<any>(null);
  const [isLoadingLimits, setIsLoadingLimits] = useState(false);

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (!open) {
      setIsProcessing(false);
    } else {
      // Reset selected currency when drawer opens
      setSelectedCurrency('');
    }
  }, [open]);

  // Fetch user permissions & stable rate
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setNftEnabled(false);
        setMaxTradeAmount(null);
        setStableRate(0);
        return;
      }
      try {
        setIsLoadingPermissions(true);
        const response = await getKidPermissions(user.id);
        if (response.status === 200 && response.data) {
          setNftEnabled(response.data.nftEnabled ?? true);
          setMaxTradeAmount(response.data.maxNftTradeAmount ?? null);
        } else {
          setNftEnabled(true);
          setMaxTradeAmount(null);
        }
        const stableRate = await getEthStableRate(user.family?.currencyAddress || '');
        setStableRate(stableRate);
      } catch (error) {
        console.error('Error fetching permissions', error);
        setNftEnabled(true);
        setMaxTradeAmount(null);
        setStableRate(0);
      } finally {
        setIsLoadingPermissions(false);
      }
    };
    if (open) {
      fetchPermissions();
    }
  }, [open, user]);

  // Function to refresh spending limits
  const refreshSpendingLimits = async () => {
    if (!user?.id) return;
    setIsLoadingLimits(true);
    try {
      const limits = await getDailySpendingLimits(user.id);
      setSpendingLimits(limits.success ? limits.data : null);
    } catch (error) {
      console.error('Error fetching spending limits:', error);
    } finally {
      setIsLoadingLimits(false);
    }
  };

  // Load spending limits when drawer opens
  useEffect(() => {
    if (open && user?.id) {
      refreshSpendingLimits();
    }
  }, [open, user?.id]);

  // Fetch token balances and convert to user's currency
  useEffect(() => {
    const fetchBalances = async () => {
      if (!open || !user || !user.walletAddress || !user.family?.currencyAddress || !token) {
        return;
      }

      try {
        setIsLoadingBalances(true);

        // Get the NFT price plus the 2% platform fee
        const nftPrice = calculateTotalPrice();

        // Get all token balances
        const balances = await getMultiTokenBalances(user.walletAddress);
        setTokenBalances(balances);

        // Get user's currency address
        const userCurrencyAddress = user.family.currencyAddress;

        // Get user's currency symbol
        const userCurrencyToken = availableTokens.find(
          t => t.contract.toLowerCase() === userCurrencyAddress.toLowerCase()
        );
        const userCurrencySymbol = userCurrencyToken?.symbol || '';
        setUserCurrencySymbol(userCurrencySymbol);

        // Process each token with balance
        const tokensWithSufficientBalance = await Promise.all(
          availableTokens.map(async (tokenInfo, index) => {
            const amount = balances[index] || 0;

            // Skip tokens with zero balance
            if (amount <= 0) return null;

            try {
              // Convert token value to user's currency
              const exchangeRate = await getExchangeRate(tokenInfo.contract, userCurrencyAddress);
              const valueInUserCurrency = amount * exchangeRate;

              // Check if balance is sufficient for purchase
              if (valueInUserCurrency >= nftPrice) {
                return {
                  value: tokenInfo.symbol,
                  label: tokenInfo.name,
                  balance: amount,
                  convertedBalance: valueInUserCurrency,
                  image: tokenInfo.image,
                  symbol: tokenInfo.symbol,
                  contract: tokenInfo.contract,
                };
              }
            } catch (error) {
              console.error(`Error calculating value for ${tokenInfo.symbol}:`, error);
            }
            return null;
          })
        );

        // Filter out null values
        const validPaymentOptions = tokensWithSufficientBalance.filter(
          token => token !== null
        ) as typeof sufficientBalanceTokens;

        setSufficientBalanceTokens(validPaymentOptions);

        // Auto-select first token with sufficient balance if available
        if (validPaymentOptions.length > 0 && !selectedCurrency) {
          setSelectedCurrency(validPaymentOptions[0].value);
        }
      } catch (error) {
        console.error('Error fetching token balances:', error);
        toast.error('Failed to load your token balances');
      } finally {
        setIsLoadingBalances(false);
      }
    };

    fetchBalances();
  }, [open, token, user]);

  // Handle buy action
  const handleBuy = async () => {
    if (!token || !user || !selectedCurrency) return;

    try {
      setIsProcessing(true);

      // Get the selected token to pay with
      const paymentToken = sufficientBalanceTokens.find(t => t.value === selectedCurrency);
      if (!paymentToken) {
        toast.error('Selected payment method not found');
        return;
      }

      // Get token contract and ID from the NFT token
      const contractAddress = token.token.contract;
      const tokenId = token.token.tokenId;

      // Get the actual price (not displayed price) from the token data
      const price =
        user?.family?.currencyAddress === '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4'
          ? token.market.floorAsk?.price?.amount?.decimal! * stableRate || 0
          : token.market.floorAsk?.price?.amount?.decimal || 0;
      // Add 2% platform fee
      const ethPrice = token?.market?.topBid?.price?.amount?.native;
      const totalPrice = price * 1.02;

      // Check spending limits before proceeding
      const familyCurrency = user.family?.currencyAddress || '';
      let amountInStable = totalPrice;

      // Convert to stablecoin value if not already in user's currency
      if (paymentToken.symbol !== familyCurrency) {
        const exchangeRate = await getRealExchangeRate(paymentToken.contract, familyCurrency);
        if (exchangeRate) {
          amountInStable = totalPrice * exchangeRate;
        }
      }

      const canSpend = await canMakeSpending(user.id, 'NFT', amountInStable, selectedCurrency);
      if (!canSpend.canSpend) {
        toast.error(canSpend.reason || 'NFT purchase amount exceeds daily spending limit');
        return;
      }

      devLog.log('Stable Rate:', stableRate);
      // Call the server-side function to execute the purchase
      const result = await buyNFT(
        user.id,
        tokenId,
        contractAddress,
        totalPrice,
        paymentToken.contract,
        user.family?.currencyAddress || '',
        stableRate
      );

      if (result.success) {
        // Record the spending transaction
        try {
          let exchangeRate = 1;
          if (paymentToken.symbol !== familyCurrency) {
            const rate = await getRealExchangeRate(paymentToken.symbol, familyCurrency);
            if (rate) {
              exchangeRate = rate;
            }
          }

          await recordSpending({
            userId: user.id,
            category: 'NFT',
            amountInStablecoin: amountInStable,
            originalAmount: totalPrice,
            originalToken: paymentToken.symbol,
            transactionHash: result.txHash,
          });

          // Refresh spending limits after successful transaction
          await refreshSpendingLimits();
        } catch (recordError) {
          console.error('Error recording spending:', recordError);
          // Don't fail the transaction if recording fails
        }

        toast.success('NFT purchased successfully!');
        onOpenChange(false); // Close the drawer
      } else {
        toast.error(`Failed to purchase NFT: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Error purchasing NFT:', error);
      toast.error(`Error purchasing NFT: ${error.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate price with 2% platform fee
  const calculateTotalPrice = () => {
    if (user?.family?.currencyAddress === '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4') {
      const basePrice = token?.market.floorAsk?.price?.amount?.decimal! * stableRate || 0;
      devLog.log('Base Price:', basePrice);
      devLog.log('Stable Rate:', stableRate);
      return basePrice * 1.02; // 2% platform fee
    }
    const basePrice = token?.market.floorAsk?.price?.amount?.decimal || 0;
    return basePrice * 1.02; // 2% platform fee
  };

  // Selected token data
  const selectedTokenData = sufficientBalanceTokens.find(t => t.value === selectedCurrency);

  // Custom SelectValue component to show token logo and symbol
  const CustomSelectValue = () => {
    if (!selectedTokenData) {
      return <span>Select payment token</span>;
    }

    return (
      <div className="flex items-center justify-between w-full">
        <img
          src={selectedTokenData.image || '/placeholder.svg'}
          alt={selectedTokenData.symbol}
          className="w-5 h-5 mr-2 rounded-full"
        />
        <span>{selectedTokenData.symbol}</span>
        <span className="ml-auto mr-2">
          <Currency amount={selectedTokenData.convertedBalance} />
        </span>
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto bg-[#fff1d6] border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <DrawerHeader className="p-0">
              <DrawerTitle className="text-[#b74b28]">Checkout</DrawerTitle>
            </DrawerHeader>
            <DrawerClose className="h-6 w-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </div>

          {token ? (
            <>
              <div className="flex items-start mb-6">
                <div className="h-20 w-20 rounded-md overflow-hidden mr-4 border-2 border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700">
                  <img
                    src={token.token.image || '/placeholder.svg?height=80&width=80'}
                    alt={token.token.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-[#b74b28]">{token.token.name}</h3>
                  <p className="text-sm text-[#b74b28]">{token.token.collection?.name}</p>
                  <div className="mt-2">
                    <p className="font-medium text-[#e87f4e]">
                      <Currency
                        amount={
                          user?.family?.currencyAddress ===
                          '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4'
                            ? token.market.floorAsk?.price?.amount?.decimal! * stableRate || 0
                            : token.market.floorAsk?.price?.amount?.decimal || 0
                        }
                      />
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div>
                  <h4 className="text-sm font-medium mb-2 text-[#b74b28]">Payment Method</h4>
                  {isLoadingBalances ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span>Loading your balances...</span>
                    </div>
                  ) : sufficientBalanceTokens.length > 0 ? (
                    <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                      <SelectTrigger className="border-2 border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700">
                        <CustomSelectValue />
                      </SelectTrigger>
                      <SelectContent sideOffset={5}>
                        {sufficientBalanceTokens.map((token, index) => (
                          <SelectItem
                            key={`${token.value}-${index}`}
                            value={token.value}
                            className="py-2"
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center">
                                <img
                                  src={token.image || '/placeholder.svg'}
                                  alt={token.symbol}
                                  className="w-6 h-6 mr-2 rounded-full"
                                />
                                <div>
                                  <div>{token.label}</div>
                                  <div className="text-xs text-gray-500">{token.symbol}</div>
                                </div>
                              </div>
                              <span className="text-sm ml-2">
                                <Currency amount={token.convertedBalance} />
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-red-500 p-3 border border-red-300 rounded-md bg-red-50">
                      Insufficient balance in all your tokens. Please add funds to purchase this
                      NFT.
                    </div>
                  )}
                </div>

                {/* Daily Spending Limits Display */}
                {spendingLimits && (
                  <div className="bg-muted/50 p-3 rounded-lg space-y-2 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Daily Spending Limits</span>
                      {isLoadingLimits && (
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                      )}
                    </div>

                    {spendingLimits.dailySpendingLimit && (
                      <div className="flex justify-between text-xs">
                        <span>Total Daily Limit:</span>
                        <span className="font-medium">
                          <Currency amount={spendingLimits.spentToday.totalSpent} /> /{' '}
                          <Currency amount={spendingLimits.dailySpendingLimit} />
                          {spendingLimits.remainingLimits.totalSpending !== null && (
                            <span className="text-green-600 ml-1">
                              (<Currency amount={spendingLimits.remainingLimits.totalSpending} />{' '}
                              left)
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {spendingLimits.dailyNftLimit && (
                      <div className="flex justify-between text-xs">
                        <span>NFT Limit:</span>
                        <span className="font-medium">
                          <Currency amount={spendingLimits.spentToday.nftSpent} /> /{' '}
                          <Currency amount={spendingLimits.dailyNftLimit} />
                          {spendingLimits.remainingLimits.nft !== null && (
                            <span className="text-green-600 ml-1">
                              (<Currency amount={spendingLimits.remainingLimits.nft} /> left)
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {!spendingLimits.dailySpendingLimit && !spendingLimits.dailyNftLimit && (
                      <div className="text-xs text-muted-foreground text-center">
                        No daily spending limits set
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-[#b74b28]">Item Price</span>
                    <span className="text-sm text-[#b74b28]">
                      <Currency
                        amount={
                          user?.family?.currencyAddress ===
                          '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4'
                            ? token.market.floorAsk?.price?.amount?.decimal! * stableRate || 0
                            : token.market.floorAsk?.price?.amount?.decimal || 0
                        }
                      />
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-[#b74b28]">Platform Fee (2%)</span>
                    <span className="text-sm text-[#b74b28]">
                      <Currency
                        amount={
                          user?.family?.currencyAddress ===
                          '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4'
                            ? (token.market.floorAsk?.price?.amount?.decimal! * stableRate || 0) *
                              0.02
                            : (token.market.floorAsk?.price?.amount?.decimal || 0) * 0.02
                        }
                      />
                    </span>
                  </div>
                  <div className="flex justify-between font-medium text-[#b74b28]">
                    <span>Total</span>
                    <div className="text-right">
                      <div className="text-[#e87f4e]">
                        <Currency amount={calculateTotalPrice()} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DrawerFooter className="p-0 flex-row justify-between items-center">
                <div className="font-bold text-lg text-[#b74b28]">
                  <Currency amount={calculateTotalPrice()} />
                </div>
                <Button
                  onClick={handleBuy}
                  disabled={
                    isProcessing ||
                    isLoadingBalances ||
                    isLoadingPermissions ||
                    !selectedCurrency ||
                    !nftEnabled ||
                    (maxTradeAmount !== null && calculateTotalPrice() > maxTradeAmount) ||
                    sufficientBalanceTokens.length === 0
                  }
                  title={
                    !selectedCurrency
                      ? 'Select a payment method'
                      : !nftEnabled
                        ? 'Not authorized for NFT actions'
                        : maxTradeAmount !== null && calculateTotalPrice() > maxTradeAmount
                          ? 'Exceeds your spending limit'
                          : sufficientBalanceTokens.length === 0
                            ? 'Insufficient balance'
                            : 'Buy this NFT'
                  }
                  className="border-[2px] border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700 bg-[#e87f4e] hover:bg-[#d76e3d] text-white"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Buy Now'
                  )}
                </Button>
              </DrawerFooter>
              {maxTradeAmount !== null && calculateTotalPrice() > maxTradeAmount && (
                <p className="text-sm text-red-500 mt-2">
                  Exceeds your spending limit of <Currency amount={maxTradeAmount} />
                </p>
              )}
            </>
          ) : (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Loading NFT details...</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
