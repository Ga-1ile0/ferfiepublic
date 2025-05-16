'use client';

import type React from 'react';

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// Helper function to format expiration time
function formatExpirationTime(expirationTimestamp: number, currentTimestamp: number): string {
  const secondsRemaining = expirationTimestamp - currentTimestamp;

  if (secondsRemaining <= 0) return 'Expired';

  const minutesRemaining = Math.floor(secondsRemaining / 60);
  if (minutesRemaining < 60) return `${minutesRemaining}m`;

  const hoursRemaining = Math.floor(minutesRemaining / 60);
  if (hoursRemaining < 24) return `${hoursRemaining}h`;

  const daysRemaining = Math.floor(hoursRemaining / 24);
  return `${daysRemaining}d`;
}
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  ShoppingBag,
  Globe,
  Filter,
  Loader2,
  Search,
  Grid3X3,
  LayoutGrid,
  LayoutList,
  Tag,
  RefreshCcw,
  SendHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Currency } from '@/components/shared/currency-symbol';
import { Address } from '@coinbase/onchainkit/identity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiscord, faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { optimizeImage } from '@/lib/reservoir';
import { useAuth } from '@/contexts/authContext';
import { getEthStableRate } from '@/lib/tokens';
import { NFTTokenDialog } from './nft/nft-token-dialog';
import type {
  NFTDetailDialogProps,
  Token,
  TokenAttribute,
  AttributeFilter,
  GridLayout,
} from '@/types/nft';

export function NFTDetailDialog({ nft, open, onOpenChange }: NFTDetailDialogProps) {
  const [activeTab, setActiveTab] = useState('items');
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [continuation, setContinuation] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [attributes, setAttributes] = useState<{ [key: string]: TokenAttribute[] }>({});
  const [selectedAttributes, setSelectedAttributes] = useState<AttributeFilter>({});
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [sortBy, setSortBy] = useState('floorAskPrice');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gridLayout, setGridLayout] = useState<GridLayout>(2);
  const { user } = useAuth();

  // OpenSea activity states
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityNext, setActivityNext] = useState<string | null>(null);

  // Stable rate to convert ETH values to user currency
  const [stableRate, setStableRate] = useState<number>(1);

  // State for token dialog
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [isTokenDialogOpen, setIsTokenDialogOpen] = useState(false);
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  // Reset tab when NFT changes
  useEffect(() => {
    if (nft) {
      setActiveTab('items');
      // Reset filters when NFT changes
      setSelectedAttributes({});
      setPriceRange([0, 0]);
      setMaxPrice(0);
      setSortBy('floorAskPrice');
      setTokens([]);
      setContinuation(null);
      setHasMore(false);
      setSearchQuery('');

      // Reset activity data
      setActivityEvents([]);
      setActivityNext(null);
      setActivityHasMore(false);
    }
  }, [nft]);

  // Memoize social links to avoid recalculation
  const socialLinks = useMemo(() => {
    if (!nft) return { twitter: null, discord: null, external: null };

    return {
      twitter: nft.twitterUsername ? `https://x.com/${nft.twitterUsername}` : null,
      discord: nft.discordUrl || null,
      external: nft.externalUrl || null,
    };
  }, [nft]);

  // Fetch collection attributes
  const fetchAttributes = useCallback(async () => {
    if (!nft?.contractAddress) return;

    try {
      const url = `https://api-base.reservoir.tools/collections/${nft.contractAddress}/attributes/all/v4`;
      const params = new URLSearchParams();

      if (user?.family?.currencyAddress) {
        params.append('displayCurrency', user.family.currencyAddress);
      }

      const response = await fetch(`${url}?${params.toString()}`);
      const data = await response.json();

      if (data && data.attributes) {
        const attributesMap: { [key: string]: TokenAttribute[] } = {};
        data.attributes.forEach((attr: any) => {
          attributesMap[attr.key] = attr.values.map((value: any) => ({
            key: attr.key,
            value: value.value,
            count: value.count,
            floorAskPrice: value.floorAskPrice,
          }));
        });
        setAttributes(attributesMap);

        // Set max price based on highest attribute floor price
        let highestPrice = 0;
        Object.values(attributesMap).forEach(attrValues => {
          attrValues.forEach(attr => {
            if (
              attr.floorAskPrice?.amount?.native &&
              attr.floorAskPrice.amount.native > highestPrice
            ) {
              highestPrice = attr.floorAskPrice.amount.native;
            }
          });
        });

        setMaxPrice(highestPrice || (nft.lowestPrice ? nft.lowestPrice * 3 : 10));
        setPriceRange([0, highestPrice || (nft.lowestPrice ? nft.lowestPrice * 3 : 10)]);
      }
    } catch (error) {
      console.error('Error fetching attributes:', error);
    }
  }, [nft?.contractAddress, nft?.lowestPrice, user?.family?.currencyAddress]);

  // Fetch tokens
  const fetchTokens = useCallback(
    async (reset = false) => {
      if (!nft?.contractAddress) return;

      if (reset) {
        setIsLoading(true);
        setContinuation(null);
      }

      try {
        const url = `https://api-base.reservoir.tools/tokens/v7`;
        const params = new URLSearchParams();

        // Add base parameters
        params.append('collection', nft.contractAddress);
        params.append('limit', '20');
        params.append('sortBy', sortBy);
        params.append('includeAttributes', 'true');
        params.append('includeLastSale', 'true');
        params.append('includeTopBid', 'true');

        // Add currency if available
        if (user?.family?.currencyAddress) {
          params.append('displayCurrency', user.family.currencyAddress);
        }

        // Add search query if provided
        if (searchQuery) {
          params.append('name', searchQuery);
        }

        // Add attribute filters
        Object.entries(selectedAttributes).forEach(([key, values]) => {
          if (values.length > 0) {
            values.forEach(value => {
              params.append(`attributes[${key}]`, value);
            });
          }
        });

        // Add price range filter
        if (priceRange[0] > 0) {
          params.append('minFloorAskPrice', priceRange[0].toString());
        }
        if (priceRange[1] < maxPrice) {
          params.append('maxFloorAskPrice', priceRange[1].toString());
        }

        // Add continuation token if available
        if (continuation && !reset) {
          params.append('continuation', continuation);
        }

        const response = await fetch(`${url}?${params.toString()}`);
        const data = await response.json();

        if (data && data.tokens) {
          if (reset) {
            setTokens(data.tokens);
          } else {
            setTokens(prev => [...prev, ...data.tokens]);
          }
          setContinuation(data.continuation);
          setHasMore(!!data.continuation);
        }
      } catch (error) {
        console.error('Error fetching tokens:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      nft?.contractAddress,
      sortBy,
      selectedAttributes,
      priceRange,
      maxPrice,
      continuation,
      searchQuery,
      user?.family?.currencyAddress,
    ]
  );

  // Fetch data when tab changes to items
  useEffect(() => {
    if (activeTab === 'items' && nft?.contractAddress && tokens.length === 0) {
      fetchAttributes();
      fetchTokens(true);
    }
  }, [activeTab, nft?.contractAddress, fetchAttributes, fetchTokens, tokens.length]);

  // Fetch stable rate once when user currency changes
  useEffect(() => {
    const fetchStableRate = async () => {
      if (!user?.family?.currencyAddress) return;

      try {
        const rate = await getEthStableRate(user.family.currencyAddress);
        setStableRate(rate);
      } catch (error) {
        console.error('Error fetching stable rate:', error);
      }
    };

    fetchStableRate();
  }, [user]);

  // Function to fetch OpenSea collection activity
  const fetchCollectionActivity = useCallback(
    async (nextCursor?: string) => {
      console.log('Fetching collection activity...');
      console.log('NFT:', nft);
      console.log('Slug:', nft?.slug);
      if (!nft?.slug) return;
      console.log('Slug:', nft.slug);

      setIsLoadingActivity(true);

      try {
        const apiKey = process.env.NEXT_PUBLIC_OPENSEA_API_KEY || '';
        const baseUrl = `https://api.opensea.io/api/v2/events/collection/${nft.slug}`;

        const params = new URLSearchParams({
          event_type: 'listing',
        });

        // Add other event types
        params.append('event_type', 'offer');
        params.append('event_type', 'sale');
        params.append('event_type', 'transfer');

        // Add pagination cursor if provided
        if (nextCursor) {
          params.append('next', nextCursor);
        }

        const url = `${baseUrl}?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            'x-api-key': apiKey,
          },
        });

        if (!response.ok) {
          throw new Error(`OpenSea API error: ${response.status}`);
        }

        const data = await response.json();

        // Update state with new events
        if (nextCursor) {
          setActivityEvents(prev => [...prev, ...data.asset_events]);
        } else {
          setActivityEvents(data.asset_events);
        }

        // Set pagination cursor if available
        setActivityNext(data.next || null);
        setActivityHasMore(!!data.next);
      } catch (error) {
        console.error('Error fetching OpenSea collection activity:', error);
      } finally {
        setIsLoadingActivity(false);
      }
    },
    [nft]
  );

  // Fetch initial activity when tab changes to 'activity'
  useEffect(() => {
    if (activeTab === 'activity' && nft?.slug && activityEvents.length === 0) {
      fetchCollectionActivity();
    }
  }, [activeTab, nft, activityEvents.length, fetchCollectionActivity]);

  // Handle attribute selection
  const handleAttributeSelect = useCallback((key: string, value: string) => {
    setSelectedAttributes(prev => {
      const newFilters = { ...prev };
      if (!newFilters[key]) {
        newFilters[key] = [value];
      } else if (newFilters[key].includes(value)) {
        newFilters[key] = newFilters[key].filter(v => v !== value);
        if (newFilters[key].length === 0) {
          delete newFilters[key];
        }
      } else {
        newFilters[key] = [...newFilters[key], value];
      }
      return newFilters;
    });
  }, []);

  // Handle price range change
  const handlePriceRangeChange = useCallback((value: number[]) => {
    setPriceRange([value[0], value[1]]);
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(event.target.value);
  }, []);

  // Handle search query change
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  }, []);

  // Handle search submit
  const handleSearchSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      fetchTokens(true);
    },
    [fetchTokens]
  );

  // Apply filters
  const applyFilters = useCallback(() => {
    fetchTokens(true);
    if (filtersOpen) {
      setFiltersOpen(false);
    }
  }, [fetchTokens]);

  // Reset filters
  const resetFilters = useCallback(() => {
    setSelectedAttributes({});
    setPriceRange([0, maxPrice]);
    setSortBy('floorAskPrice');
    setSearchQuery('');
    applyFilters();
  }, [maxPrice]);

  // Load more tokens
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchTokens();
    }
  }, [hasMore, isLoading, fetchTokens]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    Object.values(selectedAttributes).forEach(values => {
      count += values.length;
    });
    if (priceRange[0] > 0 || priceRange[1] < maxPrice) {
      count += 1;
    }
    if (searchQuery) {
      count += 1;
    }
    return count;
  }, [selectedAttributes, priceRange, maxPrice, searchQuery]);

  // Get grid columns based on layout setting
  const getGridColumnClass = useCallback(() => {
    switch (gridLayout) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-3';
      default:
        return 'grid-cols-1';
    }
  }, [gridLayout]);

  // Get layout icon based on current grid layout
  const getLayoutIcon = useCallback(() => {
    switch (gridLayout) {
      case 1:
        return <LayoutList className="h-4 w-4" />;
      case 2:
        return <LayoutGrid className="h-4 w-4" />;
      case 3:
        return <Grid3X3 className="h-4 w-4" />;
      default:
        return <LayoutGrid className="h-4 w-4" />;
    }
  }, [gridLayout]);

  // Handle token click to open token dialog
  const handleTokenClick = useCallback((token: Token) => {
    // Ensure token has a unique identifier
    const uniqueToken = {
      ...token,
      token: {
        ...token.token,
        // Add a timestamp to ensure uniqueness if tokenId is missing
        tokenId:
          token.token.tokenId ||
          `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      },
    };

    setIsLoadingToken(true);
    setSelectedToken(uniqueToken);
    setIsTokenDialogOpen(true);

    // Simulate loading token details
    setTimeout(() => {
      setIsLoadingToken(false);
    }, 500);
  }, []);

  // Handle token dialog close
  const handleTokenDialogClose = useCallback((open: boolean) => {
    setIsTokenDialogOpen(open);
  }, []);

  if (!nft) return null;

  return (
    <AnimatePresence mode="sync">
      {open && (
        <Dialog key="nft-collection-dialog" open={open} onOpenChange={onOpenChange}>
          <DialogContent className="p-0 border-0 bg-[#fab049] bg-[url('/Confetti.png')] bg-repeat w-[100vw] h-full max-w-[100vw] max-h-[100vh] overflow-y-auto flex flex-col">
            <DialogTitle className="sr-only">NFT Collection Details</DialogTitle>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full"
            >
              {/* Back button */}
              <div className="absolute top-4 left-4 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="rounded-full bg-background/80 backdrop-blur-sm"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Back</span>
                </Button>
              </div>

              {/* Banner */}
              <div className="w-full h-48 relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 z-[1]"></div>
                <img
                  src={nft.banner || nft.image || '/placeholder.svg?height=400&width=800'}
                  alt={`${nft.name} banner`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* NFT Info */}
              <div className="px-6 -mt-12 relative z-[2]">
                <div className="flex items-start gap-4">
                  <div className=" h-24 w-24 rounded-lg overflow-hidden border-4 border-[#fab049] shadow-lg">
                    <img
                      src={nft.image || '/placeholder.svg?height=200&width=200'}
                      alt={nft.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <Card className="mt-2 border-4 rounded-md border-[#fab049] shadow-sm">
                    <CardContent className="p-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">{nft.name}</h2>
                        {nft.verified !== false && <BadgeCheck className="h-5 w-5" />}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-sm ">Lowest Price: </span>
                        <span className="text-md font-bold text-[#e87f4e]">
                          {/* @ts-ignore */}
                          <Currency
                            amount={
                              user?.family?.currencyAddress ===
                              '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4'
                                ? nft.lowestPrice! * stableRate * 1.02 ||
                                  nft.price * stableRate * 1.02
                                : nft.lowestPrice! * 1.02 || nft.price * 1.02
                            }
                          />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Tabs */}
              <div className="px-6 mt-6 flex-1 flex flex-col">
                <Tabs
                  defaultValue="items"
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="flex flex-col flex-1"
                >
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="items">Items</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                  </TabsList>

                  <div className="flex-1 mt-4">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                      >
                        <TabsContent value="overview" className="h-full flex flex-col gap-6 pb-6">
                          {(socialLinks.twitter || socialLinks.discord || socialLinks.external) && (
                            <Card className="border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700">
                              <CardHeader>
                                <CardTitle className="text-lg">Socials</CardTitle>
                              </CardHeader>
                              <CardContent className="flex flex-wrap pt-4 gap-3 items-center">
                                {socialLinks.twitter && (
                                  <a
                                    href={socialLinks.twitter}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="no-underline"
                                  >
                                    <div className="flex items-center justify-center h-10 w-10 rounded-md border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700 duration-300 ease-[cubic-bezier(0.4, 0, 0.2, 1)] ">
                                      <FontAwesomeIcon
                                        icon={faXTwitter}
                                        className="h-6 w-6"
                                        size="lg"
                                      />
                                    </div>
                                  </a>
                                )}
                                {socialLinks.discord && (
                                  <a
                                    href={socialLinks.discord}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="no-underline"
                                  >
                                    <div className="flex items-center justify-center h-10 w-10 rounded-md border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700 duration-300 ease-[cubic-bezier(0.4, 0, 0.2, 1)] ">
                                      <FontAwesomeIcon className="h-5 w-5" icon={faDiscord} />
                                    </div>
                                  </a>
                                )}
                                {socialLinks.external && (
                                  <a
                                    href={socialLinks.external}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="no-underline"
                                  >
                                    <div className="flex items-center justify-center h-10 w-10 rounded-md border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700 duration-300 ease-[cubic-bezier(0.4, 0, 0.2, 1)] ">
                                      <Globe className="h-4 w-4" />
                                    </div>
                                  </a>
                                )}
                              </CardContent>
                            </Card>
                          )}
                          <Card className="border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700">
                            <CardHeader>
                              <CardTitle className="text-lg">Description</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div>
                                <p className="text-muted-foreground">
                                  {nft.description || 'No description available.'}
                                </p>
                              </div>
                              <div>
                                <h3 className="text-lg font-medium my-4">Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Creator</p>
                                    <Address
                                      className="text-[#e87f4e]"
                                      address={(nft.creator as `0x${string}`) || ''}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">
                                      Contract Address
                                    </p>
                                    <Address
                                      className="text-[#e87f4e]"
                                      address={(nft.contractAddress as `0x${string}`) || ''}
                                    />
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>

                        <TabsContent value="items" className="h-full mt-0 flex flex-col">
                          <div className="flex flex-col h-full">
                            {/* Search bar and display options */}
                            <div className="flex items-center gap-2 mb-4 sticky top-0 z-10 bg-[#fab049] pt-2 pb-3">
                              {/* Filter icon/button */}
                              <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                                <SheetTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 rounded-md border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700 duration-300 ease-[cubic-bezier(0.4, 0, 0.2, 1)]"
                                  >
                                    <Filter className="h-4 w-4" />
                                    <span className="sr-only">Filters</span>
                                    {activeFilterCount > 0 && (
                                      <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center text-xs">
                                        {activeFilterCount}
                                      </span>
                                    )}
                                  </Button>
                                </SheetTrigger>
                                <SheetContent
                                  side="left"
                                  className="w-[85vw] sm:w-[385px] overflow-y-auto"
                                >
                                  <div className="space-y-6 py-2">
                                    <div className="flex items-center justify-between">
                                      <h3 className="text-lg font-medium">Filters</h3>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          onClick={applyFilters}
                                          variant={'outline'}
                                          size={'sm'}
                                        >
                                          Apply
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={resetFilters}>
                                          Reset
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Price Range Filter */}
                                    <div className="space-y-4">
                                      <h4 className="text-sm font-medium">Price Range</h4>
                                      <div className="px-2">
                                        <Slider
                                          defaultValue={[priceRange[0], priceRange[1]]}
                                          value={[priceRange[0], priceRange[1]]}
                                          max={maxPrice}
                                          step={0.01}
                                          onValueChange={handlePriceRangeChange}
                                          className="mb-6"
                                        />
                                        <div className="flex items-center justify-between">
                                          <Input
                                            type="number"
                                            value={
                                              Math.round(priceRange[0] * stableRate * 100) / 100 ||
                                              ''
                                            }
                                            onChange={e => {
                                              const display =
                                                Number.parseFloat(e.target.value) || 0;
                                              handlePriceRangeChange([
                                                display / stableRate,
                                                priceRange[1],
                                              ]);
                                            }}
                                            className="w-[45%]"
                                            placeholder="Min"
                                          />
                                          <span className="text-muted-foreground">to</span>
                                          <Input
                                            type="number"
                                            value={
                                              Math.round(priceRange[1] * stableRate * 100) / 100 ||
                                              ''
                                            }
                                            onChange={e => {
                                              const display =
                                                Number.parseFloat(e.target.value) || 0;
                                              handlePriceRangeChange([
                                                priceRange[0],
                                                display / stableRate,
                                              ]);
                                            }}
                                            className="w-[45%]"
                                            placeholder="Max"
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Sort By */}
                                    <div className="space-y-2">
                                      <h4 className="text-sm font-medium">Sort By</h4>
                                      <select
                                        className="w-full px-3 py-2 bg-background border border-border rounded-md"
                                        value={sortBy}
                                        onChange={handleSortChange}
                                      >
                                        <option value="floorAskPrice">Price: Low to High</option>
                                        <option value="-floorAskPrice">Price: High to Low</option>
                                        <option value="tokenId">Token ID</option>
                                        <option value="-tokenId">Token ID (Descending)</option>
                                        <option value="rarity">Rarity</option>
                                        <option value="-lastSalePrice">Recently Sold</option>
                                      </select>
                                    </div>

                                    {/* Attribute Filters */}
                                    <div className="space-y-4">
                                      {Object.entries(attributes).map(([key, values]) => (
                                        <div key={key} className="border-t border-border pt-4">
                                          <h4 className="text-sm font-medium mb-2">{key}</h4>
                                          <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                            {values.map((attr, index) => (
                                              <div
                                                key={`${key}-${attr.value}-${index}`}
                                                className="flex items-center justify-between"
                                              >
                                                <div className="flex items-center">
                                                  <Checkbox
                                                    id={`drawer-${key}-${attr.value}-${index}`}
                                                    checked={
                                                      selectedAttributes[key]?.includes(
                                                        attr.value
                                                      ) || false
                                                    }
                                                    onCheckedChange={() =>
                                                      handleAttributeSelect(key, attr.value)
                                                    }
                                                    className="mr-2"
                                                  />
                                                  <label
                                                    htmlFor={`drawer-${key}-${attr.value}-${index}`}
                                                    className="text-sm cursor-pointer flex-1"
                                                  >
                                                    {attr.value || 'None'}
                                                  </label>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <Badge variant="outline" className="text-xs">
                                                    {attr.count}
                                                  </Badge>
                                                  {attr.floorAskPrice && (
                                                    <span className="text-xs text-[#e87f4e]">
                                                      <Currency
                                                        amount={
                                                          stableRate *
                                                          attr.floorAskPrice.amount.native
                                                        }
                                                      />
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </SheetContent>
                              </Sheet>

                              {/* Search bar */}
                              <form
                                onSubmit={handleSearchSubmit}
                                className="flex-1 relative flex items-center"
                              >
                                <Input
                                  type="text"
                                  placeholder="Search NFTs by name..."
                                  value={searchQuery}
                                  onChange={handleSearchChange}
                                  className="w-full pl-10 focus-visible:ring-yellow-500 truncate"
                                />
                                <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-0 mr-1"
                                >
                                  <span className="sr-only">Search</span>
                                </Button>
                              </form>

                              {/* Display layout toggle */}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setGridLayout(prev => {
                                    if (prev === 1) return 2;
                                    if (prev === 2) return 3;
                                    return 1;
                                  });
                                }}
                                className="h-10 w-10 rounded-md border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700 duration-300 ease-[cubic-bezier(0.4, 0, 0.2, 1)]"
                              >
                                {getLayoutIcon()}
                                <span className="sr-only">Change layout</span>
                              </Button>
                            </div>

                            {/* Active filters indicator */}
                            {activeFilterCount > 0 && (
                              <div className="mb-4 flex items-center gap-2 sticky top-[60px] z-10 bg-[#fab049] pb-2">
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Filter className="h-3 w-3" />
                                  {activeFilterCount}{' '}
                                  {activeFilterCount === 1 ? 'filter' : 'filters'} active
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={resetFilters}
                                  className="h-7 text-xs"
                                >
                                  Reset
                                </Button>
                              </div>
                            )}

                            {/* NFT Grid */}

                            {isLoading && tokens.length === 0 ? (
                              <div className="flex justify-center items-center h-64">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              </div>
                            ) : tokens.length > 0 ? (
                              <div className="space-y-6">
                                <div className={`grid ${getGridColumnClass()} gap-3`}>
                                  {tokens.map((token, index) => (
                                    <motion.div
                                      key={`${token.token.contract}-${token.token.tokenId}-${index}`}
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ duration: 0.3 }}
                                      className="border rounded-lg overflow-hidden bg-[#fff1d6] hover:shadow-md border-black transition-shadow shadow-[-4px_4px_0px_#000000] shadow-yellow-700 cursor-pointer"
                                      onClick={() => handleTokenClick(token)}
                                    >
                                      <div className="aspect-square bg-muted">
                                        <img
                                          src={
                                            optimizeImage(token.token.image, 400) ||
                                            '/placeholder.svg?height=400&width=400' ||
                                            '/placeholder.svg'
                                          }
                                          alt={token.token.name}
                                          className="w-full h-full object-cover"
                                          onError={e => {
                                            e.currentTarget.src =
                                              '/placeholder.svg?height=400&width=400';
                                          }}
                                        />
                                      </div>
                                      <div className="p-3">
                                        <div className="flex flex-row gap-2">
                                          <p className="font-medium text-sm truncate text-[#b74b28]">
                                            {token.token.name}
                                          </p>
                                          {token.token.rarityRank && (
                                            <Badge
                                              variant={'outline'}
                                              className="rounded-lg text-xs text-[#de8668]"
                                            >
                                              #{token.token.rarityRank}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="mt-2 flex items-center justify-between">
                                          {token.market.floorAsk?.price?.amount?.native ? (
                                            <div className="text-md font-bold text-[#e87f4e]">
                                              <Currency
                                                amount={
                                                  user?.family?.currencyAddress ===
                                                  '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4'
                                                    ? token.market.floorAsk.price.amount.native *
                                                      stableRate *
                                                      1.02
                                                    : token.market.floorAsk.price.amount.decimal! *
                                                      1.02
                                                }
                                              />
                                            </div>
                                          ) : (
                                            <p className="text-xs text-muted-foreground">
                                              Not listed
                                            </p>
                                          )}
                                        </div>
                                        <div className="mt-2 flex items-center justify-between">
                                          {token.market.floorAsk?.price?.amount?.native ? (
                                            <div className="text-xs font-bold flex gap-1 text-[#F1B193]">
                                              Last sale{' '}
                                              <Currency
                                                amount={
                                                  stableRate *
                                                  (token.token.lastSale?.price.amount.decimal || 0)
                                                }
                                              />
                                            </div>
                                          ) : (
                                            <p className="text-xs text-[#e87f4e]">
                                              No previous sales
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>

                                {/* Load more button */}
                                {hasMore && (
                                  <div className="flex justify-center mt-4 pb-4">
                                    <Button
                                      onClick={loadMore}
                                      disabled={isLoading}
                                      variant="outline"
                                      className="min-w-[200px]"
                                    >
                                      {isLoading ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading
                                        </>
                                      ) : (
                                        'Load More'
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-64">
                                <p className="text-muted-foreground">No items found</p>
                                {activeFilterCount > 0 && (
                                  <Button variant="link" onClick={resetFilters} className="mt-2">
                                    Reset filters
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="activity" className="h-full flex flex-col gap-6 pb-6">
                          <Card className="border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700">
                            <CardHeader className="flex flex-row items-center justify-between">
                              <div className="text-lg">Collection Activity</div>
                              {isLoadingActivity && activityEvents.length === 0 ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => fetchCollectionActivity()}
                                  disabled={isLoadingActivity}
                                >
                                  <RefreshCcw className="h-4 w-4" />
                                </Button>
                              )}
                            </CardHeader>
                            <CardContent className="p-4 max-h-[350px] overflow-y-auto">
                              <div className="space-y-4" id="activity-scroll-container">
                                {activityEvents.length > 0 ? (
                                  <>
                                    {activityEvents.map((event, i) => {
                                      // Determine the event icon
                                      let EventIcon = ShoppingBag;
                                      let eventTypeLabel = 'Activity';

                                      if (event.event_type === 'order') {
                                        // Check order_type for more specific categorization
                                        if (
                                          event.order_type === 'basic' ||
                                          event.order_type === 'listing'
                                        ) {
                                          EventIcon = Tag;
                                          eventTypeLabel = 'Listing';
                                        } else if (event.order_type?.includes('offer')) {
                                          EventIcon = ShoppingBag;
                                          eventTypeLabel = 'Offer';
                                        }
                                      } else if (event.event_type === 'sale') {
                                        EventIcon = BarChart3;
                                        eventTypeLabel = 'Sale';
                                      } else if (event.event_type === 'transfer') {
                                        EventIcon = SendHorizontal;
                                        eventTypeLabel = 'Transfer';
                                      }

                                      // Check if event has price information
                                      const hasPrice = event.payment && event.payment.quantity;
                                      let price = 0;

                                      if (hasPrice) {
                                        // Convert from wei to ETH
                                        const decimals = event.payment.decimals || 18;
                                        price =
                                          parseFloat(event.payment.quantity) /
                                          Math.pow(10, decimals);

                                        // Convert to user's currency if needed
                                        if (user?.family?.currencyAddress && stableRate !== 1) {
                                          price = price * stableRate;
                                        }
                                      }

                                      // Format date
                                      const eventDate = event.event_timestamp
                                        ? new Date(event.event_timestamp * 1000)
                                        : new Date();
                                      const timeAgo = formatTimeAgo(eventDate);

                                      return (
                                        <div
                                          key={`${event.order_hash || event.event_timestamp}-${i}`}
                                          className="flex items-center justify-between border-b pb-4"
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                              <EventIcon className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                            <div>
                                              <p className="font-medium">{eventTypeLabel}</p>
                                              <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                                                {event.maker
                                                  ? `From: ${event.maker.substring(0, 6)}...`
                                                  : 'Unknown'}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            {hasPrice && (
                                              <div className="font-bold">
                                                <Currency amount={price} />
                                              </div>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                              {event.expiration_date && event.event_timestamp
                                                ? `Expires in ${formatExpirationTime(event.expiration_date, event.event_timestamp)}`
                                                : timeAgo}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* Load more button */}
                                    {activityHasMore && (
                                      <div className="flex justify-center pt-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            fetchCollectionActivity(activityNext || undefined)
                                          }
                                          disabled={isLoadingActivity}
                                        >
                                          {isLoadingActivity ? (
                                            <>
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                              Loading...
                                            </>
                                          ) : (
                                            'Load More'
                                          )}
                                        </Button>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="text-center py-10 text-muted-foreground">
                                    {isLoadingActivity ? (
                                      <div className="flex flex-col items-center">
                                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                        <p>Loading activity...</p>
                                      </div>
                                    ) : (
                                      <p>No recent activity found</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                          <Card className="border-[2px] border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700">
                            <CardHeader className="text-lg ">Statistics</CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                              <div className="border rounded-lg p-4">
                                <p className="text-sm text-muted-foreground">Floor Price</p>
                                <div className="text-xl font-bold">
                                  <Currency
                                    // @ts-ignore
                                    amount={
                                      user?.family?.currencyAddress ===
                                      '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4'
                                        ? nft.lowestPrice! * stableRate * 1.02 ||
                                          nft.price * stableRate * 1.02
                                        : nft.lowestPrice! * 1.02 || nft.price * 1.02 || 0
                                    }
                                  />
                                </div>
                              </div>
                              <div className="border rounded-lg p-4">
                                <p className="text-sm text-muted-foreground">7D Volume Traded</p>
                                <div className="text-xl font-bold">
                                  <Currency
                                    amount={
                                      stableRate *
                                      (nft.volume?.['7day']
                                        ? Number.parseFloat(nft.volume['7day'])
                                        : 0)
                                    }
                                  />
                                </div>
                              </div>
                              <div className="border rounded-lg p-4">
                                <p className="text-sm text-muted-foreground">Items</p>
                                <p className="text-xl font-bold">
                                  {nft.tokenCount?.toLocaleString() || 'N/A'}
                                </p>
                              </div>
                              <div className="border rounded-lg p-4">
                                <p className="text-sm text-muted-foreground">Owners</p>
                                <p className="text-xl font-bold">{nft.ownerCount}</p>
                              </div>
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </Tabs>
              </div>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}

      {/* NFT Token Dialog */}
      <NFTTokenDialog
        open={isTokenDialogOpen}
        onOpenChange={handleTokenDialogClose}
        token={selectedToken}
        isLoading={isLoadingToken}
      />
    </AnimatePresence>
  );
}
