'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Gift, Loader2, X, Info, ShoppingBag, Tag, DollarSign } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/authContext';
import { getKidPermissions } from '@/server/permissions';
import { fetchGiftCardProducts } from '@/lib/bando-api';
import type { BandoProductVariant } from '@/lib/bando-api';
import { GiftCardBuyDrawer } from '../dialogs/gift-card/gift-card-buy-drawer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Currency } from '../shared/currency-symbol';

interface GiftCardBrand {
  id: string;
  brandName: string;
  brandSlug: string;
  imageUrl: string;
  amounts: number[];
  variants: BandoProductVariant[];
}

interface GiftCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand: GiftCardBrand | null;
  onSelectAmount: (amount: number) => void;
}

const GiftCardModal: React.FC<GiftCardModalProps> = ({
  isOpen,
  onClose,
  brand,
  onSelectAmount,
}) => {
  if (!brand) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden max-h-[70vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <DialogHeader className="space-y-4">
            <div className="flex items-center space-x-4">
              {brand.imageUrl && (
                <div className="relative">
                  <img
                    src={brand.imageUrl || '/placeholder.svg'}
                    alt={brand.brandName}
                    className="w-16 h-16 rounded-xl object-contain border-2 bg-white shadow-lg"
                    onError={e => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                    <Gift className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
              )}
              <div className="flex-1">
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                  {brand.brandName}
                </DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400 text-sm">
                  Choose your gift card amount
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <div className="grid grid-cols-2 gap-3">
            {brand.amounts.map(amount => (
              <Button
                key={amount}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center border-2 hover:border-primary hover:bg-primary/5 transition-all duration-200 group relative overflow-hidden"
                onClick={() => onSelectAmount(amount)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100 relative z-10">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(amount)}{' '}
                  {brand.variants[0].price.fiatCurrency}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 relative z-10 mt-0.5">
                  Gift Card
                </span>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export function GiftCardInterface() {
  const [searchQuery, setSearchQuery] = useState('');
  const [maxGiftCardAmount, setMaxGiftCardAmount] = useState<number | null>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  // Using BandoProductVariant for gift cards state
  // All gift card variants are stored here for reference
  const [giftCards, setGiftCards] = useState<BandoProductVariant[]>([]);
  const [brands, setBrands] = useState<GiftCardBrand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<GiftCardBrand | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<BandoProductVariant | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingGiftCards, setIsLoadingGiftCards] = useState(true);
  const [giftCardCountry, setGiftCardCountry] = useState('US');
  const { user, stableBalance } = useAuth();
  const displayBalance = stableBalance ?? 0; // Handle null case with nullish coalescing

  // Fetch gift card permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.id) return;

      try {
        setIsLoadingPermissions(true);
        const response = await getKidPermissions(user.id);

        if (response.status === 200 && response.data) {
          // Set max gift card amount if available
          if (response.data.maxGiftCardAmount) {
            setMaxGiftCardAmount(response.data.maxGiftCardAmount);
          }

          if (response.data.giftCardCountry) {
            setGiftCardCountry(response.data.giftCardCountry);
          }
        }
      } catch (error) {
        console.error('Error fetching gift card permissions:', error);
      } finally {
        setIsLoadingPermissions(false);
      }
    };

    fetchPermissions();
  }, [user?.id]);

  // Process API response into grouped brands with unique amounts
  const processBrandProducts = (apiResponse: any): GiftCardBrand[] => {
    const brandMap: Record<string, GiftCardBrand> = {};

    // Check if we have the expected data structure
    if (!apiResponse?.products?.[0]?.brands) {
      console.error('Unexpected API response structure:', apiResponse);
      return [];
    }

    // Get the first product (gift_card) and its brands
    const giftCardProduct = apiResponse.products[0];

    giftCardProduct.brands.forEach((brand: any) => {
      // Skip if brand doesn't have variants
      if (!brand.variants || !Array.isArray(brand.variants) || brand.variants.length === 0) {
        console.log('Brand has no variants:', brand.brandName);
        return;
      }

      const brandKey = brand.brandSlug || brand.brandName.toLowerCase().replace(/\s+/g, '-');

      // Initialize brand if it doesn't exist
      if (!brandMap[brandKey]) {
        brandMap[brandKey] = {
          id: brandKey,
          brandName: brand.brandName,
          brandSlug: brandKey,
          imageUrl: brand.imageUrl || '',
          amounts: [],
          variants: [],
        };
      }

      // Process each variant
      brand.variants.forEach((variant: any) => {
        const amount = parseFloat(variant.price?.fiatValue || variant.price?.amount || '0');

        if (amount > 0 && !brandMap[brandKey].amounts.includes(amount)) {
          brandMap[brandKey].amounts.push(amount);
        }

        const variantData: BandoProductVariant = {
          ...variant,
          id: variant.id,
          fupId: variant.fupId || variant.id,
          brand: brand.brandName,
          country: variant.country || giftCardCountry,
          sku: variant.sku || variant.id,
          price: {
            fiatCurrency: variant.price?.fiatCurrency || variant.price?.currency || 'USD',
            fiatValue: amount.toString(),
            stableCoinCurrency: variant.price?.stableCoinCurrency || 'USDC',
          },
          productType: giftCardProduct.productType,
          subTypes: variant.subTypes || [],
          supportedCountries: variant.supportedCountries || [variant.country || giftCardCountry],
          imageUrl: variant.imageUrl || brand.imageUrl || '',
          evmServiceId: variant.evmServiceId,
          svmServiceId: variant.svmServiceId,
        };

        brandMap[brandKey].variants.push(variantData);
        setGiftCards(prev => [...prev, variantData]);
      });
    });

    const result = Object.values(brandMap);
    result.sort((a, b) => a.brandName.localeCompare(b.brandName));

    result.forEach(brand => {
      // Sort variants by price (converting fiatValue to number for comparison)
      brand.variants.sort((a, b) => parseFloat(a.price.fiatValue) - parseFloat(b.price.fiatValue));

      // Ensure all variants have required fields
      brand.variants.forEach(variant => {
        if (!variant.price) {
          variant.price = {
            fiatCurrency: 'USD',
            fiatValue: '0',
            stableCoinCurrency: 'USDC',
          };
        }
      });
    });

    console.log(`Processed ${result.length} brands`);
    return result;
  };

  useEffect(() => {
    const fetchGiftCards = async () => {
      if (isLoadingPermissions) return;

      try {
        setIsLoadingGiftCards(true);
        console.log('Fetching gift cards...');
        const response = await fetchGiftCardProducts(giftCardCountry, 'gift_card');
        console.log('API Response:', response);

        const processedBrands = processBrandProducts(response);
        console.log('Processed Brands:', processedBrands);

        setBrands(processedBrands);
      } catch (error) {
        console.error('Error fetching gift cards:', error);
        setGiftCards([]);
        setBrands([]);
      } finally {
        setIsLoadingGiftCards(false);
      }
    };

    fetchGiftCards();
  }, [giftCardCountry, isLoadingPermissions]);

  const handleBrandClick = (brand: GiftCardBrand) => {
    setSelectedBrand(brand);
  };

  const handleAmountSelect = (variant: BandoProductVariant) => {
    setSelectedVariant(variant);
    setIsDrawerOpen(true);
  };

  const getFilteredBrands = useCallback(
    (brandsToFilter: GiftCardBrand[]) => {
      if (!brandsToFilter.length) return [];

      return brandsToFilter.filter((brand: GiftCardBrand) => {
        if (/^\d/.test(brand.brandName)) {
          return false;
        }

        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
          searchQuery === '' ||
          brand.brandName.toLowerCase().includes(searchLower) ||
          brand.brandSlug.toLowerCase().includes(searchLower);

        const withinAmountLimit =
          maxGiftCardAmount === null ||
          maxGiftCardAmount === 0 ||
          brand.amounts.some(amount => amount <= (maxGiftCardAmount || 0));

        return matchesSearch && withinAmountLimit;
      });
    },
    [searchQuery, maxGiftCardAmount]
  );

  const filteredBrands = useMemo(
    () => getFilteredBrands(brands),
    [brands, searchQuery, maxGiftCardAmount, getFilteredBrands]
  );

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
          <CardDescription className="text-purple-100">
            Available for Gift Card purchases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Currency className="text-4xl font-bold" amount={stableBalance ?? 0} />
        </CardContent>
      </Card>

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search gift cards by brand..."
            className="pl-10 h-10 text-base"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search gift cards by brand"
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
      </div>

      {isLoadingPermissions ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          {maxGiftCardAmount !== null && maxGiftCardAmount > 0 && (
            <div className="text-sm text-muted-foreground flex items-center">
              <Info className="h-4 w-4 mr-1" />
              Gift card purchases limited to ${maxGiftCardAmount.toFixed(2)} or less
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all" className="flex items-center gap-1">
            <Gift className="h-4 w-4" /> All
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1">
            <ShoppingBag className="h-4 w-4" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="pt-4">
          {isLoadingGiftCards ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {filteredBrands.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredBrands.map(brand => (
                    <Card
                      key={brand.id}
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col"
                      onClick={() => handleBrandClick(brand)}
                    >
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex items-center space-x-3 mb-3">
                          {brand.imageUrl ? (
                            <img
                              src={brand.imageUrl}
                              alt={brand.brandName}
                              className="w-16 h-16 rounded-md object-contain border-[2px] bg-[rgba(255,241,214,0.95)] text-[#B74B28] border-black shadow-yellow-700 shadow-[-5px_6px_0px_#000000] hover:shadow-[-2px_3px_0px_#000000]"
                              onError={e => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/placeholder.svg';
                              }}
                            />
                          ) : (
                            <span className="w-16 h-16 rounded-md object-contain border-[2px] bg-[rgba(255,241,214,0.95)] text-[#B74B28] border-black shadow-yellow-700 shadow-[-5px_6px_0px_#000000] flex items-center justify-center hover:shadow-[-2px_3px_0px_#000000]">
                              {brand.brandName[0]}
                            </span>
                          )}
                          <h3 className="font-medium text-sm line-clamp-2">{brand.brandName}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-auto pt-2">
                          {brand.amounts.slice(0, 4).map(amount => (
                            <Badge
                              key={amount}
                              variant="outline"
                              className="px-2 py-0.5 text-xs text-[#B74B28]"
                            >
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
                                maximumFractionDigits: 2,
                              }).format(amount)}
                            </Badge>
                          ))}
                          {brand.amounts.length > 4 && (
                            <Badge variant="secondary" className="text-xs">
                              +{brand.amounts.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="col-span-full text-center py-10">
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? 'No gift cards match your search.'
                      : 'No gift cards available at the moment.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Purchase History</CardTitle>
              <CardDescription>Your past gift card purchases and redemptions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-4 p-4 pt-0">
                {[
                  {
                    name: 'Roblox',
                    icon: '🎮',
                    amount: '$10.00',
                    date: 'Apr 5, 2024',
                    time: '2:45 PM',
                    code: 'XXXX-XXXX-XXXX-1234',
                  },
                ].map((purchase, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                        <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-1">
                          <span>{purchase.icon}</span>
                          <span>{purchase.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {purchase.date} at {purchase.time}
                        </div>
                        <div className="text-xs font-mono mt-1">{purchase.code}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{purchase.amount}</div>
                      <Button variant="ghost" size="sm" className="mt-1">
                        <Info className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {[
                  {
                    name: 'Roblox',
                    icon: '🎮',
                    amount: '$10.00',
                    date: 'Apr 5, 2024',
                    time: '2:45 PM',
                    code: 'XXXX-XXXX-XXXX-1234',
                  },
                ].length === 0 && (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground opacity-30" />
                    <p className="mt-3 text-muted-foreground">No purchase history yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your gift card purchases will appear here
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedVariant && selectedBrand && (
        <GiftCardBuyDrawer
          open={isDrawerOpen}
          onOpenChange={open => {
            setIsDrawerOpen(open);
            if (!open) {
              setSelectedVariant(null);
            }
          }}
          variant={selectedVariant}
          brandName={selectedBrand.brandName}
          brandImageUrl={selectedBrand.imageUrl}
        />
      )}

      <GiftCardModal
        isOpen={!!selectedBrand}
        onClose={() => setSelectedBrand(null)}
        brand={selectedBrand}
        onSelectAmount={amount => {
          if (!selectedBrand) return;
          const variant = selectedBrand.variants.find(
            v => parseFloat(v.price.fiatValue) === amount
          );
          if (variant) {
            setSelectedVariant(variant);
            setIsDrawerOpen(true);
          }
        }}
      />
    </div>
  );
}
