'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Gift,
  ListChecks,
  Loader2,
  PiggyBank,
  BarChart3,
  ShoppingBag,
  Calendar,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { useAuth } from '@/contexts/authContext';
import { useState, useEffect } from 'react';
import { getChoresByChildId } from '@/server/chores';
import { getUserTransactions } from '@/server/transaction';
import { Currency, Symbol } from '@/components/shared/currency-symbol';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { getChildAllowance } from '@/server/allowance';
import { claimAllowance } from '@/server/allowanceTransactions';
import { toast } from 'react-toastify';
import { getKidPermissions } from '@/server/permissions';
import { getUserAddress } from '@/server/crypto/transfer';
import CryptoTransfer from './send-crypto';
import { devLog } from '@/lib/devlog';

type Chore = {
  id: string;
  title: string;
  description?: string;
  reward: number;
  dueDate?: Date;
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'COMPLETED' | 'REJECTED' | 'EXPIRED';
  createdAt?: Date;
};

type Transaction = {
  id: string;
  amount: number;
  type: string;
  description?: string;
  createdAt: Date;
};

export function KidDashboard() {
  const { user, stableBalance, refreshBalance } = useAuth();
  const [activeChores, setActiveChores] = useState<Chore[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [allowance, setAllowance] = useState<any>(null);
  const [isAllowanceClaimable, setIsAllowanceClaimable] = useState(false);
  const [isClaimingAllowance, setIsClaimingAllowance] = useState(false);

  // Wallet address and permissions state
  const [walletAddress, setWalletAddress] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);
  const [cryptoTransferEnabled, setCryptoTransferEnabled] = useState(false);

  // Fetch family currency, allowance, and chores when component mounts
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;

      try {
        // Fetch chores
        const choresResponse = await getChoresByChildId(user.id);
        //@ts-ignore
        if (choresResponse.status === 200 && choresResponse.data) {
          // Filter for active chores and mark expired ones
          const now = new Date();
          //@ts-ignore
          const active = choresResponse.data
            .map((chore: Chore) => {
              // Check if chore is expired (past due date and still active)
              if (chore.status === 'ACTIVE' && chore.dueDate && isPast(new Date(chore.dueDate))) {
                return { ...chore, status: 'EXPIRED' };
              }
              return chore;
            })

            .filter((chore: Chore) => chore.status === 'ACTIVE');

          setActiveChores(active);
        }

        // Fetch allowance
        const allowanceResponse = await getChildAllowance(user.id);
        if (allowanceResponse.status === 200 && allowanceResponse.data) {
          setAllowance(allowanceResponse.data);

          // Check if allowance is claimable (current date >= nextDate)
          const now = new Date();
          const nextDate = new Date(allowanceResponse.data.nextDate);
          setIsAllowanceClaimable(now >= nextDate);
        }

        // Fetch wallet address
        const address = await getUserAddress(user.id);
        if (address) {
          setWalletAddress(address);
        }

        // Fetch permissions to check if crypto transfers are enabled
        const permissionsResponse = await getKidPermissions(user.id);
        if (permissionsResponse.data) {
          devLog.log('permissions', permissionsResponse.data);
          setCryptoTransferEnabled(permissionsResponse.data.cryptoTransferEnabled === true);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
        setIsLoadingAddress(false);
      }
    };

    fetchData();
  }, [user]);

  // Handle claiming allowance
  const handleClaimAllowance = async () => {
    if (!user?.id || !isAllowanceClaimable || isClaimingAllowance) return;

    setIsClaimingAllowance(true);
    try {
      const result = await claimAllowance(user.id);

      if (result.status === 200) {
        toast.success('Your allowance has been claimed successfully.');

        // Refresh allowance data and balance
        const allowanceResponse = await getChildAllowance(user.id);
        if (allowanceResponse.status === 200 && allowanceResponse.data) {
          setAllowance(allowanceResponse.data);
          setIsAllowanceClaimable(false);
        }

        // Refresh transactions
        fetchTransactions();

        // Refresh balance
        if (refreshBalance) refreshBalance();
      } else {
        toast.error(result.message || 'Failed to claim allowance');
      }
    } catch (error) {
      console.error('Error claiming allowance:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsClaimingAllowance(false);
    }
  };

  // Fetch user transactions
  const fetchTransactions = async () => {
    if (!user?.id) return;

    try {
      setIsLoadingTransactions(true);
      const response = await getUserTransactions(user.id, 10); // Get last 10 transactions

      if (response.status === 200 && response.data) {
        //@ts-ignore
        setTransactions(response.data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  // Format address for display
  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Handle copying address to clipboard
  const handleCopyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success('Address copied to clipboard');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-3xl text-shadow-small my-0 mb-2">Hey {user?.name || 'there'}!</h1>

      <Card
        className="text-white mb-6 sm:mb-0"
        style={{
          backgroundColor: '#a855f7',
          backgroundImage: 'linear-gradient(to right, #8b5cf6, #4f46e5)',
        }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            Your Balance <CryptoTransfer className="w-full" />
          </CardTitle>
          <CardDescription className="text-purple-100">Available to spend</CardDescription>
        </CardHeader>
        <CardContent>
          <Currency className="text-4xl" amount={stableBalance} />
          {allowance && (
            <div className="mt-3">
              {isAllowanceClaimable ? (
                <Button
                  onClick={handleClaimAllowance}
                  disabled={isClaimingAllowance}
                  className="bg-white/20 hover:bg-white/30 text-white border-0 w-full mt-2"
                >
                  {isClaimingAllowance ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Gift className="mr-2 h-4 w-4" />
                      Claim <Symbol />
                      {allowance.amount.toFixed(2)} Allowance
                    </>
                  )}
                </Button>
              ) : (
                <div className="text-sm mt-1 text-purple-100 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>
                    Next allowance: {format(new Date(allowance.nextDate), 'MMM d')} (
                    {formatDistanceToNow(new Date(allowance.nextDate), { addSuffix: true })})
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:-mt-6">
        {/* Earn Card */}
        <Link href="/earn" className="hidden sm:block group">
          <Card className=" border-green-200 dark:border-green-800 shadow-green-200 dark:shadow-green-800 h-full transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <PiggyBank className="h-5 w-5 mr-2 text-green-500" />
                Earn
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">Complete tasks and earn rewards</p>
              <Button variant="outline" className="w-full" size="sm">
                Start Earning
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        {/* Portfolio Card */}
        <Link href="/portfolio" className="hidden sm:block group">
          <Card className=" border-purple-200 dark:border-purple-800 shadow-purple-200 dark:shadow-purple-800 h-full transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-purple-500" />
                Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">Track your savings and growth</p>
              <Button variant="outline" className="w-full " size="sm">
                View Portfolio
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        {/* Spend Card */}
        <Link href="/spend" className="hidden sm:block group">
          <Card className=" border-red-200 dark:border-red-800 shadow-red-200 dark:shadow-red-800 h-full transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <ShoppingBag className="h-5 w-5 mr-2 text-red-500" />
                Spend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4">Spend your money </p>
              <Button variant="outline" className="w-full " size="sm">
                Go Spending
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Chores & Rewards</CardTitle>
            <CardDescription>Complete tasks to earn more</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Loading chores...</span>
              </div>
            ) : activeChores.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No active chores. Check back later!
              </div>
            ) : (
              activeChores.slice(0, 3).map((chore, index) => {
                // Calculate progress based on due date
                const progress = chore.dueDate
                  ? (() => {
                      const now = new Date();
                      const due = new Date(chore.dueDate);
                      const createdDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Assume created a week ago

                      const totalTime = due.getTime() - createdDate.getTime();
                      const elapsedTime = now.getTime() - createdDate.getTime();

                      if (elapsedTime <= 0) return 0;
                      if (elapsedTime >= totalTime) return 100;

                      return Math.round((elapsedTime / totalTime) * 100);
                    })()
                  : 0;

                // Format due date
                const formatDueDate = (date?: Date) => {
                  if (!date) return 'No due date';

                  const dueDate = new Date(date);
                  const today = new Date();
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);

                  if (dueDate.toDateString() === today.toDateString()) {
                    return 'Today';
                  } else if (dueDate.toDateString() === tomorrow.toDateString()) {
                    return 'Tomorrow';
                  } else {
                    return format(dueDate, 'MMM d');
                  }
                };

                return (
                  <div key={chore.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{chore.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Due: {formatDueDate(chore.dueDate)}
                        </div>
                      </div>
                      <Currency
                        amount={chore.reward}
                        className="font-medium text-green-600 dark:text-green-400"
                      />
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                );
              })
            )}
            <Link href="/earn">
              <Button
                variant="outline"
                className="w-full mt-2 hover:bg-secondary/80 transition-colors"
              >
                <ListChecks className="mr-2 h-4 w-4" />
                View All Chores
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your latest transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoadingTransactions ? (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Loading transactions...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No recent transactions found.
              </div>
            ) : (
              transactions.map(transaction => {
                // Format transaction date
                const formatTransactionDate = (date: Date) => {
                  const txDate = new Date(date);
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);

                  if (txDate.toDateString() === today.toDateString()) {
                    return `Today, ${format(txDate, 'h:mm a')}`;
                  } else if (txDate.toDateString() === yesterday.toDateString()) {
                    return `Yesterday, ${format(txDate, 'h:mm a')}`;
                  } else {
                    return format(txDate, 'MMM d, h:mm a');
                  }
                };

                // Determine if amount is positive or negative
                const isPositive = ['ALLOWANCE', 'CHORE_REWARD', 'DEPOSIT'].includes(
                  transaction.type
                );
                const amountPrefix = isPositive ? '+' : '-';
                const amountValue = Math.abs(transaction.amount);

                return (
                  <div
                    key={transaction.id}
                    className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="font-medium">
                        {transaction.description || transaction.type}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatTransactionDate(transaction.createdAt)}
                      </div>
                    </div>
                    <div
                      className={`font-medium flex ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                    >
                      {amountPrefix}
                      <Symbol /> {amountValue}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
