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
import { ArrowDown, CheckCircle, Clock, Calendar, DollarSign, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/authContext';
import { getChildAllowance } from '@/server/allowance';
import { getChoresByChildId, completeChore } from '@/server/chores';
import { format, differenceInCalendarDays } from 'date-fns';
import { toast } from 'react-toastify';
import { Currency, Symbol } from '@/components/shared/currency-symbol';
import { CompleteChoreDialog } from '@/components/dialogs/complete-chore-dialog';
import { getChildAllowanceTransactions } from '@/server/allowanceTransactions';
import { Chore } from '../../types';

export function KidEarn() {
  // Allowance state
  const [allowance, setAllowance] = useState<any>(null);
  const [allowanceTransactions, setAllowanceTransactions] = useState<any[]>([]);

  // Chores state
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [activeChores, setActiveChores] = useState<Chore[]>([]);
  const [pendingChores, setPendingChores] = useState<Chore[]>([]);
  const [completedChores, setCompletedChores] = useState<Chore[]>([]);

  // Shared state
  const [isLoading, setIsLoading] = useState(true);
  const { user, stableBalance } = useAuth();

  // Fetch allowance data
  const fetchAllowance = async () => {
    if (!user?.id) return;

    try {
      const result = await getChildAllowance(user.id);

      if (result.status === 200 && result.data) {
        setAllowance(result.data);

        // Fetch real allowance transactions instead of creating mock data
        const transactionsResult = await getChildAllowanceTransactions(user.id);
        if (transactionsResult.status === 200 && transactionsResult.data) {
          // Format the real transaction data
          const formattedTransactions = transactionsResult.data.map(transaction => ({
            amount: transaction.amount.toFixed(2),
            date: format(new Date(transaction.createdAt), 'MMM d, yyyy'),
            time: format(new Date(transaction.createdAt), 'h:mm a'),
            description: transaction.description || 'Allowance payment',
          }));

          setAllowanceTransactions(formattedTransactions);
        }
      }
    } catch (error) {
      console.error('Error fetching allowance:', error);
      toast.error('Failed to load your allowance information');
    }
  };

  // Fetch chores data
  const fetchChores = async () => {
    if (!user?.id) return;

    try {
      const response = await getChoresByChildId(user.id);

      //@ts-ignore
      if (response.status === 200 && response.data) {
        // Filter chores by status
        //@ts-ignore
        const active = response.data.filter(chore => chore.status === 'ACTIVE');
        //@ts-ignore
        const pending = response.data.filter(chore => chore.status === 'PENDING_APPROVAL');
        //@ts-ignore
        const completed = response.data.filter(chore => chore.status === 'COMPLETED');

        setActiveChores(active);
        setPendingChores(pending);
        setCompletedChores(completed);
      }
    } catch (error) {
      console.error('Error fetching chores:', error);
      toast.error('Failed to load chores');
    }
  };

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      await Promise.all([fetchAllowance(), fetchChores()]);
      setIsLoading(false);
    };

    fetchData();
  }, [user]);

  // Handle marking a chore as complete
  const handleMarkComplete = (chore: Chore) => {
    setSelectedChore(chore);
    setShowCompleteDialog(true);
  };

  // Handle chore completion submission
  const handleChoreCompleted = async (choreId: string, evidence?: string) => {
    if (!user?.id) return;

    try {
      const result = await completeChore({
        id: choreId,
        evidence,
        childId: user.id,
      });

      if (result.status === 200) {
        toast.success('Your chore has been submitted for approval');
        fetchChores(); // Refresh the chores list
      } else {
        toast.error(result.message || 'Failed to submit chore');
      }
    } catch (error) {
      console.error('Error completing chore:', error);
      toast.error('An unexpected error occurred');
    }
  };

  // Calculate days until next allowance
  const getDaysUntilNextAllowance = () => {
    if (!allowance?.nextDate) return 0;

    const today = new Date();
    const nextDate = new Date(allowance.nextDate);
    return Math.max(0, differenceInCalendarDays(nextDate, today));
  };

  // Calculate progress for the progress bar
  const getProgressValue = () => {
    if (!allowance) return 0;

    const daysUntil = getDaysUntilNextAllowance();
    let totalDays = 1; // Default to avoid division by zero

    if (allowance.frequency === 'DAILY') {
      totalDays = 1;
    } else if (allowance.frequency === 'WEEKLY') {
      totalDays = 7;
    } else if (allowance.frequency === 'MONTHLY') {
      // Approximate
      totalDays = 30;
    }

    // Calculate progress (days passed / total days) * 100
    return Math.max(0, Math.min(100, ((totalDays - daysUntil) / totalDays) * 100));
  };

  // Format the frequency for display
  const formatFrequency = () => {
    if (!allowance) return '';

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    switch (allowance.frequency) {
      case 'DAILY':
        return 'Every day';
      case 'WEEKLY':
        return `Every ${allowance.dayOfWeek !== null ? days[allowance.dayOfWeek] : 'Monday'}`;
      case 'MONTHLY':
        return `Monthly (Day ${allowance.dayOfMonth || 1})`;
      default:
        return '';
    }
  };

  // Format due date for chores
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
      return format(dueDate, 'MMM d, yyyy');
    }
  };

  // Format completed date for chores
  const formatCompletedDate = (date?: Date) => {
    if (!date) return '';
    return format(new Date(date), 'MMM d, yyyy');
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
      <h1 className=" my-0 mb-2 text-3xl text-shadow-small">Earn</h1>
      {/* Main Tabs */}
      <Tabs defaultValue="chores" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chores">Chores</TabsTrigger>
          <TabsTrigger value="allowance">Allowance</TabsTrigger>
        </TabsList>

        {/* Allowance Tab Content */}
        <TabsContent value="allowance" className="space-y-4 mt-6">
          {/* Balance Card */}
          <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Your Balance</CardTitle>
              <CardDescription className="text-purple-100">Available to spend</CardDescription>
            </CardHeader>
            <CardContent>
              <Currency className="text-4xl font-bold" amount={stableBalance} />
              {allowance && (
                <div className="flex items-center mt-2 text-purple-100">
                  <ArrowDown className="h-4 w-4 mr-1" />
                  <span>
                    Next allowance in {getDaysUntilNextAllowance()} day
                    {getDaysUntilNextAllowance() !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {allowance ? (
            <Card>
              <CardHeader>
                <CardTitle>Allowance Schedule</CardTitle>
                <CardDescription>Your recurring allowance details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {allowance.frequency.charAt(0) + allowance.frequency.slice(1).toLowerCase()}{' '}
                      Allowance
                    </div>
                    <div className="text-sm text-muted-foreground">{formatFrequency()}</div>
                  </div>
                  <div className="font-medium">${allowance.amount.toFixed(2)}</div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Next allowance</span>
                    <span>{format(new Date(allowance.nextDate), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Allowance Set</CardTitle>
                <CardDescription>You don't have an allowance set up yet</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Ask your parent to set up an allowance for you.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Allowance History</CardTitle>
              <CardDescription>Your past allowance payments</CardDescription>
            </CardHeader>
            <CardContent>
              {allowanceTransactions.length > 0 ? (
                <div className="space-y-4">
                  {allowanceTransactions.map((payment, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                          <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <div className="text-sm">Allowance Received</div>
                          <div className="text-xs text-muted-foreground">
                            {payment.date} at {payment.time}
                          </div>
                        </div>
                      </div>
                      <div className="font-medium text-green-600 dark:text-green-400 flex">
                        <Symbol />
                        {payment.amount}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No allowance history found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chores Tab Content */}
        <TabsContent value="chores" className="mt-6">
          {/* Balance Card */}
          <Card className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Your Balance</CardTitle>
              <CardDescription className="text-purple-100">Available to spend</CardDescription>
            </CardHeader>
            <CardContent>
              <Currency className="text-4xl font-bold" amount={stableBalance} />
              {allowance && (
                <div className="flex items-center mt-2 text-purple-100">
                  <ArrowDown className="h-4 w-4 mr-1" />
                  <span>
                    Next allowance in {getDaysUntilNextAllowance()} day
                    {getDaysUntilNextAllowance() !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="todo" className="w-full mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="todo">To Do ({activeChores.length})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({pendingChores.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedChores.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="todo" className="space-y-4 mt-6">
              {activeChores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No chores to do right now. Check back later!
                </div>
              ) : (
                activeChores.map(chore => (
                  <Card key={chore.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{chore.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {/* @ts-ignore */}
                        <span>Due {formatDueDate(chore.dueDate)}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">{chore.description}</p>
                    </CardContent>
                    <CardFooter className="border-t pt-4 flex justify-between">
                      <Currency
                        amount={chore.reward}
                        className="font-medium text-green-600 dark:text-green-400"
                      />
                      <Button onClick={() => handleMarkComplete(chore)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Mark Complete
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="pending" className="space-y-4 mt-6">
              {pendingChores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No chores pending approval.
                </div>
              ) : (
                pendingChores.map(chore => (
                  <Card key={chore.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{chore.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {/* @ts-ignore */}
                        <span>Submitted {formatCompletedDate(chore.completedAt)}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{chore.description}</p>
                      {chore.evidence && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Your submission: </span>
                          <span className="text-muted-foreground">{chore.evidence}</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="border-t pt-4 flex justify-between">
                      <Currency
                        amount={chore.reward}
                        className="font-medium text-green-600 dark:text-green-400"
                      />
                      <div className="flex items-center text-sm text-amber-600 dark:text-amber-400">
                        <Clock className="mr-1 h-4 w-4" />
                        Waiting for approval
                      </div>
                    </CardFooter>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4 mt-6">
              {completedChores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No completed chores yet.
                </div>
              ) : (
                completedChores.map(chore => (
                  <Card key={chore.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{chore.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {/* @ts-ignore */}
                        <span>Completed {formatCompletedDate(chore.completedAt)}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{chore.description}</p>
                      {chore.feedback && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Feedback: </span>
                          <span className="text-muted-foreground">{chore.feedback}</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="border-t pt-4 flex justify-between">
                      <Currency
                        amount={chore.reward}
                        className="font-medium text-green-600 dark:text-green-400"
                      />
                      <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Approved
                      </div>
                    </CardFooter>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <CompleteChoreDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        // @ts-ignore
        chore={selectedChore}
        onComplete={handleChoreCompleted}
      />
    </div>
  );
}
