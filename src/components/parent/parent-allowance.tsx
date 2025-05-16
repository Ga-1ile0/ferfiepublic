'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/authContext';
import { SetAllowanceDialog } from '@/components/dialogs/set-allowance-dialog';
import { getChildrenAllowances } from '@/server/allowance';
import { getChildAllowanceTransactions } from '@/server/allowanceTransactions';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
export function ParentAllowance() {
  const [showSetAllowance, setShowSetAllowance] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [childrenWithAllowances, setChildrenWithAllowances] = useState<any[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const { user, children, refreshChildren } = useAuth();

  // Fetch children allowances when component mounts or children change
  useEffect(() => {
    const fetchAllowances = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const result = await getChildrenAllowances(user.id);
        if (result.status === 200 && result.data) {
          setChildrenWithAllowances(result.data);
        } else {
          toast.error(result.message || 'Failed to load allowances');
        }
      } catch (error) {
        console.error('Error fetching allowances:', error);
        toast.error('Failed to load allowances');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllowances();
  }, [user, children, toast]);

  // Fetch transaction history for all children
  useEffect(() => {
    const fetchTransactionHistory = async () => {
      if (!user?.id || !children || children.length === 0) return;

      setIsLoadingHistory(true);
      try {
        // Create an array to hold all transactions
        let allTransactions: any[] = [];

        // Fetch transactions for each child
        for (const child of children) {
          const result = await getChildAllowanceTransactions(child.id);
          if (result.status === 200 && result.data) {
            // Add child name to each transaction for display purposes
            const childTransactions = result.data.map((tx: any) => ({
              ...tx,
              childName: child.name || 'Unnamed Child',
            }));
            allTransactions = [...allTransactions, ...childTransactions];
          }
        }

        // Sort transactions by date (newest first)
        allTransactions.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setTransactionHistory(allTransactions);
      } catch (error) {
        console.error('Error fetching transaction history:', error);
        toast.error('Failed to load transaction history');
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchTransactionHistory();
  }, [user, children, toast]);

  // Format frequency for display
  const formatFrequency = (frequency: string, dayOfWeek?: number, dayOfMonth?: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    switch (frequency) {
      case 'DAILY':
        return 'Daily';
      case 'WEEKLY':
        return `Weekly (${dayOfWeek !== undefined ? days[dayOfWeek] : 'Monday'})`;
      case 'MONTHLY':
        return `Monthly (Day ${dayOfMonth || 1})`;
      default:
        return frequency;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <Tabs defaultValue="set" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="set">Set Allowance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="set" className="space-y-4 pt-4">
          <SetAllowanceDialog open={showSetAllowance} onOpenChange={setShowSetAllowance} />
          <Card>
            <CardHeader>
              <CardTitle>Current Allowances</CardTitle>
              <CardDescription>Active recurring allowances for your children</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : childrenWithAllowances.length > 0 ? (
                <div className="space-y-4">
                  {childrenWithAllowances.map(child => (
                    <div
                      key={child.id}
                      className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <div className="font-medium">{child.name || 'Unnamed Child'}</div>
                        {child.allowances && child.allowances.length > 0 ? (
                          <>
                            <div className="text-xs text-muted-foreground">
                              {formatFrequency(
                                child.allowances[0].frequency,
                                child.allowances[0].dayOfWeek,
                                child.allowances[0].dayOfMonth
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Next: {format(new Date(child.allowances[0].nextDate), 'MMM d, yyyy')}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">No allowance set</div>
                        )}
                      </div>
                      <div className="text-right">
                        {child.allowances && child.allowances.length > 0 ? (
                          <>
                            <div className="font-medium">
                              ${child.allowances[0].amount.toFixed(2)}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-1"
                              onClick={() => {
                                setShowSetAllowance(true);
                              }}
                            >
                              Edit
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowSetAllowance(true);
                            }}
                          >
                            Set Allowance
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    No children found or no allowances set
                  </p>
                  <Button onClick={() => setShowSetAllowance(true)}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Set Allowance
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Allowance History</CardTitle>
              <CardDescription>Past allowance payments</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : transactionHistory.length > 0 ? (
                <div className="space-y-4">
                  {transactionHistory.map(transaction => (
                    <div
                      key={transaction.id}
                      className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <div className="font-medium">{transaction.childName}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(transaction.createdAt), 'MMM d, yyyy')}
                        </div>
                        {transaction.hash && (
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                            Tx: {transaction.hash.substring(0, 8)}...
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${transaction.amount.toFixed(2)}</div>
                        <div className="text-xs text-green-600">
                          {transaction.hash ? 'Completed' : 'Pending'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No allowance transactions found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
