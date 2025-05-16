'use client';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Search, Gift, ShoppingBag, Tag, Info, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/authContext';
import { getKidPermissions } from '@/server/permissions';
export function GiftCardInterface() {
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allowedCategories, setAllowedCategories] = useState<string[]>([]);
  const [maxGiftCardAmount, setMaxGiftCardAmount] = useState<number | null>(null);
  const [requireApproval, setRequireApproval] = useState(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const { user, stableBalance } = useAuth();

  // Fetch gift card permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.id) return;

      try {
        setIsLoadingPermissions(true);
        const response = await getKidPermissions(user.id);

        if (response.status === 200 && response.data) {
          // Get allowed categories
          let categories = response.data.allowedGiftCardCategories || [];

          // Fallback to old boolean flags if array is empty
          //   if (categories.length === 0) {
          //     if (response.data.allowGamingGiftCards) categories.push('gaming');
          //     if (response.data.allowFoodGiftCards) categories.push('food');
          //     if (response.data.allowEntertainmentGiftCards) categories.push('entertainment');
          //     if (response.data.allowShoppingGiftCards) categories.push('shopping');
          //   }

          // If still empty after fallback, allow all categories
          if (categories.length === 0) {
            categories = ['gaming', 'food', 'entertainment', 'shopping'];
          }

          setAllowedCategories(categories);

          // Set max gift card amount if available
          if (response.data.maxGiftCardAmount) {
            setMaxGiftCardAmount(response.data.maxGiftCardAmount);
          }

          // Set approval requirement
          setRequireApproval(response.data.requireGiftCardApproval !== false);
        }
      } catch (error) {
        console.error('Error fetching gift card permissions:', error);
        // On error, allow all categories as fallback
        setAllowedCategories(['gaming', 'food', 'entertainment', 'shopping']);
      } finally {
        setIsLoadingPermissions(false);
      }
    };

    fetchPermissions();
  }, [user?.id]);

  // Filter gift cards based on search query, allowed categories, and max amount
  const filterGiftCards = (cards: any[]) => {
    return cards.filter(card => {
      // Map emoji icons to categories
      const categoryMap: Record<string, string> = {
        '🎮': 'gaming',
        '🧱': 'gaming',
        '🎬': 'entertainment',
        '🎵': 'entertainment',
        '🍕': 'food',
        '☕': 'food',
      };

      const cardCategory = categoryMap[card.icon] || 'other';

      // Filter by search query
      const matchesSearch =
        searchQuery === '' || card.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Filter by allowed categories
      const isAllowedCategory = allowedCategories.includes(cardCategory);

      // Filter by max amount if set
      const lowestAmount = card.amounts[0] ? parseFloat(card.amounts[0].replace('$', '')) : 0;
      const withinAmountLimit =
        maxGiftCardAmount === null || maxGiftCardAmount === 0 || lowestAmount <= maxGiftCardAmount;

      return matchesSearch && isAllowedCategory && withinAmountLimit;
    });
  };

  const giftCards = [
    {
      id: 1,
      name: 'Roblox',
      icon: '🎮',
      amounts: ['$10', '$25', '$50'],
      image: '/placeholder.svg?height=100&width=150',
    },
    {
      id: 2,
      name: 'Minecraft',
      icon: '🧱',
      amounts: ['$15', '$30'],
      image: '/placeholder.svg?height=100&width=150',
    },
    {
      id: 3,
      name: 'Netflix',
      icon: '🎬',
      amounts: ['$15', '$25', '$50'],
      image: '/placeholder.svg?height=100&width=150',
    },
    {
      id: 4,
      name: 'Spotify',
      icon: '🎵',
      amounts: ['$10', '$20', '$30'],
      image: '/placeholder.svg?height=100&width=150',
    },
    {
      id: 5,
      name: 'Pizza Hut',
      icon: '🍕',
      amounts: ['$15', '$25', '$50'],
      image: '/placeholder.svg?height=100&width=150',
    },
    {
      id: 6,
      name: 'Starbucks',
      icon: '☕',
      amounts: ['$10', '$20', '$50'],
      image: '/placeholder.svg?height=100&width=150',
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Available Balance</CardTitle>
          <CardDescription>Your current allowance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">$45.00</div>
          <div className="text-sm text-muted-foreground mt-1">Available for gift cards</div>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search gift cards..."
          className="pl-10"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
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
          {requireApproval && (
            <div className="text-sm text-muted-foreground flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              Gift card purchases require parent approval
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="gaming">Gaming</TabsTrigger>
          <TabsTrigger value="food">Food</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="pt-4">
          <div className="grid grid-cols-2 gap-4">
            {filterGiftCards(giftCards).length > 0 ? (
              filterGiftCards(giftCards).map(card => (
                <Card key={card.id} className="overflow-hidden">
                  <CardHeader className="p-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span>{card.icon}</span>
                      <span>{card.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <img
                      src={card.image || '/placeholder.svg'}
                      alt={card.name}
                      className="w-full h-24 object-cover"
                    />
                  </CardContent>
                  <CardFooter className="p-3 flex-col items-start gap-2">
                    <div className="text-sm text-muted-foreground">
                      Available: {card.amounts.join(', ')}
                    </div>
                    <Button className="w-full" size="sm" onClick={() => setSelectedCard(card)}>
                      <Tag className="mr-2 h-4 w-4" />
                      Purchase
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="col-span-2 py-10 text-center text-muted-foreground">
                <Gift className="mx-auto h-10 w-10 opacity-50 mb-2" />
                <p>No gift cards found matching your criteria</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gaming" className="pt-4">
          <div className="grid grid-cols-2 gap-4">
            {filterGiftCards(giftCards.filter(card => ['🎮', '🧱'].includes(card.icon))).length >
            0 ? (
              filterGiftCards(giftCards.filter(card => ['🎮', '🧱'].includes(card.icon))).map(
                card => (
                  <Card key={card.id} className="overflow-hidden">
                    <CardHeader className="p-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span>{card.icon}</span>
                        <span>{card.name}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <img
                        src={card.image || '/placeholder.svg'}
                        alt={card.name}
                        className="w-full h-24 object-cover"
                      />
                    </CardContent>
                    <CardFooter className="p-3 flex-col items-start gap-2">
                      <div className="text-sm text-muted-foreground">
                        Available: {card.amounts.join(', ')}
                      </div>
                      <Button className="w-full" size="sm" onClick={() => setSelectedCard(card)}>
                        <Tag className="mr-2 h-4 w-4" />
                        Purchase
                      </Button>
                    </CardFooter>
                  </Card>
                )
              )
            ) : (
              <div className="col-span-2 py-10 text-center text-muted-foreground">
                <Gift className="mx-auto h-10 w-10 opacity-50 mb-2" />
                <p>No gaming gift cards available</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="food" className="pt-4">
          <div className="grid grid-cols-2 gap-4">
            {filterGiftCards(giftCards.filter(card => ['🍕', '☕'].includes(card.icon))).length >
            0 ? (
              filterGiftCards(giftCards.filter(card => ['🍕', '☕'].includes(card.icon))).map(
                card => (
                  <Card key={card.id} className="overflow-hidden">
                    <CardHeader className="p-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span>{card.icon}</span>
                        <span>{card.name}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <img
                        src={card.image || '/placeholder.svg'}
                        alt={card.name}
                        className="w-full h-24 object-cover"
                      />
                    </CardContent>
                    <CardFooter className="p-3 flex-col items-start gap-2">
                      <div className="text-sm text-muted-foreground">
                        Available: {card.amounts.join(', ')}
                      </div>
                      <Button className="w-full" size="sm" onClick={() => setSelectedCard(card)}>
                        <Tag className="mr-2 h-4 w-4" />
                        Purchase
                      </Button>
                    </CardFooter>
                  </Card>
                )
              )
            ) : (
              <div className="col-span-2 py-10 text-center text-muted-foreground">
                <Gift className="mx-auto h-10 w-10 opacity-50 mb-2" />
                <p>No food gift cards available</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedCard} onOpenChange={open => !open && setSelectedCard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCard?.icon} {selectedCard?.name} Gift Card
            </DialogTitle>
            <DialogDescription>Purchase a gift card with your allowance</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <img
              src={selectedCard?.image || '/placeholder.svg'}
              alt={selectedCard?.name}
              className="w-full h-40 object-cover rounded-lg"
            />

            <div className="space-y-2">
              <div className="font-medium">Select Amount</div>
              <div className="flex flex-wrap gap-2">
                {selectedCard?.amounts.map((amount: string, index: number) => (
                  <Button key={index} variant="outline" className="flex-1">
                    {amount}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-muted p-3 rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span>Card Amount</span>
                <span>{selectedCard?.amounts[0]}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Processing Fee</span>
                <span>$0.00</span>
              </div>
              <div className="flex justify-between font-medium pt-1 border-t">
                <span>Total</span>
                <span>{selectedCard?.amounts[0]}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCard(null)}>
              Cancel
            </Button>
            <Button>Confirm Purchase</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
          <CardDescription>Your past gift card purchases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
              <div className="text-center py-4">
                <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                <p className="mt-2 text-muted-foreground">No purchase history yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
