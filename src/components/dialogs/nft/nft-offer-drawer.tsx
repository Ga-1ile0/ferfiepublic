'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Loader2, AlertTriangle, Info, Wallet } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Currency, Symbol } from '@/components/shared/currency-symbol';
import { useAuth } from '@/contexts/authContext';
import { makeOffer } from '@/server/crypto/nft';
import { getKidPermissions } from '@/server/permissions';
import { getStableEthRate, getTokenBalance } from '@/lib/tokens';
import type { Token } from '@/types/nft';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface NFTOfferDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: Token | null;
}

export function NFTOfferDrawer({ open, onOpenChange, token }: NFTOfferDrawerProps) {
  // We'll use ETH for all offers as per requirement
  const [offerAmount, setOfferAmount] = useState('');
  const [expirationDays, setExpirationDays] = useState('7');
  const [isProcessing, setIsProcessing] = useState(false);
  const [maxTradeAmount, setMaxTradeAmount] = useState<number | null>(null);
  const [nftEnabled, setNftEnabled] = useState<boolean>(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState<boolean>(false);
  const [ethStableRate, setEthStableRate] = useState(0);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const { user } = useAuth();

  // Fetch permissions and ETH rate when drawer opens
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setNftEnabled(false);
        setMaxTradeAmount(null);
        return;
      }
      try {
        setIsLoadingPermissions(true);
        setIsLoadingBalance(true);

        // Fetch permissions
        const response = await getKidPermissions(user.id);
        if (response.status === 200 && response.data) {
          setNftEnabled(response.data.nftEnabled ?? true);
          setMaxTradeAmount(response.data.maxNftTradeAmount ?? null);
        } else {
          setNftEnabled(true);
          setMaxTradeAmount(null);
        }

        // Fetch ETH/stablecoin rate
        const rate = await getStableEthRate(
          user?.family?.currencyAddress || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
        );
        setEthStableRate(rate);

        // Get real ETH balance for the user's wallet address
        if (user?.walletAddress) {
          try {
            // Use getTokenBalance helper which supports ETH balance checking
            const ethBalanceResult = await getTokenBalance(
              '0x0000000000000000000000000000000000000000', // ETH address
              user.walletAddress
            );

            // Format the balance if it's available
            if (ethBalanceResult !== null) {
              setEthBalance(ethBalanceResult.toFixed(6));
            } else {
              console.error('Failed to fetch ETH balance');
              setEthBalance('0.000000'); // Default to zero if fetching fails
            }
          } catch (error) {
            console.error('Error fetching ETH balance:', error);
            setEthBalance('0.000000');
          }
        } else {
          setEthBalance('0.000000');
        }
      } catch (error) {
        console.error('Error fetching data', error);
        setNftEnabled(true);
        setMaxTradeAmount(null);
        setEthBalance(null);
      } finally {
        setIsLoadingPermissions(false);
        setIsLoadingBalance(false);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open, user]);

  // Initialize offer amount when drawer opens or token changes
  useEffect(() => {
    if (!open) {
      setIsProcessing(false);
    } else if (token) {
      const floorPrice = token.market.floorAsk?.price?.amount?.decimal || 0;
      setOfferAmount((floorPrice * 0.9).toFixed(2));
    }
  }, [open, token]);

  // Calculate the ETH equivalent of the offer amount
  const ethOfferValue = useMemo(() => {
    if (!offerAmount || ethStableRate === 0) return '0.000000';
    try {
      const numericOffer = Number.parseFloat(offerAmount);
      if (isNaN(numericOffer)) return '0.000000';
      // Divide by rate to convert from family currency to ETH
      const ethValue = numericOffer / ethStableRate;
      return ethValue.toFixed(6);
    } catch (error) {
      console.error('Error calculating ETH offer value:', error);
      return '0.000000';
    }
  }, [offerAmount, ethStableRate]);

  // Check if offer meets minimum ETH threshold (0.0001 ETH)
  const meetsMinimumEthThreshold = useMemo(() => {
    try {
      const ethOfferValueNum = Number.parseFloat(ethOfferValue);
      return ethOfferValueNum >= 0.0001;
    } catch (error) {
      return false;
    }
  }, [ethOfferValue]);

  // Check if user has sufficient ETH balance
  const hasSufficientEthBalance = useMemo(() => {
    if (!ethBalance || !ethOfferValue) return false;

    const ethBalanceNum = parseFloat(ethBalance);
    const ethOfferNum = parseFloat(ethOfferValue);

    return !isNaN(ethBalanceNum) && !isNaN(ethOfferNum) && ethBalanceNum >= ethOfferNum;
  }, [ethBalance, ethOfferValue]);

  const handleSubmitOffer = async () => {
    if (!user) {
      toast.error('Please log in to perform this action');
      return;
    }
    if (!nftEnabled) {
      toast.error('NFT transactions are not enabled for your account');
      return;
    }
    if (!token || isProcessing || !offerAmount) return;

    const offerValue = parseFloat(offerAmount);
    // Check spending limit
    if (maxTradeAmount !== null && offerValue > maxTradeAmount) {
      toast.error('This offer exceeds your spending limit');
      return;
    }

    // Basic validation
    if (isNaN(offerValue) || offerValue <= 0) {
      toast.error('Please enter a valid offer amount');
      return;
    }

    // Check ETH balance
    if (!hasSufficientEthBalance) {
      toast.error(
        `Insufficient ETH balance. You need ${ethOfferValue} ETH but have ${ethBalance || '0'} ETH.`
      );
      return;
    }

    // Check minimum ETH threshold
    if (!meetsMinimumEthThreshold) {
      toast.error(`Offer must be at least 0.0001 ETH. Your current offer is ${ethOfferValue} ETH.`);
      return;
    }

    setIsProcessing(true);

    toast
      .promise(
        makeOffer(
          user.id,
          token.token.tokenId,
          token.token.contract,
          offerValue, // We send the offer amount in family currency, server will convert to ETH
          parseInt(expirationDays) || 7
        ),
        {
          pending: 'Processing your offer...',
          success: {
            render({ data }) {
              if (data && data.offerId) {
                return `Offer placed successfully! Offer ID: ${data.offerId.substring(0, 8)}...`;
              }
              return 'Offer placed successfully!';
            },
          },
          error: {
            render({ data }: any) {
              return data?.error || 'Failed to place offer. Please try again.';
            },
          },
        }
      )
      .finally(() => {
        setIsProcessing(false);
        onOpenChange(false);
      });
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const calculateDiscount = () => {
    if (!token || !offerAmount) return null;

    const floorPrice = token.market.floorAsk?.price?.amount?.decimal;
    if (!floorPrice) return null;

    const offerValue = parseFloat(offerAmount);
    if (isNaN(offerValue)) return null;

    const discount = ((floorPrice - offerValue) / floorPrice) * 100;
    return discount > 0 ? discount.toFixed(1) : null;
  };

  const discount = calculateDiscount();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto bg-[#fff1d6]">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <DrawerHeader className="p-0">
              <DrawerTitle className="text-[#b74b28]">Make an Offer</DrawerTitle>
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
                      Floor:{' '}
                      <Currency amount={token.market.floorAsk?.price?.amount?.decimal || 0} />
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                {/* ETH Balance & Info Banner */}
                <div className="p-3 rounded-md border border-amber-200 bg-amber-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-amber-600" />
                    <h4 className="text-sm font-medium text-amber-800">Making Offers in ETH</h4>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">
                    All offers are made in ETH (Ethereum). You input the price in your family
                    currency, but the actual offer will be placed in ETH. Minimum offer: 0.0001 ETH.
                  </p>

                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-amber-600" />
                    <h4 className="text-sm font-medium text-amber-800">ETH Balance</h4>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-sm text-amber-700">Available:</span>
                    <span className="text-sm text-amber-700">
                      {isLoadingBalance ? (
                        <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                      ) : (
                        `${ethBalance || '0.000000'} ETH`
                      )}
                    </span>
                  </div>
                </div>

                {/* Warnings */}
                {!isLoadingBalance && (
                  <>
                    {/* Insufficient ETH Warning */}
                    {ethBalance && !hasSufficientEthBalance && parseFloat(offerAmount) > 0 && (
                      <Alert variant="destructive" className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Insufficient ETH</AlertTitle>
                        <AlertDescription className="text-xs">
                          You need {ethOfferValue} ETH but have {ethBalance} ETH available.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Minimum Offer Warning */}
                    {parseFloat(offerAmount) > 0 && !meetsMinimumEthThreshold && (
                      <Alert variant="destructive" className="py-2 text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Offer Too Low</AlertTitle>
                        <AlertDescription className="text-xs">
                          Minimum offer is 0.0001 ETH. Your offer of {ethOfferValue} ETH is too low.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}

                <div>
                  <h4 className="text-sm font-medium mb-2 text-[#b74b28]">
                    Offer Amount ({user?.family?.currency || 'USD'})
                  </h4>
                  <div className="relative">
                    <Symbol className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={offerAmount}
                      onChange={e => setOfferAmount(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                      min={0}
                      max={maxTradeAmount !== null ? maxTradeAmount : undefined}
                      className="pl-9 border-2 border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700"
                    />
                  </div>
                  {discount && (
                    <p className="text-xs text-[#e87f4e] mt-1">{discount}% below floor price</p>
                  )}

                  {/* ETH Conversion Display */}
                  <div className="flex justify-between mb-2 mt-4">
                    <span className="text-sm font-medium text-[#b74b28]">ETH Equivalent</span>
                    <span className="text-sm font-medium text-[#b74b28]">{ethOfferValue} ETH</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2 text-[#b74b28]">Offer Expiration</h4>
                  <Select value={expirationDays} onValueChange={setExpirationDays}>
                    <SelectTrigger className="border-2 border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700">
                      <SelectValue placeholder="Select expiration" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5}>
                      <SelectItem key="day-1" value="1">
                        1 day
                      </SelectItem>
                      <SelectItem key="day-3" value="3">
                        3 days
                      </SelectItem>
                      <SelectItem key="day-7" value="7">
                        7 days
                      </SelectItem>
                      <SelectItem key="day-14" value="14">
                        14 days
                      </SelectItem>
                      <SelectItem key="day-30" value="30">
                        30 days
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between font-medium text-[#b74b28]">
                    <span>Total Offer</span>
                    <div className="text-right">
                      <div className="text-[#e87f4e]">
                        {offerAmount ? <Currency amount={parseFloat(offerAmount)} /> : '0'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DrawerFooter className="p-0 flex-row justify-between items-center">
                <div className="font-bold text-lg text-[#b74b28]">
                  {offerAmount ? <Currency amount={parseFloat(offerAmount)} /> : '0'}
                </div>
                <Button
                  onClick={handleSubmitOffer}
                  disabled={
                    isProcessing ||
                    isLoadingPermissions ||
                    !nftEnabled ||
                    !offerAmount ||
                    parseFloat(offerAmount) <= 0 ||
                    !hasSufficientEthBalance ||
                    !meetsMinimumEthThreshold
                  }
                  title={nftEnabled ? '' : 'Not authorized for NFT actions'}
                  className="border-[2px] border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700 bg-[#e87f4e] hover:bg-[#d76e3d] text-white"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Make Offer'
                  )}
                </Button>
              </DrawerFooter>
              {maxTradeAmount !== null && parseFloat(offerAmount) > maxTradeAmount && (
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
