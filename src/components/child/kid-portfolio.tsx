'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Coins, ImageIcon, Maximize2, DollarSign } from 'lucide-react';
import { useAuth } from '@/contexts/authContext';
import { toast } from 'react-toastify';
import { Currency, Token } from '@/components/shared/currency-symbol';
import { availableTokens, getMultiTokenBalances, getExchangeRate } from '@/lib/tokens';
import { getUserNFTs, type NFTItem } from '@/lib/nfts';
import { NFTImageModal } from '@/components/dialogs/nft/nft-image';
import { NFTSellDrawer } from '@/components/dialogs/nft/nft-sell-drawer';
import { redirect } from 'next/navigation';
import { devLog } from '@/lib/devlog';

// Types for portfolio data
type TokenType = {
  id: string;
  name: string;
  symbol: string;
  amount: number;
  value: number;
  priceChange: number; // not used as of now
  icon: string;
  image: string;
  contract: string;
};

export function KidPortfolio() {
  const { user, stableBalance } = useAuth();
  const [investedValue, setInvestedValue] = useState<number>(0);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);
  const [tokens, setTokens] = useState<TokenType[]>([]);
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userCurrencySymbol, setUserCurrencySymbol] = useState<string>('');
  const [selectedNFT, setSelectedNFT] = useState<NFTItem | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isSellDrawerOpen, setIsSellDrawerOpen] = useState(false);

  useEffect(() => {
    if (stableBalance !== null && !isNaN(stableBalance)) {
      setPortfolioValue(stableBalance + investedValue);
    }
  }, [stableBalance, investedValue]);

  // Fetch portfolio data
  useEffect(() => {
    const fetchPortfolioData = async () => {
      devLog.log('Fetching portfolio data for user:', user);
      setIsLoading(true);
      try {
        // Use the user from the component level, not from a hook inside this function
        if (!user || !user.walletAddress || !user.family || !user.family.currencyAddress) {
          devLog.log('User not found or missing required data');
          setTokens([]);
          setNfts([]);
          setIsLoading(false);
          return;
        }

        const userAddress = user.walletAddress;
        const userCurrencyAddress = user.family.currencyAddress;

        // Find the user's currency token to display its symbol
        const userCurrencyToken = availableTokens.find(
          t => t.contract.toLowerCase() === userCurrencyAddress.toLowerCase()
        );

        if (userCurrencyToken) {
          setUserCurrencySymbol(userCurrencyToken.symbol);
        }

        devLog.log('Fetching token balances for user:', userAddress);
        devLog.log('User currency address:', userCurrencyAddress);

        // Fetch all token balances using multicall
        const balances = await getMultiTokenBalances(userAddress);
        devLog.log('Token balances:', balances);

        // Process tokens with exchange rates
        const tokensWithValues = await Promise.all(
          availableTokens.map(async (token, index) => {
            const amount = balances[index] ?? 0;

            // Only calculate exchange rate if balance is greater than 0
            if (amount > 0) {
              try {
                // Get exchange rate between this token and user's currency
                const exchangeRate = await getExchangeRate(token.contract, userCurrencyAddress);

                // Calculate value in user's currency
                const value = amount * exchangeRate;

                return {
                  id: token.id.toString(),
                  name: token.name,
                  symbol: token.symbol,
                  amount: amount,
                  value: value,
                  priceChange: 0, // Placeholder for now
                  icon: token.symbol.substring(0, 1),
                  image: token.image,
                  contract: token.contract, // Store the contract address
                };
              } catch (error) {
                console.error(`Error calculating value for ${token.symbol}:`, error);
                return null;
              }
            }
            return null;
          })
        );

        // Filter out null values and tokens with zero balance
        const filteredTokens = tokensWithValues.filter(token => token !== null) as TokenType[];
        devLog.log('Filtered tokens with values:', filteredTokens);

        // Calculate total invested value across all tokens EXCEPT the user's currency
        const tokenInvestedValue = filteredTokens
          .filter(token => token.contract.toLowerCase() !== userCurrencyAddress.toLowerCase())
          .reduce((sum, token) => sum + token.value, 0);

        // Fetch NFTs owned by the user
        const userNfts = await getUserNFTs(userAddress, userCurrencyAddress);

        // Calculate total NFT value
        const nftValue = userNfts.reduce((sum, nft) => sum + nft.value, 0);

        // Set total invested value (tokens + NFTs)
        setInvestedValue(tokenInvestedValue + nftValue);

        setTokens(filteredTokens);
        setNfts(userNfts);
      } catch (error) {
        console.error('Error fetching portfolio data:', error);
        toast.error('Failed to load your portfolio data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolioData();
  }, [user, toast]);

  // Handle opening the image modal
  const handleOpenImageModal = (nft: NFTItem) => {
    setSelectedNFT(nft);
    setIsImageModalOpen(true);
  };

  // Handle opening the sell drawer
  const handleOpenSellDrawer = (nft: NFTItem) => {
    setSelectedNFT(nft);
    setIsSellDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <h1 className="  my-0 mb-2 text-3xl text-shadow-small">Portfolio</h1>
      {/* Portfolio Balance Card */}
      <Card
        className="text-white mb-6 sm:mb-0"
        style={{
          backgroundColor: '#a855f7',
          backgroundImage: 'linear-gradient(to right, #8b5cf6, #4f46e5)',
        }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Portfolio</CardTitle>
          <CardDescription className="text-purple-100">Holdings value</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">
            <Currency amount={portfolioValue} />
          </div>
          <div className="flex items-center mt-4 pt-4 border-t gap-6 border-white/20">
            <div>
              <div className="text-sm text-purple-100">Invested Value</div>
              <div className="font-medium">
                {investedValue.toFixed(2)} {userCurrencySymbol}
              </div>
            </div>
            <div className="h-10 w-px bg-white/20"></div>
            <div>
              <div className="text-sm text-purple-100 flex gap-1">
                Available <Token />
              </div>
              <div className="font-medium">
                <Currency amount={stableBalance} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tokens and NFTs Tabs */}
      <Tabs defaultValue="tokens" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tokens">Tokens ({tokens.length})</TabsTrigger>
          <TabsTrigger value="nfts">NFTs ({nfts.length})</TabsTrigger>
        </TabsList>

        {/* Tokens Tab Content */}
        <TabsContent value="tokens" className="space-y-4 mt-6">
          {tokens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tokens in your portfolio yet.
            </div>
          ) : (
            tokens.map(token => (
              <Card key={token.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center text-lg">
                        <img
                          src={token.image || '/placeholder.svg'}
                          alt={token.name}
                          style={{ width: '24px', height: '24px' }}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{token.name}</CardTitle>
                        <CardDescription>{token.symbol}</CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        <Currency amount={token.value} />
                      </div>
                      {/* <div className={`text-sm ${token.priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                                                    {token.priceChange >= 0 ? (
                                                        <ArrowUp className="inline h-3 w-3 mr-1" />
                                                        ) : (
                                                        <ArrowDown className="inline h-3 w-3 mr-1" />
                                                        )}
                                                    {Math.abs(token.priceChange)}%
                                               </div> */}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground flex justify-between">
                    Amount: {token.amount.toFixed(2)} {token.symbol}
                    <Button
                      onClick={() => redirect('/spend')}
                      variant="outline"
                      size="sm"
                      className=""
                    >
                      <Coins className="mr-2 h-4 w-4" />
                      Trade
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* NFTs Tab Content */}
        <TabsContent value="nfts" className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {nfts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No NFTs in your portfolio yet.
              </div>
            ) : (
              nfts.map(nft => (
                <Card
                  key={nft.id}
                  className="overflow-hidden transition-all duration-300 hover:shadow-lg"
                >
                  <div className="relative">
                    {nft.image ? (
                      <div className="aspect-square w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                        <img
                          src={nft.image || '/placeholder.svg'}
                          alt={nft.name}
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                        <button
                          className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white p-1.5 rounded-full hover:bg-black/80 transition-colors"
                          onClick={() => handleOpenImageModal(nft)}
                          aria-label="View full image"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="aspect-square w-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                        <ImageIcon className="h-20 w-20 text-muted-foreground opacity-50" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 bg-black/60 text-shadow-rust border-[#b74b28] border-[2px] backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium">
                      {nft.value.toFixed(2)} {userCurrencySymbol}
                    </div>
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="text-lg line-clamp-1">{nft.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <span className="line-clamp-1">{nft.collection}</span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardFooter className="flex justify-between pt-0 pb-4">
                    <div className="text-sm text-muted-foreground">Acquired {nft.acquired}</div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => handleOpenSellDrawer(nft)}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Sell
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* NFT Image Modal */}
      {selectedNFT && (
        <NFTImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          imageUrl={selectedNFT.image || ''}
          nftName={selectedNFT.name}
        />
      )}

      {/* NFT Sell Drawer */}
      {selectedNFT && (
        <NFTSellDrawer
          open={isSellDrawerOpen}
          onOpenChange={setIsSellDrawerOpen}
          nft={selectedNFT}
        />
      )}
    </div>
  );
}
