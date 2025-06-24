'use client';

import { devLog } from '@/lib/devlog';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Users, Loader2, Activity } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import ManageFunds from '../dialogs/manage-funds';
import { useAuth } from '@/contexts/authContext';
import { Currency } from '@/components/shared/currency-symbol';
import { getChoresByFamilyId } from '@/server/chores';
import { getChildrenForParent } from '@/server/user';
import { getFamilyTransactions } from '@/server/transaction';
import { format } from 'date-fns';
import { useReadContracts } from 'wagmi';
import { erc20Abi } from 'viem';
import { Skeleton } from '@/components/ui/skeleton';

type ChildFromServer = {
  id: string;
  name: string | null;
  address?: string;
  chores?: Array<{ status: string }>;
};

type ChildDisplayData = {
  id: string;
  name: string;
  address: string;
  formattedAddress: string;
  balance: number | null;
  pendingChores: number;
};

export function ParentDashboard() {
  const [serverChildrenData, setServerChildrenData] = useState<ChildFromServer[]>([]);
  const [pendingChores, setPendingChores] = useState<number>(0);
  const [completedChores, setCompletedChores] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingServerData, setIsLoadingServerData] = useState(true);
  const [children, setChildren] = useState<ChildDisplayData[]>([]);
  const { user, stableBalance } = useAuth();

  useEffect(() => {
    const fetchServerData = async () => {
      if (!user?.id || user.role !== 'parent' || !user?.familyId) {
        setIsLoadingServerData(false);
        setServerChildrenData([]);
        setPendingChores(0);
        setCompletedChores(0);
        setTransactions([]);
        setChildren([]);
        devLog.log(
          'ParentDashboard: User is not a parent or missing family info, skipping server fetch.'
        );
        return;
      }

      setIsLoadingServerData(true);
      devLog.log('ParentDashboard: Fetching server data for parent dashboard...');

      try {
        // Fetch all required data in parallel
        const [childrenResponse, choresResponse, transactionsResponse] = await Promise.all([
          getChildrenForParent(user.id),
          getChoresByFamilyId(user.familyId),
          getFamilyTransactions(user.familyId),
        ]);

        // Process children data
        if (
          childrenResponse.status >= 200 &&
          childrenResponse.status < 300 &&
          childrenResponse.data
        ) {
          setServerChildrenData(childrenResponse.data);
          devLog.log(
            `ParentDashboard: Fetched ${childrenResponse.data.length} children from server.`
          );
        } else {
          devLog.error(
            'ParentDashboard Error: Failed to fetch children:',
            childrenResponse.status,
            (childrenResponse as any).message
          );
          setServerChildrenData([]); // Ensure empty array on failure
        }

        // Process Chores Response
        if (choresResponse.status >= 200 && choresResponse.status < 300 && choresResponse.data) {
          const pending = choresResponse.data.filter(
            chore => chore.status === 'PENDING_APPROVAL'
          ).length;
          const completed = choresResponse.data.filter(
            chore => chore.status === 'COMPLETED'
          ).length;
          setPendingChores(pending);
          setCompletedChores(completed);
          devLog.log(
            `ParentDashboard: Fetched ${choresResponse.data.length} chores. Pending: ${pending}, Completed: ${completed}`
          );
        } else {
          devLog.error(
            'ParentDashboard Error: Failed to fetch chores:',
            choresResponse.status,
            (choresResponse as any).message
          );
          setPendingChores(0);
          setCompletedChores(0);
        }

        // Process Transactions Response
        if (
          transactionsResponse.status >= 200 &&
          transactionsResponse.status < 300 &&
          transactionsResponse.data
        ) {
          setTransactions(transactionsResponse.data);
          devLog.log(`ParentDashboard: Fetched ${transactionsResponse.data.length} transactions.`);
        } else {
          devLog.error(
            'ParentDashboard Error: Failed to fetch transactions:',
            transactionsResponse.status,
            (transactionsResponse as any).message
          );
          setTransactions([]); // Ensure empty array on failure
        }
      } catch (error) {
        devLog.error('ParentDashboard Error: Exception fetching server data:', error);
        // Reset all server-dependent states on critical error
        setServerChildrenData([]);
        setPendingChores(0);
        setCompletedChores(0);
        setTransactions([]);
        setChildren([]); // Also clear the display children state
      } finally {
        setIsLoadingServerData(false);
        devLog.log('ParentDashboard: Server data fetching completed');
      }
    };

    fetchServerData();
  }, [user]);

  // Prepare contract calls to fetch child balances
  const childrenBalancesContractConfig = useMemo(() => {
    const currencyAddress = user?.family?.currencyAddress as `0x${string}` | undefined;
    const childrenWithValidAddresses = serverChildrenData.filter(
      child => !!child.address && child.address.startsWith('0x') && child.address.length === 42
    );

    if (!currencyAddress || childrenWithValidAddresses.length === 0) {
      devLog.log('ParentDashboard: No valid child addresses or currency address found');
      return null;
    }

    // Prepare balanceOf calls for each child's address
    const balanceCalls = childrenWithValidAddresses.map(
      child =>
        ({
          address: currencyAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [child.address as `0x${string}`],
        }) as const
    );

    // Add call to get token decimals
    const decimalsCall = {
      address: currencyAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    } as const;

    const contractCalls = [...balanceCalls, decimalsCall];
    devLog.log(`ParentDashboard: Prepared ${contractCalls.length} contract calls`);

    return {
      contracts: contractCalls,
      allowFailure: true,
    };
  }, [serverChildrenData, user?.family?.currencyAddress]);

  // Fetch on-chain balances using wagmi
  const {
    data: childrenBalancesData,
    isLoading: isLoadingBalances,
    error: balancesError,
    isFetched: childrenBalancesFetched,
  } = useReadContracts(
    childrenBalancesContractConfig
      ? { contracts: childrenBalancesContractConfig.contracts, allowFailure: true }
      : ({} as any)
  );

  // Process on-chain balances and merge with server data
  useEffect(() => {
    devLog.log('ParentDashboard: Processing balances...');

    // Skip if no server data is available
    if (!serverChildrenData || serverChildrenData.length === 0) {
      devLog.log('ParentDashboard: No children data available');
      if (!isLoadingServerData) {
        setChildren([]);
      }
      return;
    }

    // If balances haven't been fetched yet, initialize with null balances
    if (!childrenBalancesFetched) {
      devLog.log('ParentDashboard: Fetching balances...');
      const childrenWithNullBalances = serverChildrenData.map(child => {
        const pendingChoresCount =
          child.chores?.filter(c => c.status === 'ACTIVE' || c.status === 'PENDING_APPROVAL')
            .length || 0;
        return {
          id: child.id,
          name: child.name || 'Unnamed Child',
          address: child.address || '0x',
          formattedAddress: child.address
            ? `${child.address.substring(0, 6)}...${child.address.substring(child.address.length - 4)}`
            : 'No wallet',
          balance: null,
          pendingChores: pendingChoresCount,
        };
      });
      setChildren(childrenWithNullBalances);
      return;
    }

    // Process and merge balance data with children
    devLog.log('ParentDashboard: Merging balances with children data');

    // Extract decimals from the last call result
    const decimalsResult = childrenBalancesData?.[
      serverChildrenData.filter(child => !!child.address).length
    ]?.result as number | undefined;
    const currencyDecimals = typeof decimalsResult === 'number' ? decimalsResult : undefined;

    if (currencyDecimals === undefined) {
      devLog.warn('ParentDashboard: Currency decimals not available');

      const childrenWithServerBalance = serverChildrenData.map(child => {
        const pendingChoresCount =
          child.chores?.filter(c => c.status === 'ACTIVE' || c.status === 'PENDING_APPROVAL')
            .length || 0;
        return {
          id: child.id,
          name: child.name || 'Unnamed Child',
          address: child.address || '0x',
          formattedAddress: child.address
            ? `${child.address.substring(0, 6)}...${child.address.substring(child.address.length - 4)}`
            : 'No wallet',
          balance: null,
          pendingChores: pendingChoresCount,
        };
      });
      setChildren(childrenWithServerBalance);
      return;
    }

    devLog.log(`ParentDashboard: Using decimals: ${currencyDecimals}`);

    const childrenWithOnChainBalances: ChildDisplayData[] = serverChildrenData.map(child => {
      const pendingChoresCount =
        child.chores?.filter(c => c.status === 'ACTIVE' || c.status === 'PENDING_APPROVAL')
          .length || 0;

      let formattedBalance: number | null = null;
      let balanceStatus: 'success' | 'failure' | 'loading' = 'loading';

      // Find the balance result for this child by matching array index
      const childIndexInCalls = serverChildrenData
        .filter(c => !!c.address)
        .findIndex(c => c.id === child.id);

      if (childIndexInCalls !== -1 && childrenBalancesData?.[childIndexInCalls]) {
        const balanceResultEntry = childrenBalancesData[childIndexInCalls];
        balanceStatus = balanceResultEntry.status;

        if (
          balanceStatus === 'success' &&
          balanceResultEntry.result !== undefined &&
          balanceResultEntry.result !== null &&
          typeof balanceResultEntry.result === 'bigint'
        ) {
          try {
            formattedBalance = Number(balanceResultEntry.result) / 10 ** currencyDecimals;
          } catch (e) {
            devLog.error(`ParentDashboard: Format error for child ${child.id}`, e);
            formattedBalance = null;
            balanceStatus = 'failure';
          }
        } else if (balanceStatus === 'failure') {
          devLog.warn(`ParentDashboard: Failed to get balance for ${child.id}`);
          formattedBalance = null;
        }
      } else if (child.address) {
        devLog.error(`ParentDashboard: Missing balance result for ${child.id}`);
        formattedBalance = null;
        balanceStatus = 'failure';
      } else {
        // No address means no balance to fetch
        formattedBalance = null;
        balanceStatus = 'success';
      }

      return {
        id: child.id,
        name: child.name || 'Unnamed Child',
        address: child.address || '0x',
        formattedAddress: child.address
          ? `${child.address.substring(0, 6)}...${child.address.substring(child.address.length - 4)}`
          : 'No wallet',
        balance: formattedBalance,
        pendingChores: pendingChoresCount,
        // Optionally add balanceStatus here if you want to display different messages
      };
    });

    setChildren(childrenWithOnChainBalances);
    devLog.log('ParentDashboard: Children data with on-chain balances processed.');

    if (balancesError) {
      devLog.error('ParentDashboard: Error fetching balances:', balancesError);
    }
  }, [
    childrenBalancesData,
    serverChildrenData,
    user?.family,
    childrenBalancesContractConfig,
    balancesError,
    childrenBalancesFetched,
    isLoadingServerData,
  ]); // Added dependencies

  // Combine loading states from server and blockchain
  const isLoading = isLoadingServerData || isLoadingBalances;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-shadow-small">Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Family Balance Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-l flex justify-between items-center">
              Family Balance
              {/* ManageFunds dialog */}
              <ManageFunds />
            </CardTitle>
            <CardDescription>Total funds available in your family wallet</CardDescription>
          </CardHeader>
          <CardContent className="mt-2">
            {user?.family?.currencyAddress ? (
              isLoadingServerData ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2">Loading balance...</span>
                </div>
              ) : (
                <Currency
                  amount={stableBalance}
                  className="text-3xl font-bold text-[#E87E4D] mb-2"
                />
              )
            ) : (
              <div className="text-xl text-muted-foreground mb-2">No currency configured</div>
            )}
          </CardContent>
        </Card>

        {/* Chores Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingServerData ? (
                <>
                  <Skeleton className="h-9 w-16 bg-muted mb-2" />
                  <Skeleton className="h-4 w-32 bg-muted" />
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold text-[#E87E4D]">{pendingChores}</div>
                  <div className=" text-muted-foreground mt-1 lg:text-md text-xs">
                    <Clock className="inline h-3 w-3 mr-1" />
                    Updated just now
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="flex justify-between flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Completed Chores</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingServerData ? (
                <>
                  <Skeleton className="h-9 w-16 bg-muted mb-2" />
                  <Skeleton className="h-4 w-32 bg-muted" />
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold text-[#E87E4D]">{completedChores}</div>
                  <div className=" text-muted-foreground mt-1 lg:text-md text-xs">
                    <CheckCircle className="inline h-3 w-3 mr-1" />
                    Great progress!
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Recent Activity Card (Transactions) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {' '}
              <Activity className="inline h-5 w-5 mr-1" />
              Recent Activity
            </CardTitle>
            {/* <CardDescription>Latest transactions and events</CardDescription> */}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoadingServerData ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2">Loading transactions...</span>
                </div>
              ) : transactions.length > 0 ? (
                transactions.map((transaction, index) => (
                  <div
                    key={transaction.id || index} // Use index as fallback key if id is missing
                    className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="text-lg">
                        {transaction.type === 'ALLOWANCE' &&
                          `Allowance ${transaction.description?.includes('Deposited') ? 'deposited' : 'sent to'} ${transaction.user?.name || 'User'}`}
                        {transaction.type === 'CHORE_REWARD' &&
                          `${transaction.user?.name || 'User'} completed a chore`}
                        {transaction.type === 'GIFT_CARD_PURCHASE' &&
                          `${transaction.user?.name || 'User'} purchased a gift card`}
                        {transaction.type === 'TOKEN_TRADE' &&
                          `${transaction.user?.name || 'User'} traded tokens`}
                        {transaction.type === 'NFT_TRADE' &&
                          `${transaction.user?.name || 'User'} traded NFTs`}
                        {transaction.type === 'TOKEN_TRANSFER' &&
                          `${transaction.user?.name || 'User'} transferred tokens`}
                        {transaction.type === 'WITHDRAWAL' && `You withdrew tokens`}
                        {transaction.type === 'DEPOSIT' && `You deposited tokens`}
                        {/* Add other transaction types as needed */}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.createdAt
                          ? format(new Date(transaction.createdAt), 'MMM d, h:mm a')
                          : 'No date'}
                      </div>
                      {transaction.description && (
                        <div className="text-sm text-muted-foreground">
                          {transaction.description}
                        </div>
                      )}
                    </div>
                    {/* Assuming amount is a number and indicates direction by sign */}
                    <div
                      className={`font-medium ${typeof transaction.amount === 'number' ? (transaction.amount >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}
                    >
                      <Currency amount={transaction.amount} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">No transactions yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Children Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="inline h-5 w-5 mr-1" />
                Children
              </CardTitle>
              {/* <CardDescription>Manage your children's accounts</CardDescription> */}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Use combined loading state for the overall children list */}
              {isLoading ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2">Loading children...</span>
                </div>
              ) : children.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No children added yet. Add your first child to get started.
                </div>
              ) : (
                children.map(child => (
                  <div
                    key={child.id}
                    className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="font-medium">{child.name}</div>
                      <div className="text-xs text-muted-foreground">{child.formattedAddress}</div>
                    </div>
                    <div className="text-right">
                      <>
                        {/* Display balance based on its availability and loading state */}
                        {child.balance !== null ? (
                          <Currency amount={child.balance} className="font-medium text-[#E87E4D]" />
                        ) : isLoadingBalances ? (
                          <Loader2 className="h-5 w-5 animate-spin text-[#E87E4D]" />
                        ) : (
                          <span className="text-sm text-destructive">Balance Error</span>
                        )}

                        <div className="text-xs text-muted-foreground">
                          {child.pendingChores} pending{' '}
                          {child.pendingChores === 1 ? 'chore' : 'chores'}
                        </div>
                      </>
                    </div>
                  </div>
                ))
              )}
              <Link href="/children">
                <Button variant="outline" size="sm" className="w-full">
                  <Users className="mr-2 h-4 w-4" />
                  Manage
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
