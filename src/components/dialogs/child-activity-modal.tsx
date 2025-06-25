'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Gift,
  DollarSign,
  ExternalLink,
  ShoppingCart,
  Gem,
  RefreshCw,
  Send,
  Shield,
  Activity,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getChildTransactions } from '@/server/transaction';
import { getKidPermissions } from '@/server/permissions';
import { getDailySpendingLimits } from '@/server/permissions';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { TransactionType } from '@prisma/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Currency } from '@/components/shared/currency-symbol';
import { Progress } from '@/components/ui/progress';

interface ChildActivityModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string | null;
  childName: string;
}

export function ChildActivityModal({
  isOpen,
  onOpenChange,
  childId,
  childName,
}: ChildActivityModalProps) {
  const [activeTab, setActiveTab] = useState<string>('activity');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any>(null);
  const [spendingSummary, setSpendingSummary] = useState<any>(null);
  const [spendingLoading, setSpendingLoading] = useState<boolean>(false);
  const pageSize = 10;

  // Fetch data when the dialog opens or page changes
  useEffect(() => {
    if (isOpen && childId) {
      if (activeTab === 'activity') {
        fetchTransactions();
      } else if (activeTab === 'spending') {
        fetchSpendingData();
      }
    }
  }, [isOpen, childId, currentPage, activeTab]);

  const fetchTransactions = async () => {
    if (!childId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getChildTransactions(childId, currentPage, pageSize);

      if (response.status === 200 && response.data) {
        setTransactions(response.data.transactions);
        setTotalPages(response.data.pagination.totalPages);
      } else {
        throw new Error(response.message || 'Failed to fetch transactions');
      }
    } catch (error) {
      console.error('Error fetching child transactions:', error);
      setError('Failed to load activity. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSpendingData = async () => {
    if (!childId) return;

    setSpendingLoading(true);
    setError(null);

    try {
      const [permissionsResponse, limitsResponse] = await Promise.all([
        getKidPermissions(childId),
        getDailySpendingLimits(childId),
      ]);

      if (permissionsResponse.status === 200) {
        setPermissions(permissionsResponse.data);
      }

      if (limitsResponse.success && limitsResponse.data) {
        setSpendingSummary(limitsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching spending data:', error);
      setError('Failed to load spending data. Please try again.');
    } finally {
      setSpendingLoading(false);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Get the appropriate icon and color for each transaction type
  const getTransactionDetails = (type: TransactionType) => {
    switch (type) {
      case 'ALLOWANCE':
        return {
          icon: <DollarSign className="h-4 w-4" />,
          color: 'bg-green-100 text-green-800',
          label: 'Allowance',
        };
      case 'CHORE_REWARD':
        return {
          icon: <Gift className="h-4 w-4" />,
          color: 'bg-blue-100 text-blue-800',
          label: 'Chore Reward',
        };
      case 'GIFT_CARD_PURCHASE':
        return {
          icon: <ShoppingCart className="h-4 w-4" />,
          color: 'bg-purple-100 text-purple-800',
          label: 'Gift Card',
        };
      case 'TOKEN_TRADE':
        return {
          icon: <RefreshCw className="h-4 w-4" />,
          color: 'bg-amber-100 text-amber-800',
          label: 'Token Trade',
        };
      case 'NFT_TRADE':
        return {
          icon: <Gem className="h-4 w-4" />,
          color: 'bg-indigo-100 text-indigo-800',
          label: 'NFT Trade',
        };
      case 'TOKEN_TRANSFER':
        return {
          icon: <Send className="h-4 w-4" />,
          color: 'bg-amber-100 text-amber-800',
          label: 'Token Transfer',
        };
      default:
        return {
          icon: <ExternalLink className="h-4 w-4" />,
          color: 'bg-gray-100 text-gray-800',
          label: 'Transaction',
        };
    }
  };

  const renderSpendingLimits = () => {
    if (spendingLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      );
    }

    if (!spendingSummary) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-4" />
          <p>No spending data available</p>
        </div>
      );
    }

    const allCategories = [
      {
        label: 'Daily Trading Limit',
        limit: spendingSummary.dailyTradingLimit,
        spent: spendingSummary.spentToday?.tradingSpent || 0,
        remaining: spendingSummary.remainingLimits?.trading || 0,
        icon: <RefreshCw className="h-4 w-4" />,
        color: 'bg-amber-100 text-amber-800',
      },
      {
        label: 'Daily Transfer Limit',
        limit: spendingSummary.dailyTransferLimit,
        spent: spendingSummary.spentToday?.transferSpent || 0,
        remaining: spendingSummary.remainingLimits?.transfer || 0,
        icon: <Send className="h-4 w-4" />,
        color: 'bg-blue-100 text-blue-800',
      },
      {
        label: 'Daily NFT Limit',
        limit: spendingSummary.dailyNftLimit,
        spent: spendingSummary.spentToday?.nftSpent || 0,
        remaining: spendingSummary.remainingLimits?.nft || 0,
        icon: <DollarSign className="h-4 w-4" />,
        color: 'bg-green-100 text-green-800',
      },
    ];

    const limits = allCategories.filter(
      item => item.limit !== null && item.limit !== undefined && item.limit > 0
    );
    const unlimitedCategories = allCategories.filter(item => item.limit === 0);

    if (limits.length === 0 && unlimitedCategories.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-4" />
          <p>No spending data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Limited Categories */}
        {limits.map((item, index) => {
          const percentage = item.limit ? Math.min((item.spent / item.limit) * 100, 100) : 0;
          const isOverLimit = item.spent > (item.limit || 0);

          return (
            <div key={`limited-${index}`} className="space-y-2 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={item.color}>
                    {item.icon}
                    <span className="ml-1">{item.label}</span>
                  </Badge>
                </div>
                <div className="text-sm gap-1 flex">
                  <Currency amount={item.spent} /> / <Currency amount={item.limit || 0} />
                </div>
              </div>
              <Progress value={percentage} className={`h-2 ${isOverLimit ? 'bg-red-100' : ''}`} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{percentage.toFixed(1)}% used</span>
                <span className={isOverLimit ? 'text-red-600 font-medium' : 'flex gap-1'}>
                  {isOverLimit ? (
                    'Over limit!'
                  ) : (
                    <>
                      <Currency amount={item.remaining} /> remaining
                    </>
                  )}
                </span>
              </div>
            </div>
          );
        })}

        {/* Unlimited Categories */}
        {unlimitedCategories.map((item, index) => (
          <div
            key={`unlimited-${index}`}
            className="space-y-2 p-3 rounded-lg border border-green-200 bg-green-50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {item.icon}
                  <span className="ml-1">{item.label}</span>
                </Badge>
                <Badge variant="secondary" className="bg-green-200 text-green-800">
                  Unlimited
                </Badge>
              </div>
              <div className="text-sm font-medium text-green-700">
                <Currency amount={item.spent} /> spent
              </div>
            </div>
            <div className="text-xs text-green-600">No spending limit set for this category</div>
          </div>
        ))}

        {/* Show message if all categories are unlimited */}
        {limits.length === 0 && unlimitedCategories.length > 0 && (
          <div className="text-center py-4 text-green-600 bg-green-50 rounded-lg border border-green-200">
            <Shield className="h-8 w-8 mx-auto mb-2" />
            <p className="font-medium">All spending categories are unlimited</p>
            <p className="text-sm mt-1">This child can spend without restrictions</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-xl w-[95vw] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {childName}'s Overview
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="spending" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Spending
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4">
            <div className="min-h-[350px] max-h-[500px] w-full">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-md border">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <AlertTriangle className="h-10 w-10 mb-4 text-amber-500" />
                  <p>{error}</p>
                  <Button variant="outline" className="mt-4" onClick={fetchTransactions}>
                    Try Again
                  </Button>
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <p>No activity found for this child.</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4 max-w-[calc(100%-8px)]">
                    {transactions.map(transaction => {
                      const { icon, color, label } = getTransactionDetails(transaction.type);
                      const date = new Date(transaction.createdAt);

                      return (
                        <div
                          key={transaction.id}
                          className="p-3 rounded-md border hover:bg-muted/50 transition-colors w-full"
                          style={{ maxWidth: 'calc(100% - 8px)', boxSizing: 'border-box' }}
                        >
                          <div className="w-full">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <Badge variant="outline" className={`${color} flex-shrink-0`}>
                                <span className="flex items-center">
                                  {icon}
                                  <span className="ml-1">{label}</span>
                                </span>
                              </Badge>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatDistanceToNow(date, { addSuffix: true })}
                              </span>
                              <span className="ml-auto font-medium flex-shrink-0">
                                <Currency amount={transaction.amount} />
                              </span>
                            </div>

                            <p className="text-sm break-words whitespace-normal">
                              {transaction.description || `${label} transaction`}
                            </p>

                            {transaction.hash && (
                              <div className="flex items-center text-xs text-muted-foreground mt-1">
                                <span className="mr-1 flex-shrink-0">TX:</span>
                                <span className="truncate max-w-[200px]">
                                  {transaction.hash.substring(0, 10)}...
                                  {transaction.hash.substring(transaction.hash.length - 8)}
                                </span>
                                <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                              </div>
                            )}

                            <div className="text-xs text-muted-foreground mt-1">
                              {format(date, 'PPP p')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            {!isLoading && !error && transactions.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || isLoading}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages || isLoading}
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="spending" className="mt-4">
            <div className="min-h-[350px] max-h-[500px] w-full">
              <ScrollArea className="h-[400px]">{renderSpendingLimits()}</ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
