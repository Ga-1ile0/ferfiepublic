'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  ImageIcon,
  ExternalLink,
  Info,
  ShoppingCart,
  Loader2,
  BadgeCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Tag,
  X,
  Handshake,
  Send,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NFTDetailDialog } from '../dialogs/nft-collection';
import { useAuth } from '@/contexts/authContext';
import { Currency } from '../shared/currency-symbol';
import { getKidPermissions } from '@/server/permissions';
import { getUserTransactions } from '@/server/transaction';
import { getEthStableRate } from '@/lib/tokens';
import { availableNfts as localNftDefinitions, type HardcodedNft } from '@/lib/nfts';
import { optimizeImage } from '@/lib/reservoir';
import type { NFT, ReservoirCollection, NFTHistoryItem } from '@/types/nft';
import { TransactionType, type NftCollection } from '@prisma/client';
import { devLog } from '@/lib/devlog';
import { getNftCollections } from '@/server/crypto/nft';

export function NFTInterface() {
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxNftPrice, setMaxNftPrice] = useState<number | null>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [allowedNftSlugs, setAllowedNftSlugs] = useState<string[]>([]);
  const [nftEnabled, setNftEnabled] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collectionsData, setCollectionsData] = useState<ReservoirCollection[]>([]);
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [collectionsContinuation, setCollectionsContinuation] = useState<string | null>(null);
  const [hasMoreCollections, setHasMoreCollections] = useState(false);
  const [allCollectionsFetched, setAllCollectionsFetched] = useState(false);
  // Add stableEthRate state
  const [stableEthRate, setStableEthRate] = useState<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { user, stableBalance } = useAuth();
  const [customCollections, setCustomCollections] = useState<NftCollection[]>([]);

  useEffect(() => {
    const fetchCustomCollections = async () => {
      if (user?.family?.id) {
        const { custom } = await getNftCollections(user.family.id);
        setCustomCollections(custom);
      }
    };
    fetchCustomCollections();
  }, [user?.family?.id]);

  // Fetch stable ETH rate if BRZ is selected as family currency
  useEffect(() => {
    const fetchRate = async () => {
      if (user?.family?.currencyAddress === '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4') {
        const rate = await getEthStableRate('0xE9185Ee218cae427aF7B9764A011bb89FeA761B4');
        setStableEthRate(rate);
      } else {
        setStableEthRate(null);
      }
    };
    fetchRate();
  }, [user?.family?.currencyAddress]);

  const combinedNfts = useMemo(() => {
    const hardcoded = localNftDefinitions.map(nft => ({
      id: nft.id,
      name: nft.name,
      collection: nft.name,
      description: `A unique NFT from the ${nft.name} collection.`,
      price: 15 + Math.floor(Math.random() * 30),
      image: nft.image,
      banner: nft.banner,
      creator: 'Base Artist',
      slug: nft.slug,
      contractAddress: nft.contract,
      verified: true,
      lowestPrice: 15 + Math.floor(Math.random() * 10),
    }));

    const custom = customCollections
      .map(c => ({
        id: c.id,
        name: c.name,
        collection: c.name,
        description: c.description || `A unique NFT from the ${c.name} collection.`,
        price: 0, // placeholder
        image: c.imageUrl || '/placeholder.svg',
        banner: c.imageUrl || '/placeholder.svg', // placeholder
        creator: c.creator || 'Unknown Creator',
        slug: c.slug || '',
        contractAddress: c.contractAddress,
        verified: !c.isSpam,
        lowestPrice: 0, // placeholder
      }))
      .filter(c => c.slug);

    return [...hardcoded, ...custom];
  }, [customCollections, localNftDefinitions]);

  const filteredPermittedNfts = useMemo(() => {
    if (allowedNftSlugs.length === 0) {
      return combinedNfts;
    }
    return combinedNfts.filter(nft => nft.slug && allowedNftSlugs.includes(nft.slug));
  }, [combinedNfts, allowedNftSlugs]);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.id) {
        setIsLoadingPermissions(false);
        setNftEnabled(false);
        return;
      }
      try {
        setIsLoadingPermissions(true);
        const response = await getKidPermissions(user.id);
        if (response.status === 200 && response.data) {
          setMaxNftPrice(
            typeof response.data.maxNftTradeAmount === 'number'
              ? response.data.maxNftTradeAmount
              : null
          );
          setNftEnabled(response.data.nftEnabled ?? true);
          setAllowedNftSlugs(
            Array.isArray(response.data.allowedNftSlugs) ? response.data.allowedNftSlugs : []
          );
        } else {
          console.error('Error fetching NFT permissions: Unexpected response', response);
          setMaxNftPrice(null);
          setNftEnabled(true);
          setAllowedNftSlugs([]);
        }
      } catch (error) {
        console.error('Error fetching NFT permissions:', error);
        setMaxNftPrice(null);
        setNftEnabled(true);
        setAllowedNftSlugs([]);
      } finally {
        setIsLoadingPermissions(false);
      }
    };
    fetchPermissions();
  }, [user?.id]);

  // Get all contract addresses for allowed collections - memoized
  const contractAddressesToFetch = useMemo(() => {
    let contractAddressesToFetch: string[] = [];

    if (allowedNftSlugs.length > 0) {
      contractAddressesToFetch = filteredPermittedNfts
        .map(nft => nft.contractAddress)
        .filter((address): address is string => !!address);
    } else {
      contractAddressesToFetch = combinedNfts
        .map(nft => nft.contractAddress)
        .filter((address): address is string => !!address);
    }

    // Remove duplicates
    return [...new Set(contractAddressesToFetch)];
  }, [allowedNftSlugs, combinedNfts, filteredPermittedNfts]);

  // Improved fetchCollections function to handle batching
  const fetchCollections = useCallback(
    async (loadMore = false) => {
      if (isLoadingPermissions || !nftEnabled || (loadMore && !hasMoreCollections)) {
        if (!loadMore) {
          setCollectionsData([]);
          setCollectionsContinuation(null);
          setHasMoreCollections(false);
          setAllCollectionsFetched(true);
        }
        setIsLoadingCollections(false);
        return;
      }

      if (contractAddressesToFetch.length === 0) {
        if (!loadMore) {
          setCollectionsData([]);
          setAllCollectionsFetched(true);
        }
        setCollectionsContinuation(null);
        setHasMoreCollections(false);
        setIsLoadingCollections(false);
        return;
      }

      if (!loadMore) {
        setIsLoadingCollections(true);
      }

      try {
        const url = `https://api-base.reservoir.tools/collections/v7`;

        // Create a URLSearchParams object
        const searchParams = new URLSearchParams();

        // Add base parameters
        searchParams.append('includeFloorAsk', 'true');
        searchParams.append('limit', '20'); // Fetch 20 at a time

        if (user?.family?.currencyAddress) {
          searchParams.append('displayCurrency', user.family.currencyAddress);
        }

        if (loadMore && collectionsContinuation) {
          searchParams.append('continuation', collectionsContinuation);
        }

        // Add each contract address as a separate parameter
        contractAddressesToFetch.forEach((address: string) => {
          searchParams.append('contract', address);
        });

        // Construct the full URL
        const fullUrl = `${url}?${searchParams.toString()}`;

        // Make the API request
        const response = await fetch(fullUrl);

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const responseData = await response.json();

        // Check if collections exist in the response
        if (responseData && Array.isArray(responseData.collections)) {
          // Update state with the fetched collections
          setCollectionsData(prevData => {
            // If loading more, append to existing data
            if (loadMore) {
              // Filter out duplicates by creating a Set of IDs
              const existingIds = new Set(prevData.map(col => col.id));
              const newCollections = responseData.collections.filter(
                (col: ReservoirCollection) => !existingIds.has(col.id)
              );
              return [...prevData, ...newCollections];
            }
            // Otherwise, start fresh
            return responseData.collections;
          });

          // Update continuation token if it exists
          setCollectionsContinuation(responseData.continuation || null);
          setHasMoreCollections(!!responseData.continuation);

          // If we got fewer collections than requested or no continuation token,
          // we've fetched all collections
          if (!responseData.continuation || responseData.collections.length < 20) {
            setAllCollectionsFetched(true);
          }
        } else {
          if (!loadMore) {
            setCollectionsData([]);
          }
          setCollectionsContinuation(null);
          setHasMoreCollections(false);
          setAllCollectionsFetched(true);
        }
      } catch (error) {
        console.error('Error fetching collections from Reservoir:', error);
        if (!loadMore) {
          setCollectionsData([]);
        }
        setCollectionsContinuation(null);
        setHasMoreCollections(false);
        setAllCollectionsFetched(true);
      } finally {
        setIsLoadingCollections(false);
      }
    },
    [
      nftEnabled,
      isLoadingPermissions,
      collectionsContinuation,
      user?.family?.currencyAddress,
      hasMoreCollections,
      contractAddressesToFetch,
    ]
  );

  // Initial collection fetch
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Set up intersection observer for infinite scrolling
  useEffect(() => {
    // Disconnect previous observer if it exists
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      entries => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMoreCollections && !isLoadingCollections) {
          fetchCollections(true);
        }
      },
      { threshold: 0.1 }
    );

    // Observe the load more element if it exists
    const currentLoadMoreRef = loadMoreRef.current;
    if (currentLoadMoreRef) {
      observerRef.current.observe(currentLoadMoreRef);
    }

    // Cleanup
    return () => {
      if (observerRef.current && currentLoadMoreRef) {
        observerRef.current.unobserve(currentLoadMoreRef);
        observerRef.current.disconnect();
      }
    };
  }, [fetchCollections, hasMoreCollections, isLoadingCollections]);

  // State for NFT history data from DB
  const [nftHistory, setNftHistory] = useState<NFTHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Fetch NFT transaction history
  const fetchNFTHistory = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingHistory(true);

    try {
      // Fetch transactions for this user
      const response = await getUserTransactions(user.id, 20);

      if (response.status === 200 && response.data) {
        // Filter only NFT transactions
        const nftTransactions = response.data.filter(tx => tx.type === TransactionType.NFT_TRADE);

        // Convert ETH values to user's family currency if applicable
        let rate = 1;
        if (user.family?.currencyAddress) {
          try {
            rate = await getEthStableRate(user.family.currencyAddress);
          } catch (error) {
            console.error('Error fetching ETH to stable rate:', error);
          }
        }

        // Transform transaction data into NFTHistoryItem format
        const historyItems: NFTHistoryItem[] = nftTransactions.map(tx => {
          // Parse description to determine type
          const isSale =
            tx.description?.toLowerCase().includes('sold') ||
            tx.description?.toLowerCase().includes('accepted offer');
          const isPurchase =
            tx.description?.toLowerCase().includes('purchased') ||
            tx.description?.toLowerCase().includes('bought');
          const isListing = tx.description?.toLowerCase().includes('listed');
          const isCancelled = tx.description?.toLowerCase().includes('cancel');
          const isOffer =
            tx.description?.toLowerCase().includes('offer') &&
            !tx.description?.toLowerCase().includes('accepted offer');
          const isTransfer = tx.description?.toLowerCase().includes('transfer');

          // Extract collection and NFT name if available in description
          const descriptionParts = tx.description?.split(' ') || [];
          let collection = 'NFT Collection';
          let name = 'NFT';

          if (tx.description) {
            // Try to extract name and collection from description
            // Common formats: "Purchased Base Feral #123", "Listed Pudgy #456 for sale"
            const matches = tx.description.match(
              /(?:Purchased|Listed|Sold|Bought)\s+([^#]+)\s+#(\d+)/i
            );
            if (matches && matches.length >= 3) {
              collection = matches[1].trim();
              name = `${collection} #${matches[2]}`;
            }
          }

          let type: 'purchase' | 'sale' | 'listing' | 'offer' | 'cancelled' | 'transfer' =
            'purchase';
          if (isSale) type = 'sale';
          if (isListing) type = 'listing';
          if (isCancelled) type = 'cancelled';
          if (isOffer) type = 'offer';
          if (isTransfer) type = 'transfer';

          return {
            id: tx.id,
            type: type,
            name: name,
            collection: collection,
            price: tx.amount,
            date: new Date(tx.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            image: '/nft-placeholder.png', // Default placeholder
            txHash: tx.hash,
            timestamp: tx.createdAt,
            description: tx.description || '',
          };
        });

        // Sort by timestamp, newest first
        historyItems.sort((a, b) => {
          if (!a.timestamp || !b.timestamp) return 0;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        setNftHistory(historyItems);
      }
    } catch (error) {
      console.error('Error fetching NFT history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  // Fetch NFT history when user changes
  useEffect(() => {
    if (user?.id) {
      fetchNFTHistory();
    }
  }, [user?.id, fetchNFTHistory]);

  // Helper function to get badge styling based on transaction type
  const getBadgeClassForType = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'sale':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'listing':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'offer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'transfer':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
    }
  };

  // Filter NFTs based on search query and other criteria
  const filteredNFTs = useMemo(() => {
    return combinedNfts.filter(nft => {
      const lowerSearchQuery = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === '' ||
        nft.name.toLowerCase().includes(lowerSearchQuery) ||
        nft.collection.toLowerCase().includes(lowerSearchQuery);

      const withinPriceLimit =
        maxNftPrice === null || maxNftPrice === 0 || nft.price <= maxNftPrice;

      const isAllowed =
        nftEnabled &&
        (allowedNftSlugs.length === 0 || (nft.slug && allowedNftSlugs.includes(nft.slug)));

      return matchesSearch && withinPriceLimit && isAllowed;
    });
  }, [combinedNfts, searchQuery, maxNftPrice, allowedNftSlugs, nftEnabled]);

  // Filter collections based on search query
  const filteredCollections = useMemo(() => {
    if (!collectionsData) return [];
    return collectionsData.filter(collection => {
      const lowerSearchQuery = searchQuery.toLowerCase();

      // Safe property access to handle null/undefined values
      const nameMatch = collection.name
        ? collection.name.toLowerCase().includes(lowerSearchQuery)
        : false;
      const slugMatch = collection.slug
        ? collection.slug.toLowerCase().includes(lowerSearchQuery)
        : false;
      const idMatch = collection.id
        ? collection.id.toLowerCase().includes(lowerSearchQuery)
        : false;

      return searchQuery === '' || nameMatch || slugMatch || idMatch;
    });
  }, [collectionsData, searchQuery]);

  // Handle NFT selection
  const handleNFTSelect = useCallback((nft: NFT) => {
    // Ensure NFT has a unique ID and slug before setting it
    const nftWithUniqueId = {
      ...nft,
      id: nft.id || Math.floor(Math.random() * 1000000),
      // If slug is missing, generate a fallback from collection name
      slug: nft.slug || nft.collection?.toLowerCase().replace(/\s+/g, '-') || 'collection',
    };

    devLog.log('Selected NFT with slug:', nftWithUniqueId.slug);
    setSelectedNFT(nftWithUniqueId);
    setDialogOpen(true);
  }, []);

  // Create NFT object from collection data
  const createNFTFromCollection = useCallback((collection: ReservoirCollection): NFT => {
    // Log the collection object to debug
    devLog.log('Creating NFT from collection:', collection);
    devLog.log('Collection slug:', collection.slug);

    // Make sure we have a valid slug - use the collection ID as a fallback
    const nftSlug = collection.slug || collection.id.toLowerCase();

    const nft = {
      id: Number.parseInt(collection.id.slice(0, 8), 16),
      name: collection.name,
      collection: collection.name,
      description: collection.description || `A collection of unique NFTs from ${collection.name}.`,
      price: collection.floorAsk?.price?.amount?.decimal || 0,
      image: collection.image,
      banner: collection.banner,
      creator: collection.creator,
      contractAddress: collection.primaryContract,
      ownerCount: collection.ownerCount,
      tokenCount: collection.tokenCount,
      slug: nftSlug, // Set the slug with the fallback if needed
      verified: true,
      volume: {
        '7day': collection.volume?.['7day'] || '0',
        '30day': collection.volume?.['30day'] || '0',
      },
      lowestPrice: collection.floorAsk?.price?.amount?.decimal || 0,
      twitterUsername: collection.twitterUsername,
      discordUrl: collection.discordUrl,
      externalUrl: collection.externalUrl,
    };

    devLog.log('Created NFT object:', nft);
    return nft;
  }, []);

  return (
    <div className="space-y-6 pb-20">
      <Card
        className="text-white mb-6 sm:mb-0"
        style={{
          backgroundColor: '#a855f7',
          backgroundImage: 'linear-gradient(to right, #8b5cf6, #4f46e5)',
        }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Your Balance</CardTitle>
          <CardDescription className="text-purple-100">Available for NFT purchases</CardDescription>
        </CardHeader>
        <CardContent>
          <Currency className="text-4xl font-bold" amount={stableBalance ?? 0} />
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search NFTs or Collections..."
          className="pl-10"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:bg-transparent"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isLoadingPermissions ? (
        <div className="flex justify-center items-center h-10">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
          <span className="ml-2 text-sm text-muted-foreground">Loading permissions...</span>
        </div>
      ) : maxNftPrice !== null && maxNftPrice > 0 ? (
        <div className="mt-2 text-sm text-muted-foreground flex flex-wrap items-center">
          <Info className="h-4 w-4 mr-1 shrink-0" />
          NFT purchases limited to
          <Currency className="mx-1" amount={maxNftPrice} /> or less.
        </div>
      ) : null}

      <Tabs defaultValue="collections" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="mt-6">
          <div>
            {isLoadingPermissions ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading permissions...</span>
              </div>
            ) : !nftEnabled ? (
              <div className="col-span-full py-10 text-center text-muted-foreground">
                <ImageIcon className="mx-auto h-10 w-10 opacity-50 mb-2" />
                <p>NFT trading is currently disabled by your parent.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {isLoadingCollections && collectionsData.length === 0 ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <Card key={index} className="overflow-hidden flex flex-col">
                      <div className="h-24 w-full bg-muted animate-pulse"></div>
                      <CardContent className="p-4 flex-grow flex items-start gap-4 relative">
                        <div className="mt-[-24px] flex-shrink-0">
                          <div className="w-16 h-16 rounded-md bg-muted animate-pulse"></div>
                        </div>
                        <div className="flex-grow space-y-2">
                          <div className="h-6 w-3/4 bg-muted animate-pulse rounded"></div>
                          <div className="h-4 w-1/2 bg-muted animate-pulse rounded"></div>
                        </div>
                      </CardContent>
                      <CardFooter className="p-3 border-t">
                        <div className="h-8 w-full bg-muted animate-pulse rounded"></div>
                      </CardFooter>
                    </Card>
                  ))
                ) : filteredCollections.length > 0 ? (
                  filteredCollections.map((collection, index) => (
                    <Card
                      key={`${collection.id}-${index}`}
                      className="overflow-hidden flex flex-col hover:shadow-lg transition-shadow duration-200"
                      onClick={() => handleNFTSelect(createNFTFromCollection(collection))}
                    >
                      <div className="h-24 w-full bg-muted">
                        {collection.banner && (
                          <img
                            src={optimizeImage(collection.banner, 500) || '/placeholder.svg'}
                            alt={`${collection.name} banner`}
                            className="w-full h-full object-cover"
                            onError={e => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>

                      <CardContent className="p-4 flex-grow flex items-start gap-4 relative">
                        <div className="mt-[-24px] flex-shrink-0">
                          <img
                            src={optimizeImage(collection.image, 100) || '/placeholder.svg'}
                            alt={`${collection.name} logo`}
                            className="w-16 h-16 rounded-md object-cover border-[2px] bg-[rgba(255,241,214,0.95)] text-[#B74B28] border-black shadow-yellow-700 shadow-[-5px_6px_0px_#000000] hover:shadow-[-2px_3px_0px_#000000]"
                            onError={e => {
                              (e.target as HTMLImageElement).src = '/placeholder.svg';
                            }}
                          />
                        </div>
                        <div className="flex-grow">
                          <CardTitle className="text-xl truncate flex items-center gap-2">
                            {collection.name} <BadgeCheck className="h-4 w-4" />
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Lowest Price:{' '}
                            <span className="text-lg text-[#e87f4e] text-shadow-rust">
                              <Currency
                                amount={
                                  collection.floorAsk?.price?.amount?.decimal
                                    ? user?.family?.currencyAddress ===
                                        '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4' &&
                                      stableEthRate !== null
                                      ? collection.floorAsk.price.amount.decimal *
                                        1.02 *
                                        stableEthRate
                                      : collection.floorAsk.price.amount.decimal * 1.02
                                    : 0
                                }
                              />
                            </span>
                          </CardDescription>
                        </div>
                      </CardContent>

                      <CardFooter className="p-3 border-t">
                        <Button variant="outline" size="sm" className="w-full">
                          View Collection
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full py-10 text-center text-muted-foreground">
                    <Search className="mx-auto h-10 w-10 opacity-50 mb-2" />
                    <p>No collections found matching your search.</p>
                    <p className="text-xs mt-2">Try a different search or adjust your filters.</p>
                  </div>
                )}
              </div>
            )}
            <div ref={loadMoreRef} className="col-span-full h-10" />
            {isLoadingCollections && collectionsData.length > 0 && (
              <div className="col-span-full text-center py-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="col-span-full py-10 text-center text-muted-foreground">
                <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" />
                <p>Loading transaction history...</p>
              </div>
            ) : nftHistory.length > 0 ? (
              nftHistory.map((item, index) => (
                <Card
                  key={`${item.id}-${index}`}
                  className="overflow-hidden border-2 border-black shadow-[-4px_4px_0px_#000000] shadow-yellow-700"
                >
                  <div className="flex items-center p-4">
                    <div className="h-16 w-16 rounded-md overflow-hidden mr-4 flex-shrink-0 border-2 border-black">
                      <div className="h-full w-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center">
                        {item.type === 'purchase' ? (
                          <ArrowDownLeft className="h-8 w-8 text-white" />
                        ) : item.type === 'sale' ? (
                          <ArrowUpRight className="h-8 w-8 text-white" />
                        ) : item.type === 'listing' ? (
                          <Tag className="h-8 w-8 text-white" />
                        ) : item.type === 'cancelled' ? (
                          <X className="h-8 w-8 text-white" />
                        ) : item.type === 'offer' ? (
                          <Handshake className="h-8 w-8 text-white" />
                        ) : item.type === 'transfer' ? (
                          <Send className="h-8 w-8 text-white" />
                        ) : (
                          <Info className="h-8 w-8 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-grow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-xs text-muted-foreground">{item.collection}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold flex">
                            {item.type === 'purchase'
                              ? '-'
                              : item.type === 'sale'
                                ? '+'
                                : item.type === 'offer' || item.type === 'listing'
                                  ? ''
                                  : ''}
                            {item.type !== 'cancelled' && item.type !== 'transfer' ? (
                              // Currency conversion for BRZ (0xE9185Ee218cae427aF7B9764A011bb89FeA761B4)
                              <Currency
                                amount={
                                  user?.family?.currencyAddress ===
                                    '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4' &&
                                  stableEthRate !== null
                                    ? item.price * stableEthRate
                                    : item.price
                                }
                              />
                            ) : (
                              ''
                            )}
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" /> {item.date}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between items-center">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${getBadgeClassForType(item.type)}`}
                        >
                          {item.type === 'purchase'
                            ? 'Purchased'
                            : item.type === 'sale'
                              ? 'Sold'
                              : item.type === 'listing'
                                ? 'Listed'
                                : item.type === 'cancelled'
                                  ? 'Cancelled'
                                  : item.type === 'offer'
                                    ? 'Offered'
                                    : item.type === 'transfer'
                                      ? 'Transferred'
                                      : 'Activity'}
                        </span>

                        {item.txHash && (
                          <a
                            href={`https://basescan.org/tx/${item.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-xs text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" /> View Transaction
                          </a>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full py-10 text-center text-muted-foreground">
                <ImageIcon className="mx-auto h-10 w-10 opacity-50 mb-2" />
                <p>No NFT transaction history found.</p>
                <p className="text-xs mt-2">NFT purchases, sales, and listings will appear here.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Our custom dialog */}
      <NFTDetailDialog nft={selectedNFT} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
