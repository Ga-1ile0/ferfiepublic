'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Loader2, TrendingUp, Tag, AlertTriangle, Info } from 'lucide-react';
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
import { getKidPermissions } from '@/server/permissions';
import type { NFTItem } from '@/lib/nfts';
import { toast } from 'react-toastify';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { getStableEthRate } from '@/lib/tokens';
import { listNFTForSale, cancelListing, acceptNFTOffer } from '@/server/crypto/nft'; // Assuming this is your server action
import { devLog } from '@/lib/devlog';

interface OpenSeaOrder {
    created_date: string;
    closing_date: string;
    listing_time: number;
    expiration_time: number;
    order_hash: string;
    protocol_data: any; // Define more strictly if needed
    protocol_address: string;
    current_price: string;
    maker: { address: string };
    taker_asset_bundle: {
        assets: Array<{
            decimals: number;
            asset_contract: {
                symbol: string;
            };
        }>;
    };
    // other fields from OpenSea order
}

interface NFTSellDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    nft: NFTItem | null;
}

// Helper to format price from smallest unit (e.g., wei)
const formatCryptoPrice = (priceString: string, decimals: number): string => {
    if (!priceString || typeof decimals !== 'number') return '0.00';
    try {
        const priceBigInt = BigInt(priceString);
        const divisor = BigInt(10) ** BigInt(decimals);
        // Perform division using floating point for display
        const price = Number(priceBigInt) / Number(divisor);
        return price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 8, // Show more precision for crypto
        });
    } catch (e) {
        console.error('Error formatting price:', e);
        return 'N/A';
    }
};

// Helper to format Unix timestamp to readable date
const formatTimestampToDate = (unixTimestampInSeconds: number): string => {
    if (!unixTimestampInSeconds) return 'N/A';
    return new Date(unixTimestampInSeconds * 1000).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export function NFTSellDrawer({ open, onOpenChange, nft }: NFTSellDrawerProps) {
    const [sellPrice, setSellPrice] = useState('');
    const [expirationDays, setExpirationDays] = useState('7'); // Default to 7 days
    const [isProcessing, setIsProcessing] = useState(false);
    const [nftEnabled, setNftEnabled] = useState<boolean>(true);
    const [isLoadingPermissions, setIsLoadingPermissions] = useState<boolean>(false);
    const [topBid, setTopBid] = useState<{
        amount: number;
        currency: string;
        bidder: string;
    } | null>(null);
    const [ethStableRate, setEthStableRate] = useState(0);
    const { user } = useAuth(); // Assert user type

    const [currentListing, setCurrentListing] = useState<OpenSeaOrder | null>(null);
    const [isLoadingListing, setIsLoadingListing] = useState<boolean>(false);
    const [listingError, setListingError] = useState<string | null>(null);

    // Memoized ETH value that reacts to both ethStableRate and sellPrice changes
    const ethValue = useMemo(() => {
        // Only calculate if we have both values
        if (ethStableRate > 0 && sellPrice) {
            try {
                const numericPrice = Number.parseFloat(sellPrice);
                if (!isNaN(numericPrice)) {
                    // Convert from stable to ETH
                    return (numericPrice * ethStableRate).toFixed(6);
                }
            } catch (error) {
                console.error('Error calculating ETH value:', error);
            }
        }
        return '0.000000'; // Default value
    }, [ethStableRate, sellPrice]); // Recalculate whenever either value changes

    // Reset state when drawer opens/closes or NFT changes
    useEffect(() => {
        if (!open) {
            setIsProcessing(false);
            // Do not reset sellPrice here if we want it to persist from nft.value
            setCurrentListing(null);
            setIsLoadingListing(false);
            setListingError(null);
            setTopBid(null); // Reset top bid when closing
        } else if (nft) {
            setSellPrice(nft.value.toFixed(2)); // Set initial price from NFT's current value
            fetchTopBid(nft.id, nft.value); // Pass nft.value for simulation
        }
    }, [open, nft]); // Removed user from deps as it's handled in other effects

    const fetchTopBid = useCallback(
        async (nftId: string, currentNftValue: number) => {
            setTopBid({
                amount: currentNftValue,
                currency: user?.family?.currency || 'ETH',
                bidder: currentNftValue > 0 ? 'Generous Collector' : 'No Bids Yet',
            });
        },
        [user?.family?.currency, nft] // Add nft to ensure it uses the latest
    );

    // Fetch permissions and ETH stable rate
    useEffect(() => {
        const fetchData = async () => {
            if (!user) {
                setNftEnabled(false);
                return;
            }
            try {
                setIsLoadingPermissions(true);
                const permResponse = await getKidPermissions(user.id);
                if (permResponse.status === 200 && permResponse.data) {
                    setNftEnabled(permResponse.data.nftEnabled ?? true);
                } else {
                    setNftEnabled(true); // Default if fetch fails or no specific permission
                }

                const rate = await getStableEthRate(
                    user?.family?.currencyAddress || '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' // Default stablecoin address
                );
                setEthStableRate(rate);
            } catch (error) {
                console.error('Error fetching permissions or ETH rate:', error);
                setNftEnabled(true); // Default on error
                setEthStableRate(0); // Default on error
            } finally {
                setIsLoadingPermissions(false);
            }
        };
        if (open && user) {
            fetchData();
        }
    }, [open, user]);

    // Fetch current listing status from OpenSea
    useEffect(() => {
        if (open) {
            devLog.log('Fetching listing status for NFT:', nft, user?.walletAddress);
            const fetchListingStatus = async () => {
                setIsLoadingListing(true);
                setListingError(null);
                setCurrentListing(null);

                devLog.log('Fetching listing status for NFT:', nft);
                const chain = 'base';
                const protocol = 'seaport';

                const url = `https://api.opensea.io/api/v2/orders/${chain}/${protocol}/listings?asset_contract_address=${nft?.contract}&token_ids=${nft?.tokenId}&maker=${user?.walletAddress}&order_by=created_date&order_direction=desc&limit=1`;

                try {
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            accept: 'application/json',
                            'x-api-key': process.env.NEXT_PUBLIC_OPENSEA_API_KEY || 'N/A',
                        },
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error('OpenSea API Error:', errorData);
                        throw new Error(
                            `Failed to fetch listing: ${response.statusText} ${errorData.detail || ''}`
                        );
                    }

                    const data = await response.json();
                    if (data.orders && data.orders.length > 0) {
                        setCurrentListing(data.orders[0] as OpenSeaOrder);
                    } else {
                        setCurrentListing(null); // No active listing by this user for this NFT
                    }
                } catch (error: any) {
                    console.error('Error fetching OpenSea listing:', error);
                    setListingError(error.message || 'Could not fetch listing information.');
                } finally {
                    setIsLoadingListing(false);
                }
            };

            fetchListingStatus();
        }
    }, [open, nft, user?.walletAddress]); // user.address is key for maker

    const handleListForSale = async () => {
        if (!user) {
            toast.error('Please log in to perform this action');
            return;
        }
        if (!nft || isProcessing || !sellPrice) return;
        if (!nftEnabled) {
            toast.error('NFT transactions are not enabled for your account');
            return;
        }

        const priceValue = Number.parseFloat(sellPrice);
        if (isNaN(priceValue) || priceValue <= 0) {
            toast.error('Please enter a valid price');
            return;
        }

        // Calculate the ETH value from the family currency value
        const ethPriceValue = Number.parseFloat(sellPrice) * ethStableRate;
        devLog.log('Listing NFT at price:', sellPrice, 'family currency =', ethPriceValue, 'ETH');

        devLog.log('Listing NFT for sale:', nft, 'at price:', ethPriceValue, 'ETH');
        setIsProcessing(true);
        toast
            .promise(
                listNFTForSale(
                    user.id,
                    nft.tokenId,
                    nft.contract,
                    ethPriceValue, // Send properly calculated ETH value
                    parseInt(expirationDays)
                ),
                {
                    pending: 'Listing NFT for sale...',
                    success: 'NFT listed for sale successfully!',
                    error: 'Failed to list NFT for sale. Please try again.',
                }
            )
            .finally(() => {
                setIsProcessing(false);
                onOpenChange(false); // Close drawer on completion
            });
    };

    const handleSellNow = async () => {
        if (!user) {
            toast.error('Please log in to perform this action');
            return;
        }
        if (!nft || isProcessing || !topBid || topBid.amount <= 0) {
            toast.error(!topBid || topBid.amount <= 0 ? 'No valid bid to accept.' : 'Processing error.');
            return;
        }
        if (!nftEnabled) {
            toast.error('NFT transactions are not enabled for your account');
            return;
        }

        setIsProcessing(true);

        devLog.log(
            'Accepting NFT offer for NFT:',
            nft,
            'topBid:',
            topBid,
            'id:',
            nft.tokenId,
            'contract:',
            nft.contract,
            'amount:',
            topBid.amount
        );
        toast
            .promise(acceptNFTOffer(user.id, nft.tokenId, nft.contract, nft.ethValue), {
                pending: 'Accepting NFT offer...',
                success: 'NFT sold successfully!',
                error: 'Failed to accept NFT offer. Please try again.',
            })
            .finally(() => {
                setIsProcessing(false);
                onOpenChange(false); // Close drawer on completion
            });
    };

    const handleCancelListing = async () => {
        if (!currentListing || !user) {
            toast.error('No active listing to cancel or user not found.');
            return;
        }
        setIsProcessing(true);

        // Extract the order hash from the current listing
        const orderHash = currentListing.order_hash;

        devLog.log('Attempting to cancel listing:', orderHash);

        toast
            .promise(
                // Pass the orderHash instead of the full order object
                cancelListing(user.id, orderHash, user.walletAddress || 'None'),
                {
                    pending: 'Canceling Listing...',
                    success: 'NFT listing canceled',
                    error: 'Failed to cancel listing',
                }
            )
            .finally(() => {
                setIsProcessing(false);
                onOpenChange(false); // Close drawer on completion
                setCurrentListing(null); // Assume cancellation is successful for UI
            });
        // Optionally, trigger a refetch of listing status here if needed
    };

    const calculatePlatformFee = (amount: number) => amount * 0.02; // 2%

    const calculateNetProceedsList = () => {
        if (!sellPrice) return 0;
        const price = Number.parseFloat(sellPrice);
        return isNaN(price) ? 0 : price - calculatePlatformFee(price);
    };

    const calculateInstantNetProceeds = () => {
        if (!topBid || topBid.amount <= 0) return 0;
        return topBid.amount - calculatePlatformFee(topBid.amount);
    };

    const listedPriceInCrypto = currentListing
        ? formatCryptoPrice(
            currentListing.current_price,
            currentListing.taker_asset_bundle.assets[0]?.decimals || 18
        )
        : '0';
    const listedPriceCurrency =
        currentListing?.taker_asset_bundle.assets[0]?.asset_contract.symbol || '';

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="max-w-md mx-auto bg-[#fff1d6] border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700">
                <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-6">
                        <DrawerHeader className="p-0">
                            <DrawerTitle className="text-[#b74b28]">Sell NFT</DrawerTitle>
                        </DrawerHeader>
                        <DrawerClose asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-70 hover:opacity-100">
                                <X className="h-4 w-4" />
                                <span className="sr-only">Close</span>
                            </Button>
                        </DrawerClose>
                    </div>

                    {nft ? (
                        <>
                            <div className="flex items-start mb-6">
                                <div className="h-20 w-20 rounded-md overflow-hidden mr-4 border-2 border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700">
                                    <img
                                        src={nft.image || '/placeholder.svg?height=80&width=80'}
                                        alt={nft.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg text-[#b74b28]">{nft.name}</h3>
                                    <p className="text-sm text-[#b74b28]">{nft.collection}</p>
                                    <div className="mt-2">
                                        <p className="font-medium text-[#e87f4e]">
                                            Est. Value: <Currency amount={nft.value} />
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <Tabs defaultValue="instant" className="mb-6">
                                <TabsList className="grid w-full grid-cols-2 border-2 border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700 bg-[#fff1d6]">
                                    <TabsTrigger
                                        value="instant"
                                        className="data-[state=active]:bg-[#e87f4e] data-[state=active]:text-white data-[state=active]:shadow-none"
                                    >
                                        <TrendingUp className="h-4 w-4 mr-2" />
                                        Sell Now
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="list"
                                        className="data-[state=active]:bg-[#e87f4e] data-[state=active]:text-white data-[state=active]:shadow-none"
                                    >
                                        <Tag className="h-4 w-4 mr-2" />
                                        List for Sale
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="instant" className="mt-6">
                                    <div className="space-y-4 mb-8">
                                        <div className="bg-[#ffe9c0] border-2 border-black p-4 rounded-lg shadow-[-2px_2px_0px_#000000] shadow-yellow-700">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="font-medium text-[#b74b28]">Highest Offer</h4>
                                                {topBid && topBid.amount > 0 && (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-green-500 text-green-700 bg-green-100"
                                                    >
                                                        Offer Available
                                                    </Badge>
                                                )}
                                            </div>

                                            {!topBid && ( // Loading state for topBid
                                                <div className="flex justify-center items-center py-4 text-[#b74b28]">
                                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                                    <span>Fetching highest offer...</span>
                                                </div>
                                            )}
                                            {topBid && topBid.amount > 0 && (
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[#b74b28]">Offer amount:</span>
                                                        <span className="font-bold text-xl text-[#e87f4e]">
                                                            <Currency amount={topBid.amount} />
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-[#b74b28]">From:</span>
                                                        <span className="text-[#b74b28]">{topBid.bidder}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {topBid && topBid.amount <= 0 && (
                                                <div className="text-center py-3 text-[#b74b28]">
                                                    <Info className="h-5 w-5 mx-auto mb-2 text-yellow-600" />
                                                    <p className="font-medium">No active offers for this NFT right now.</p>
                                                    <p className="text-xs">You can list it for sale to attract buyers.</p>
                                                </div>
                                            )}
                                        </div>

                                        {topBid && topBid.amount > 0 && (
                                            <div className="pt-4 border-t border-[#e87f4e]/30">
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-sm text-[#b74b28]">Sell Price</span>
                                                    <span className="text-sm text-[#b74b28]">
                                                        <Currency amount={topBid.amount} />
                                                    </span>
                                                </div>
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-sm text-[#b74b28]">Platform Fee (2%)</span>
                                                    <span className="text-sm text-[#b74b28]">
                                                        <Currency amount={calculatePlatformFee(topBid.amount)} />
                                                    </span>
                                                </div>
                                                <div className="flex justify-between font-medium text-[#b74b28]">
                                                    <span>You Receive</span>
                                                    <div className="text-right">
                                                        <div className="text-[#e87f4e]">
                                                            <Currency amount={calculateInstantNetProceeds()} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-[#ffe9c0]/50 p-3 rounded-lg border border-[#b74b28]/20 mt-4">
                                            <p className="text-sm text-[#b74b28]">
                                                <strong>Sell Now</strong> accepts the highest current offer for your NFT.
                                                The transaction aims to complete quickly.
                                            </p>
                                        </div>

                                        <DrawerFooter className="p-0 flex-row justify-between items-center">
                                            <div className="font-bold text-lg text-[#b74b28]">
                                                {topBid && topBid.amount > 0 ? (
                                                    <Currency amount={calculateInstantNetProceeds()} />
                                                ) : (
                                                    <Currency amount={0} />
                                                )}
                                            </div>
                                            <Button
                                                onClick={handleSellNow}
                                                disabled={
                                                    isProcessing ||
                                                    isLoadingPermissions ||
                                                    !nftEnabled ||
                                                    !topBid ||
                                                    topBid.amount <= 0
                                                }
                                                title={
                                                    !nftEnabled
                                                        ? 'Not authorized for NFT actions'
                                                        : !topBid || topBid.amount <= 0
                                                            ? 'No offer to accept'
                                                            : 'Sell to highest bidder'
                                                }
                                                className="border-[2px] border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700 bg-[#e87f4e] hover:bg-[#d76e3d] text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Processing...
                                                    </>
                                                ) : (
                                                    'Sell Now'
                                                )}
                                            </Button>
                                        </DrawerFooter>
                                    </div>
                                </TabsContent>

                                <TabsContent value="list" className="mt-6">
                                    {isLoadingListing && (
                                        <div className="flex flex-col items-center justify-center py-8 text-[#b74b28]">
                                            <Loader2 className="h-8 w-8 animate-spin mb-3" />
                                            <p>Checking for existing listings...</p>
                                        </div>
                                    )}
                                    {!isLoadingListing && listingError && (
                                        <div
                                            className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow-md"
                                            role="alert"
                                        >
                                            <div className="flex items-center">
                                                <AlertTriangle className="h-5 w-5 mr-3" />
                                                <div>
                                                    <p className="font-bold">Error Fetching Listing</p>
                                                    <p className="text-sm">{listingError}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {!isLoadingListing && !listingError && currentListing && (
                                        <div className="space-y-4 mb-8 p-4 bg-[#ffe9c0] border-2 border-black rounded-lg shadow-[-2px_2px_0px_#000000] shadow-yellow-700">
                                            <h4 className="text-lg font-semibold text-[#b74b28] mb-3">
                                                Active Listing Details
                                            </h4>
                                            <div className="space-y-2 text-sm text-[#b74b28]">
                                                <div className="flex justify-between">
                                                    <span>Listed Price:</span>
                                                    <span className="font-medium text-[#e87f4e]">
                                                        {listedPriceInCrypto} {listedPriceCurrency}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Expires:</span>
                                                    <span className="font-medium">
                                                        {formatTimestampToDate(currentListing.expiration_time)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Platform:</span>
                                                    <span className="font-medium">OpenSea</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-[#b74b28] mt-3">
                                                Your NFT is currently listed for sale. You can cancel this listing if you
                                                wish to change the price or duration.
                                            </p>
                                            <Button
                                                onClick={handleCancelListing}
                                                disabled={isProcessing || isLoadingPermissions || !nftEnabled}
                                                variant="destructive"
                                                className="w-full mt-4 border-[2px] border-black shadow-[-2px_2px_0px_#000000] shadow-red-700 bg-red-500 hover:bg-red-600 text-white"
                                            >
                                                {isProcessing ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Cancelling...
                                                    </>
                                                ) : (
                                                    'Cancel Listing'
                                                )}
                                            </Button>
                                        </div>
                                    )}

                                    {!isLoadingListing && !listingError && !currentListing && (
                                        <div className="space-y-4 mb-8">
                                            <div>
                                                <h4 className="text-sm font-medium mb-2 text-[#b74b28]">Sale Currency</h4>
                                                <div className="text-white bg-black p-2 px-3 rounded-xl flex justify-between items-center text-sm">
                                                    <span>Ethereum (ETH)</span>
                                                    <span className="font-mono">{ethValue} ETH</span>
                                                </div>
                                                <div className="text-xs text-[#b74b28] mt-1">
                                                    Listing will be in ETH. Price below is in your family currency (
                                                    {user?.family?.currency || 'USD'}).
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-medium mb-2 text-[#b74b28]">
                                                    Sale Price ({user?.family?.currency || 'USD'})
                                                </h4>
                                                <div className="relative">
                                                    <Symbol className="absolute left-3 top-2  h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        type="number"
                                                        value={sellPrice}
                                                        onChange={e => setSellPrice(e.target.value)}
                                                        placeholder="0.00"
                                                        step="0.01"
                                                        min={0}
                                                        className="pl-9 border-2 border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <h4 className="text-sm font-medium mb-2 text-[#b74b28]">
                                                    Listing Duration
                                                </h4>
                                                <Select value={expirationDays} onValueChange={setExpirationDays}>
                                                    <SelectTrigger className="border-2 border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700">
                                                        <SelectValue placeholder="Select duration" />
                                                    </SelectTrigger>
                                                    <SelectContent sideOffset={5} className=" border-black">
                                                        <SelectItem value="1">1 day</SelectItem>
                                                        <SelectItem value="3">3 days</SelectItem>
                                                        <SelectItem value="7">7 days</SelectItem>
                                                        <SelectItem value="14">14 days</SelectItem>
                                                        <SelectItem value="30">30 days</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="pt-4 border-t border-[#e87f4e]/30">
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-sm text-[#b74b28]">Listing Price</span>
                                                    <span className="text-sm text-[#b74b28]">
                                                        {sellPrice ? (
                                                            <Currency amount={Number.parseFloat(sellPrice)} />
                                                        ) : (
                                                            <Currency amount={0} />
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between mb-2">
                                                    <span className="text-sm text-[#b74b28]">Platform Fee (2%)</span>
                                                    <span className="text-sm text-[#b74b28]">
                                                        <Currency
                                                            amount={
                                                                sellPrice ? calculatePlatformFee(Number.parseFloat(sellPrice)) : 0
                                                            }
                                                        />
                                                    </span>
                                                </div>
                                                <div className="flex justify-between font-medium text-[#b74b28]">
                                                    <span>You Receive (Est.)</span>
                                                    <div className="text-right">
                                                        <div className="text-[#e87f4e]">
                                                            <Currency amount={calculateNetProceedsList()} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-[#ffe9c0]/50 p-3 rounded-lg border border-[#b74b28]/20 mt-4">
                                                <p className="text-sm text-[#b74b28]">
                                                    <strong>List for Sale</strong> creates a public listing at your specified
                                                    price. You'll receive payment when someone purchases your NFT.
                                                </p>
                                            </div>

                                            <DrawerFooter className="p-0 flex-row justify-between items-center">
                                                <div className="font-bold text-lg text-[#b74b28]">
                                                    <Currency amount={calculateNetProceedsList()} />
                                                </div>
                                                <Button
                                                    onClick={handleListForSale}
                                                    disabled={
                                                        isProcessing ||
                                                        isLoadingPermissions ||
                                                        !nftEnabled ||
                                                        !sellPrice ||
                                                        Number.parseFloat(sellPrice) <= 0
                                                    }
                                                    title={
                                                        !nftEnabled
                                                            ? 'Not authorized for NFT actions'
                                                            : 'List this NFT for sale'
                                                    }
                                                    className="border-[2px] border-black shadow-[-2px_2px_0px_#000000] shadow-yellow-700 bg-[#e87f4e] hover:bg-[#d76e3d] text-white disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    {isProcessing ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            Processing...
                                                        </>
                                                    ) : (
                                                        'List for Sale'
                                                    )}
                                                </Button>
                                            </DrawerFooter>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </>
                    ) : (
                        <div className="py-8 text-center text-[#b74b28]">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                            <p>Loading NFT details...</p>
                        </div>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    );
}
