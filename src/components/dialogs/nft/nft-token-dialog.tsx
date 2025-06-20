'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { BadgeCheck, Heart, Tag, ShoppingBag, ExternalLink, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Currency } from '@/components/shared/currency-symbol';
import { Address } from '@coinbase/onchainkit/identity';
import { Skeleton } from '@/components/ui/skeleton';
import { NFTBuyDrawer } from './nft-buy-drawer';
import { NFTOfferDrawer } from './nft-offer-drawer';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TokenActivity, NFTTokenDialogProps } from '@/types/nft';
import { useAuth } from '@/contexts/authContext';
import { getEthStableRate } from '@/lib/tokens';
import { getKidPermissions } from '@/server/permissions';
import { devLog } from '@/lib/devlog';

export function NFTTokenDialog({
  open,
  onOpenChange,
  token,
  isLoading = false,
}: NFTTokenDialogProps) {
  const [activities, setActivities] = useState<TokenActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [lastSale, setLastSale] = useState<number | null>(null);
  const [stableRate, setStableRate] = useState<number>(1);
  const [buyDrawerOpen, setBuyDrawerOpen] = useState(false);
  const [offerDrawerOpen, setOfferDrawerOpen] = useState(false);
  const [maxTradeAmount, setMaxTradeAmount] = useState<number | null>(null);
  const [nftEnabled, setNftEnabled] = useState<boolean>(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState<boolean>(false);
  const { user } = useAuth();

  // Fetch token activities from Reservoir API
  const fetchActivities = useCallback(async () => {
    if (!token?.token.contract || !token?.token.tokenId || !open) return;

    try {
      setIsLoadingActivities(true);

      // Construct the token identifier in the format required by the API
      const tokenIdentifier = `${token.token.contract}:${token.token.tokenId}`;

      // Build the API URL with query parameters
      const baseUrl = `https://api-base.reservoir.tools/tokens/${tokenIdentifier}/activity/v5`;
      const params = new URLSearchParams({
        limit: '20', // Limit to 20 items as requested
        sortBy: 'eventTimestamp',
        includeMetadata: 'true',
      });

      const url = `${baseUrl}?${params.toString()}`;

      // Make the API request
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data && data.activities) {
        setActivities(data.activities.slice(0, 20)); // Ensure we only use the first 20
      }
    } catch (error) {
      console.error('Error fetching token activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  }, [token?.token.contract, token?.token.tokenId, open]);

  // Fetch activities when dialog opens
  useEffect(() => {
    async function fetchData() {
      if (open && token) {
        const address = user?.family?.currencyAddress;
        devLog.log('Family currency Address:', address);
        if (address) {
          try {
            // Await the rate since it's an async function
            const rate = await getEthStableRate(address);
            setStableRate(rate);
            devLog.log('Exchange rate:', rate);

            const tokenPrice = token.token.lastSale?.price?.amount?.decimal;
            if (tokenPrice) {
              const calculatedSale = Math.round(rate * tokenPrice * 100) / 100;
              setLastSale(calculatedSale);
              devLog.log('Last sale:', tokenPrice);
              devLog.log('Last sale in family currency:', calculatedSale);
            } else {
              devLog.log('Token price is not available');
              setLastSale(null);
            }
          } catch (error) {
            console.error('Error getting exchange rate:', error);
            setLastSale(null);
          }
        }
        fetchActivities();
      }
    }

    fetchData();
  }, [open, token, fetchActivities, user?.family?.currencyAddress]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.id) {
        setNftEnabled(false);
        setMaxTradeAmount(null);
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
      } catch (error) {
        console.error('Error fetching permissions', error);
        setNftEnabled(true);
        setMaxTradeAmount(null);
      } finally {
        setIsLoadingPermissions(false);
      }
    };
    if (open) {
      fetchPermissions();
    }
  }, [open, user?.id]);

  // Format timestamp to readable date
  const formatDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  // Memoize token stats to avoid recalculation
  const tokenStats = useMemo(() => {
    if (!token) return [];

    return [
      {
        label: 'Top Offer',
        value:
          token?.market?.topBid?.price?.amount?.decimal != null ? (
            <Currency
              amount={
                user?.family?.currencyAddress === '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4'
                  ? token.market.topBid.price.amount.decimal * stableRate * 1.02
                  : token.market.topBid.price.amount.decimal * 1.02
              }
            />
          ) : (
            'No offers'
          ),
      },
      {
        label: 'Collection Floor',
        value:
          token?.token?.collection?.floorAskPrice?.amount?.decimal != null ? (
            <Currency
              amount={
                user?.family?.currencyAddress === '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4'
                  ? token.token.collection.floorAskPrice.amount.decimal * stableRate * 1.02
                  : token.token.collection.floorAskPrice.amount.decimal * 1.02
              }
            />
          ) : (
            'N/A'
          ),
      },
      {
        label: 'Rarity',
        value: token?.token?.rarityRank ? `#${token.token.rarityRank}` : 'N/A',
      },
      {
        label: 'Token ID',
        value:
          token?.token?.tokenId?.length > 8
            ? `${token.token.tokenId.substring(0, 4)}...${token.token.tokenId.substring(token.token.tokenId.length - 4)}`
            : token?.token?.tokenId,
      },
      {
        label: 'Last Sale',
        value: lastSale != null ? <Currency amount={lastSale} /> : 'N/A',
      },
    ];
  }, [token, lastSale]);

  // Get activity icon based on type
  const getActivityIcon = useCallback((type: string) => {
    switch (type.toLowerCase()) {
      case 'sale':
        return <ShoppingBag className="h-4 w-4" />;
      case 'ask':
        return <Tag className="h-4 w-4" />;
      case 'bid':
        return <Heart className="h-4 w-4" />;
      case 'transfer':
        return <ExternalLink className="h-4 w-4" />;
      default:
        return <ExternalLink className="h-4 w-4" />;
    }
  }, []);

  // Handle buy now action
  const handleBuyNow = useCallback(() => {
    devLog.log('Buy now clicked for token:', token?.token.tokenId);
    setBuyDrawerOpen(true);
  }, [token?.token.tokenId]);

  // Get blockchain explorer URL for transaction hash
  const getExplorerUrl = useCallback((txHash: string) => {
    return `https://basescan.org/tx/${txHash}`;
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 border-0 bg-[#fab049] bg-[url('/Confetti.png')] bg-repeat w-[100vw] h-full max-w-[100vw] max-h-[100vh] overflow-y-scroll flex flex-col">
          <DialogTitle className="sr-only">NFT Token Info</DialogTitle>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              {isLoading ? (
                <Skeleton className="h-8 w-48" />
              ) : (
                <h2 className="text-xl font-bold text-shadow-rust">{token?.token.name}</h2>
              )}
              {/* <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="rounded-full"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
              </Button> */}
            </div>

            {/* Content with scrollable area */}
            <div
              className="flex-1 overflow-y-auto overflow-x-hidden"
              style={{ maxHeight: 'calc(100vh - 140px)' }}
            >
              {/* NFT Image */}
              {isLoading ? (
                <Skeleton className="w-full aspect-square" />
              ) : (
                <div className="w-full">
                  <img
                    src={token?.token.image || '/placeholder.svg?height=600&width=600'}
                    alt={token?.token.name}
                    className="w-full aspect-square object-cover"
                  />
                </div>
              )}

              {/* Collection and Owner Info */}
              <div className="p-4">
                {isLoading ? (
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full overflow-hidden">
                        <img
                          src={
                            token?.token.collection?.image ||
                            '/placeholder.svg?height=100&width=100'
                          }
                          alt={token?.token.collection?.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium truncate max-w-[120px]">
                          {token?.token.collection?.name}
                        </span>
                        {token?.token.collection?.verified && (
                          <BadgeCheck className="h-4 w-4 text-blue-500 ml-1" />
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span>Owned by </span>
                      {token?.token.owner ? (
                        <Address
                          address={token.token.owner as `0x${string}`}
                          className="text-[#e87f4e]"
                        />
                      ) : (
                        'Unknown'
                      )}
                    </div>
                  </div>
                )}

                {/* Token Info Card */}
                <Card className="mt-4 border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Token Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Horizontal Stats Scroll */}
                    <div className="overflow-x-auto pb-2">
                      {isLoading ? (
                        <div className="flex gap-4 min-w-max">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Skeleton key={i} className="h-16 w-24" />
                          ))}
                        </div>
                      ) : (
                        <div className="flex gap-4 min-w-max">
                          {tokenStats.map((stat, index) => (
                            <div
                              key={index}
                              className="flex flex-col items-center p-2 min-w-[80px]"
                            >
                              <span className="text-xs text-muted-foreground">{stat.label}</span>
                              <span className="font-medium mt-1">{stat.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Traits Section */}
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-3">Traits</h3>
                  {isLoading ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[1, 2, 3, 4, 5, 6].map(i => (
                        <Skeleton key={i} className="h-20" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {token?.token.attributes?.map((attr, index) => (
                        <div
                          key={`${attr.key}-${attr.value}-${index}`}
                          className="p-3 border rounded-lg bg-[#fff1d6] border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700"
                        >
                          <p className="text-xs text-[#b74b28]">{attr.key}</p>
                          <p className="font-medium text-[#e87f4e]">{attr.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity Section */}
                <div className="mt-6">
                  <h3 className="text-lg font-medium mb-3">Activity</h3>
                  {isLoadingActivities && activities.length === 0 ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <Skeleton key={i} className="h-16" />
                      ))}
                    </div>
                  ) : (
                    <Card className="border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700">
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Event</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>From</TableHead>
                              <TableHead>To</TableHead>
                              <TableHead className="text-right">Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activities.length > 0 ? (
                              activities.map((activity, index) => (
                                <TableRow
                                  key={`${activity.contract}-${activity.timestamp}-${index}`}
                                >
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                        {getActivityIcon(activity.type)}
                                      </div>
                                      <div>
                                        <p className="font-medium capitalize">{activity.type}</p>
                                        {activity.order?.source?.name && (
                                          <p className="text-xs text-muted-foreground">
                                            {activity.order.source.name}
                                          </p>
                                        )}
                                        {activity.fillSource?.name &&
                                          !activity.order?.source?.name && (
                                            <p className="text-xs text-muted-foreground">
                                              {activity.fillSource.name}
                                            </p>
                                          )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {activity.price?.amount?.native != null ? (
                                      <Currency
                                        amount={stableRate * activity.price.amount.native}
                                      />
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {activity.fromAddress && (
                                      <Address
                                        address={activity.fromAddress as `0x${string}`}
                                        className="text-xs"
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {activity.toAddress ? (
                                      <Address
                                        address={activity.toAddress as `0x${string}`}
                                        className="text-xs"
                                      />
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {activity.txHash ? (
                                      <a
                                        href={getExplorerUrl(activity.txHash)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline text-[#e87f4e]"
                                      >
                                        {formatDate(activity.timestamp)}
                                      </a>
                                    ) : (
                                      formatDate(activity.timestamp)
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-4">
                                  No activity found for this token
                                </TableCell>
                              </TableRow>
                            )}
                            {isLoadingActivities && activities.length > 0 && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-4">
                                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Buy Actions */}
            <div className=" gap-1 border-t bg-[#fab049] p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Current Price</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : token?.market?.floorAsk?.price?.amount?.decimal != null ? (
                  <div className="text-md font-bold text-[#b74b28]">
                    <Currency
                      amount={
                        user?.family?.currencyAddress ===
                        '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4'
                          ? token.market.floorAsk.price.amount.decimal * stableRate * 1.02
                          : token.market.floorAsk.price.amount.decimal * 1.02
                      }
                    />
                  </div>
                ) : (
                  <div className="text-md font-bold text-[#b74b28]">N/A</div>
                )}
              </div>
              <div className="flex gap-2">
                {/* TEMPORARILY DISABLED: Offer Button - Will be re-enabled in future updates */}
                {/*
                <Button
                  variant="outline"
                  onClick={handleMakeOffer}
                  disabled={isLoading || isLoadingPermissions || !nftEnabled}
                  className={"border-[2px] border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700"}
                  title={ !nftEnabled ? 'Not authorized for NFT actions' : '' }
                >
                  Make Offer
                </Button>
                */}
                <Button
                  onClick={handleBuyNow}
                  disabled={
                    isLoading ||
                    isLoadingPermissions ||
                    !nftEnabled ||
                    (maxTradeAmount !== null &&
                      token?.market?.floorAsk?.price?.amount?.decimal != null &&
                      token.market.floorAsk.price.amount.decimal > maxTradeAmount)
                  }
                  className={
                    'border-[2px] border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700'
                  }
                  title={
                    nftEnabled &&
                    maxTradeAmount !== null &&
                    token?.market?.floorAsk?.price?.amount?.decimal != null &&
                    token.market.floorAsk.price.amount.decimal > maxTradeAmount
                      ? 'Exceeds your spending limit'
                      : 'Not authorized for NFT actions'
                  }
                >
                  Buy Now
                </Button>
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
      {nftEnabled && (
        <>
          <NFTBuyDrawer open={buyDrawerOpen} onOpenChange={setBuyDrawerOpen} token={token} />
          {/* TEMPORARILY DISABLED: Offer Drawer - Will be re-enabled in future updates */}
          {/* <NFTOfferDrawer open={offerDrawerOpen} onOpenChange={setOfferDrawerOpen} token={token} /> */}
        </>
      )}
    </>
  );
}
