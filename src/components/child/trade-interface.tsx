import { useState, useEffect } from 'react';
import { ArrowDown, RefreshCw, Info, AlertCircle, Search } from 'lucide-react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TokenSelectorDialog } from './trade/token-selector-dialog';
import { TransactionHistory } from './trade/transaction-history';
import { PriceChart } from './trade/price-graph';
import { Currency } from '../shared/currency-symbol';
import { useAuth } from '@/contexts/authContext';
import {
  availableTokens,
  getTokenBalance,
  getRealExchangeRate,
  getExchangeRate,
} from '@/lib/tokens';
import { getKidPermissions } from '@/server/permissions';
import { executeSushiSwap } from '@/server/crypto/sushi-swap';
import { ethers } from 'ethers';
import { toast } from 'react-toastify';

function getUserWalletAddress(user: any): string | undefined {
  return user?.walletAddress || user?.address;
}

export function TradeInterface() {
  const [toToken, setToToken] = useState(availableTokens[0].contract);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [activeTab, setActiveTab] = useState('swap');
  const { user, stableBalance, refreshBalance } = useAuth();
  const [fromToken, setFromToken] = useState(
    (user as any)?.family?.currencyAddress || '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
  );
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const [showFromTokenSelector, setShowFromTokenSelector] = useState(false);
  const [showToTokenSelector, setShowToTokenSelector] = useState(false);
  const [allowedTokenSymbols, setAllowedTokenSymbols] = useState<string[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [isExecutingSwap, setIsExecutingSwap] = useState(false);

  // Fetch token balance from contract
  async function fetchTokenBalance(tokenContract: string): Promise<number> {
    const walletAddress = getUserWalletAddress(user);
    if (!tokenContract || !walletAddress) return 0;

    try {
      // Use the real getTokenBalance function from lib/tokens.ts
      const balance = await getTokenBalance(tokenContract, walletAddress);
      return balance || 0;
    } catch (error) {
      console.error(`Error fetching balance for ${tokenContract}:`, error);
      return 0;
    }
  }

  // Fetch permissions to get allowed tokens
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user?.id) return;

      try {
        setIsLoadingPermissions(true);
        const response = await getKidPermissions(user.id);

        if (response.status === 200 && response.data) {
          // If allowedTokenSymbols is empty, use default permissions logic
          let allowedSymbols = response.data.allowedTokenSymbols || [];

          // If empty after fallback, allow all tokens
          if (allowedSymbols.length === 0) {
            allowedSymbols = availableTokens.map(token => token.symbol);
          }
          let tokens = [...availableTokens];

          // Filter by allowed tokens if provided
          if (allowedTokenSymbols.length > 0) {
            tokens = tokens.filter(token => allowedTokenSymbols.includes(token.symbol));
          }
          setToToken(tokens[0].contract);
          setAllowedTokenSymbols(allowedSymbols);
        }
      } catch (error) {
        console.error('Error fetching trading permissions:', error);
        // On error, allow all tokens as fallback
        setAllowedTokenSymbols(availableTokens.map(token => token.symbol));
      } finally {
        setIsLoadingPermissions(false);
      }
    };

    fetchPermissions();
  }, [user?.id]);

  // Update exchange rate and token balances when tokens change
  useEffect(() => {
    const fetchExchangeRateAndBalances = async () => {
      const walletAddress = getUserWalletAddress(user);
      if (!fromToken || !toToken || !walletAddress) return;

      try {
        setIsLoadingRate(true);

        // Try to get real exchange rate, fallback to mock if needed
        let newRate = 0;
        try {
          newRate = await getRealExchangeRate(fromToken, toToken);
        } catch (error) {
          console.error('Error getting real exchange rate, falling back to mock:', error);
          newRate = await getExchangeRate(fromToken, toToken);
        }

        setExchangeRate(newRate);
        setLastUpdated(new Date());

        // Fetch token balances
        const [fromBalance, toBalance] = await Promise.all([
          fetchTokenBalance(fromToken),
          fetchTokenBalance(toToken),
        ]);

        setTokenBalances(prev => ({
          ...prev,
          [fromToken]: fromBalance,
          [toToken]: toBalance,
        }));
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch exchange rates or balances.');
      } finally {
        setIsLoadingRate(false);
      }
    };

    fetchExchangeRateAndBalances();
  }, [fromToken, toToken, user]);

  // Calculate output amount when input or rate changes
  useEffect(() => {
    if (fromAmount && !isNaN(Number(fromAmount)) && exchangeRate > 0) {
      const calculatedAmount = (Number(fromAmount) * exchangeRate).toFixed(6);
      setToAmount(calculatedAmount);
    } else {
      setToAmount('');
    }
  }, [fromAmount, exchangeRate]);

  // Manual refresh of exchange rates
  const refreshRate = async () => {
    const walletAddress = getUserWalletAddress(user);
    if (!fromToken || !toToken || !walletAddress) return;

    try {
      setIsLoadingRate(true);

      // Try to get real exchange rate, fallback to mock if needed
      let newRate = 0;
      try {
        newRate = await getRealExchangeRate(fromToken, toToken);
      } catch (error) {
        console.error('Error getting real exchange rate, falling back to mock:', error);
        newRate = await getExchangeRate(fromToken, toToken);
      }

      setExchangeRate(newRate);
      setLastUpdated(new Date());

      toast.info('Latest market rates have been applied.', {
        autoClose: 2000,
      });
    } catch (error) {
      console.error('Error refreshing rates:', error);
      toast.error('Failed to refresh rates.');
    } finally {
      setIsLoadingRate(false);
    }
  };

  // Execute the actual swap
  const handleSwap = async () => {
    if (!fromAmount || Number(fromAmount) <= 0 || !user?.id) return;

    const walletAddress = getUserWalletAddress(user);
    if (!walletAddress) {
      toast.error('No wallet address found.');
      return;
    }

    try {
      setIsExecutingSwap(true);

      const fromTokenObj = availableTokens.find(token => token.contract === fromToken);
      const toTokenObj = availableTokens.find(token => token.contract === toToken);

      if (!fromTokenObj || !toTokenObj) {
        toast.error('Invalid token selection.');
        return;
      }
      const exchangeRate = await getExchangeRate(toToken, user.family?.currencyAddress || '');
      //Calculate amount in stable
      const amountInStable = Number(toAmount) * exchangeRate;

      // Calculate amounts with proper decimals
      const fromAmountWei = ethers.parseUnits(
        Number(fromAmount).toFixed(fromTokenObj.decimals),
        fromTokenObj.decimals
      );

      // Apply 0.5% slippage tolerance
      const slippage = 0.005;
      const minReceiveAmount = Number(toAmount) * (1 - slippage);
      const minAmountOutWei = ethers.parseUnits(
        minReceiveAmount.toFixed(toTokenObj.decimals),
        toTokenObj.decimals
      );

      // Show a loading toast that will be updated throughout the process
      const swapToastId = toast.loading('Preparing swap...');

      // Update toast with progress
      toast.update(swapToastId, {
        render: 'Swapping...',
        isLoading: true,
      });

      console.log('amount in stable', amountInStable);
      // Execute the swap using Sushi swap
      const result = await executeSushiSwap(
        user.id,
        fromToken,
        toToken,
        fromAmountWei,
        minAmountOutWei,
        fromTokenObj.symbol,
        toTokenObj.symbol,
        true,
        amountInStable
      );

      if (result.success) {
        // Update the toast with success message
        toast.update(swapToastId, {
          render: `Successfully swapped ${fromAmount} ${fromTokenObj.symbol} for approximately ${Number(toAmount).toFixed(6)} ${toTokenObj.symbol}`,
          type: 'success',
          isLoading: false,
          autoClose: 5000,
        });

        // Reset form
        setFromAmount('');
        setToAmount('');

        // Refresh balances
        const [newFromBalance, newToBalance] = await Promise.all([
          fetchTokenBalance(fromToken),
          fetchTokenBalance(toToken),
        ]);

        setTokenBalances(prev => ({
          ...prev,
          [fromToken]: newFromBalance,
          [toToken]: newToBalance,
        }));

        // Switch to history tab to show the new transaction
        setActiveTab('history');
      } else {
        // Update the toast with error message
        toast.update(swapToastId, {
          render: result.message || 'Swap failed. Please try again.',
          type: 'error',
          isLoading: false,
          autoClose: 5000,
        });
      }
    } catch (error) {
      console.error('Error executing swap:', error);
      // Show error toast
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      refreshBalance();
      setIsExecutingSwap(false);
    }
  };

  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numeric values with up to one decimal point
    if (/^(\d*\.?\d*)$/.test(value) || value === '') {
      setFromAmount(value);
    }
  };

  const handleTokenSwap = () => {
    // Swap token selections
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);

    // Clear amounts
    setFromAmount('');
    setToAmount('');
  };

  // Format balance based on token
  const formatBalance = (amount: number, tokenContract: string) => {
    if (amount === 0) return '0.00';

    const token = availableTokens.find(t => t.contract === tokenContract);
    if (!token) return amount.toString();

    if (amount < 0.001) {
      return '< 0.001';
    } else if (amount < 1) {
      return amount.toFixed(6);
    } else if (amount < 1000) {
      return amount.toFixed(4);
    } else {
      return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Your Balance</CardTitle>
          <CardDescription className="text-purple-100">Available to spend</CardDescription>
        </CardHeader>
        <CardContent>
          <Currency className="text-4xl font-bold" amount={stableBalance} />
        </CardContent>
      </Card>
      <Tabs defaultValue="swap" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="swap">Swap</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="swap" className="space-y-4 pt-4 animate-in fade-in-50">
          <Card>
            <CardContent className="space-y-6 pt-6">
              {/* Price Chart */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">
                    {availableTokens.find(t => t.contract === fromToken)?.symbol || ''} →{' '}
                    {availableTokens.find(t => t.contract === toToken)?.symbol || ''} Rate
                  </h3>
                </div>
                <PriceChart fromToken={fromToken} toToken={toToken} currentRate={exchangeRate} />
              </div>

              <Card className="space-y-4 p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>From</Label>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      Balance:{' '}
                      <p className="text-sm">
                        {formatBalance(tokenBalances[fromToken] || 0, fromToken)}
                      </p>
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-shrink-0 w-[120px] justify-between"
                      onClick={() => setShowFromTokenSelector(true)}
                      disabled={isLoadingPermissions}
                    >
                      {isLoadingPermissions ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                          <span>Loading</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <div className="w-5 h-5 mr-2 rounded-full overflow-hidden">
                              <img
                                src={
                                  availableTokens.find(t => t.contract === fromToken)?.image ||
                                  '/placeholder.svg'
                                }
                                alt="token"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span>
                              {availableTokens.find(t => t.contract === fromToken)?.symbol ||
                                'Select'}
                            </span>
                          </div>
                        </>
                      )}
                    </Button>
                    <div className="relative flex-1">
                      <Input
                        type="text"
                        placeholder="0.00"
                        value={fromAmount}
                        onChange={handleFromAmountChange}
                        className="pr-16"
                        disabled={isExecutingSwap}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs font-normal text-primary"
                        onClick={() =>
                          setFromAmount((tokenBalances[fromToken] * 0.999 || 0).toString())
                        }
                        disabled={isExecutingSwap}
                      >
                        MAX
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center my-2">
                  <Button
                    size="icon"
                    className="border-2 rounded-full p-2 hover:scale-110"
                    onClick={handleTokenSwap}
                    disabled={isExecutingSwap || isLoadingRate}
                  >
                    <ArrowDown className="h-4 w-4 text-primary" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>To</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-shrink-0 w-[120px] justify-between"
                      onClick={() => setShowToTokenSelector(true)}
                      disabled={isLoadingPermissions}
                    >
                      {isLoadingPermissions ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                          <span>Loading</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <div className="w-5 h-5 mr-2 rounded-full overflow-hidden">
                              <img
                                src={
                                  availableTokens.find(t => t.contract === toToken)?.image ||
                                  '/placeholder.svg'
                                }
                                alt="token"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span>
                              {availableTokens.find(t => t.contract === toToken)?.symbol ||
                                'Select'}
                            </span>
                          </div>
                        </>
                      )}
                    </Button>
                    <Input
                      type="text"
                      placeholder="0.00"
                      value={toAmount}
                      readOnly
                      disabled={isExecutingSwap}
                    />
                  </div>
                </div>
              </Card>

              <div className="bg-card/50 p-4 rounded-lg space-y-2 border-2">
                <div className="flex justify-between text-sm items-center">
                  <div className="flex items-center">
                    <span>Exchange Rate</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 ml-1">
                            <Info className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">The current market rate for this pair</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span>
                    1 {availableTokens.find(t => t.contract === fromToken)?.symbol || ''} ={' '}
                    {exchangeRate.toFixed(6)}{' '}
                    {availableTokens.find(t => t.contract === toToken)?.symbol || ''}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Fee 2%</span>
                  <span className="text-emerald-500 dark:text-emerald-400">
                    ~{(Number(toAmount) * 0.02).toFixed(4)}{' '}
                    {availableTokens.find(t => t.contract === toToken)?.symbol || ''}
                  </span>
                </div>
                <div className="flex justify-between font-medium border-t border-border/50 pt-2 mt-2">
                  <span>You will receive</span>
                  <span>
                    {(Number(toAmount) * 0.98).toFixed(4)}{' '}
                    {availableTokens.find(t => t.contract === toToken)?.symbol || ''}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex-col gap-3">
              <Button
                className="w-full"
                variant="outline"
                disabled={
                  !fromAmount ||
                  Number(fromAmount) <= 0 ||
                  Number(fromAmount) > (tokenBalances[fromToken] || 0) ||
                  isExecutingSwap ||
                  isLoadingRate
                }
                onClick={handleSwap}
              >
                {isExecutingSwap ? 'Swapping...' : 'Swap Now'}
              </Button>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 flex items-center gap-1"
                  onClick={refreshRate}
                  disabled={isLoadingRate}
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingRate ? 'animate-spin' : ''}`} />
                  <span>
                    {isLoadingRate
                      ? 'Updating...'
                      : `Updated ${Math.floor((new Date().getTime() - lastUpdated.getTime()) / 60000)} min ago`}
                  </span>
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="pt-4 animate-in fade-in-50">
          <TransactionHistory />
        </TabsContent>
      </Tabs>

      {/* Token Selector Dialogs */}
      <TokenSelectorDialog
        open={showFromTokenSelector}
        onOpenChange={setShowFromTokenSelector}
        onSelect={setFromToken}
        currentToken={fromToken}
        allowedTokenSymbols={allowedTokenSymbols}
      />

      <TokenSelectorDialog
        open={showToTokenSelector}
        onOpenChange={setShowToTokenSelector}
        onSelect={setToToken}
        currentToken={toToken}
        allowedTokenSymbols={allowedTokenSymbols}
      />
    </div>
  );
}
