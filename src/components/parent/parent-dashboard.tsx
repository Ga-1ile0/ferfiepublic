'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, Users, Loader2 } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import ManageFunds from '../dialogs/manage-funds'; // Assuming this component is correct
import { useAuth } from '@/contexts/authContext'; // Assuming the updated AuthContext
import { Currency } from '@/components/shared/currency-symbol'; // Assuming this component is correct
import { getChoresByFamilyId } from '@/server/chores'; // Assuming server functions are correct
import { getChildrenForParent } from '@/server/user'; // Assuming server functions are correct
import { getFamilyTransactions } from '@/server/transaction'; // Assuming server functions are correct
import { format } from 'date-fns';
import { useReadContracts } from 'wagmi'; // Import wagmi hook
import { erc20Abi } from 'viem'; // Import ABI

// Extend the Child type from AuthContext with chore data and formatted address
// We'll map the fetched data to this type for consistency
type ChildFromServer = {
  id: string;
  name: string | null;
  address?: string; // Wallet address from server
  chores?: Array<{ status: string }>; // Assuming chores come nested with status
  // Note: We are ignoring the 'balance' field from the server if it exists,
  // and relying on the on-chain balance instead.
};

// Final type used for rendering, includes formatted on-chain balance
type ChildDisplayData = {
  id: string;
  name: string;
  address: string; // Full address from server
  formattedAddress: string; // Shortened address for display
  balance: number | null; // On-chain balance (null while loading/error)
  pendingChores: number;
};

export function ParentDashboard() {
  // State for data fetched directly from server APIs
  const [serverChildrenData, setServerChildrenData] = useState<ChildFromServer[]>([]);
  const [pendingChores, setPendingChores] = useState<number>(0);
  const [completedChores, setCompletedChores] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]); // Adjust 'any' if you have a transaction type
  const [isLoadingServerData, setIsLoadingServerData] = useState(true); // Loading state for server fetches

  // State for children data combined with on-chain balance
  const [children, setChildren] = useState<ChildDisplayData[]>([]);

  // Get user and family balance from AuthContext
  const { user, stableBalance } = useAuth();

  // --- Fetch Server Data (Children, Chores, Transactions) Concurrently ---
  // This effect runs when the authenticated user object changes
  useEffect(() => {
    const fetchServerData = async () => {
      // Only fetch if user is a parent and has an ID and family ID
      if (!user?.id || user.role !== 'parent' || !user?.familyId) {
        setIsLoadingServerData(false);
        // Clear states if user is not a parent or not fully authenticated
        setServerChildrenData([]);
        setPendingChores(0);
        setCompletedChores(0);
        setTransactions([]);
        setChildren([]); // Also clear the display children state
        console.log(
          'ParentDashboard: User is not a parent or missing family info, skipping server fetch.'
        );
        return;
      }

      setIsLoadingServerData(true);
      console.log('ParentDashboard: Fetching server data for parent dashboard...');

      try {
        // Use Promise.all to fetch all data concurrently
        const [childrenResponse, choresResponse, transactionsResponse] = await Promise.all([
          getChildrenForParent(user.id),
          getChoresByFamilyId(user.familyId),
          getFamilyTransactions(user.familyId),
        ]);

        // Process Children Response
        if (
          childrenResponse.status >= 200 &&
          childrenResponse.status < 300 &&
          childrenResponse.data
        ) {
          setServerChildrenData(childrenResponse.data);
          console.log(
            `ParentDashboard: Fetched ${childrenResponse.data.length} children from server.`
          );
        } else {
          console.error(
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
          console.log(
            `ParentDashboard: Fetched ${choresResponse.data.length} chores. Pending: ${pending}, Completed: ${completed}`
          );
        } else {
          console.error(
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
          console.log(`ParentDashboard: Fetched ${transactionsResponse.data.length} transactions.`);
        } else {
          console.error(
            'ParentDashboard Error: Failed to fetch transactions:',
            transactionsResponse.status,
            (transactionsResponse as any).message
          );
          setTransactions([]); // Ensure empty array on failure
        }
      } catch (error) {
        console.error('ParentDashboard Error: Exception fetching server data:', error);
        // Reset all server-dependent states on critical error
        setServerChildrenData([]);
        setPendingChores(0);
        setCompletedChores(0);
        setTransactions([]);
        setChildren([]); // Also clear the display children state
      } finally {
        setIsLoadingServerData(false);
        console.log('ParentDashboard: Server data fetching finished.');
      }
    };

    fetchServerData();
  }, [user]); // Rerun when user object changes (e.g., after login)

  // --- Prepare Contract Calls for Child Balances ---
  // Memoize the contract configuration based on server-fetched children and currency
  const childrenBalancesContractConfig = useMemo(() => {
    const currencyAddress = user?.family?.currencyAddress as `0x${string}` | undefined;

    // Filter for children who have a valid wallet address
    const childrenWithValidAddresses = serverChildrenData.filter(
      child => !!child.address && child.address.startsWith('0x') && child.address.length === 42
    );

    // Need currency address and at least one child with a valid address
    if (!currencyAddress || childrenWithValidAddresses.length === 0) {
      console.log(
        'ParentDashboard: Skipping children balance config (missing currency address or valid child addresses).'
      );
      return null;
    }

    // Prepare 'balanceOf' calls for each child with a valid address
    const balanceCalls = childrenWithValidAddresses.map(
      child =>
        ({
          address: currencyAddress,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [child.address as `0x${string}`],
        }) as const
    ); // Use 'as const' for wagmi v2 type inference

    // Add a single 'decimals' call
    const decimalsCall = {
      address: currencyAddress,
      abi: erc20Abi,
      functionName: 'decimals',
    } as const;

    // Combine calls: balances first, then decimals
    const contractCalls = [...balanceCalls, decimalsCall];

    console.log(
      `ParentDashboard: Prepared ${contractCalls.length} contract calls for children balances.`
    );

    return {
      contracts: contractCalls,
      allowFailure: true, // Allow individual child balance calls to fail
    };
  }, [serverChildrenData, user?.family?.currencyAddress]); // Rerun if server children data or currency address changes

  // --- Fetch On-Chain Balances using wagmi hook ---
  const {
    data: childrenBalancesData,
    isLoading: isLoadingBalances,
    error: balancesError,
    isFetched: childrenBalancesFetched, // Use isFetched to know when the call has completed (success or failure)
  } = useReadContracts(
    childrenBalancesContractConfig
      ? { contracts: childrenBalancesContractConfig.contracts, allowFailure: true }
      : ({} as any) // Pass empty config if null
  );

  // --- Process On-Chain Balances and Merge with Server Data ---
  // This effect runs when server data is fetched OR when on-chain balance data changes
  useEffect(() => {
    console.log('ParentDashboard: Processing children balances effect...');

    // We need the initial server data to map balances to children
    if (!serverChildrenData || serverChildrenData.length === 0) {
      console.log('ParentDashboard: Waiting for server children data or no children found.');
      // If server data is empty after loading, ensure children display list is also empty
      if (!isLoadingServerData) {
        setChildren([]);
      }
      return;
    }

    // We need the balance data from the chain read, but only after it has been fetched
    if (!childrenBalancesFetched) {
      console.log('ParentDashboard: Waiting for children balance data to be fetched.');
      // Optionally, set children state with server data but null balances while chain data loads
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
          balance: null, // Balance is null while loading
          pendingChores: pendingChoresCount,
        };
      });
      setChildren(childrenWithNullBalances);
      return;
    }

    // --- Data is ready to be processed ---
    console.log('ParentDashboard: Merging server children data with on-chain balances.');

    // The last result is the decimals call
    const decimalsResult = childrenBalancesData?.[
      serverChildrenData.filter(child => !!child.address).length
    ]?.result as number | undefined;
    const currencyDecimals =
      decimalsResult !== undefined && decimalsResult !== null && typeof decimalsResult === 'number'
        ? decimalsResult
        : undefined;

    if (currencyDecimals === undefined) {
      console.warn(
        'ParentDashboard Warning: Currency decimals not available from chain, cannot format balances.'
      );
      // Proceed without formatted balances, or set balances to null
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
          balance: null, // Balance is null if decimals are missing
          pendingChores: pendingChoresCount,
        };
      });
      setChildren(childrenWithServerBalance);
      return;
    }

    console.log(`ParentDashboard: Using decimals: ${currencyDecimals}.`);

    const childrenWithOnChainBalances: ChildDisplayData[] = serverChildrenData.map(child => {
      const pendingChoresCount =
        child.chores?.filter(c => c.status === 'ACTIVE' || c.status === 'PENDING_APPROVAL')
          .length || 0;

      let formattedBalance: number | null = null;
      let balanceStatus: 'success' | 'failure' | 'loading' = 'loading'; // Default to loading

      // Find the balance result for this specific child by matching address
      // Note: This assumes addresses are unique and in the same order as the contract calls were made for balance checks
      // A more robust approach might involve creating a map { address: index } from the contract config creation step
      // For simplicity here, we rely on the order matching the filtered serverChildrenData order
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
            console.error(
              `ParentDashboard Error: Failed to format balance for child ${child.id}:`,
              e
            );
            formattedBalance = null;
            balanceStatus = 'failure'; // Mark as failure if formatting fails
          }
        } else if (balanceStatus === 'failure') {
          console.warn(
            `ParentDashboard Warning: Failed to get balance for child ${child.id} (${child.address}).`
          );
          formattedBalance = null; // Indicate balance fetch failed
        }
        // If status is 'pending', formattedBalance remains null and status remains 'loading'
      } else if (child.address) {
        // Child has an address but wasn't found in balance results - unexpected, treat as error
        console.error(
          `ParentDashboard Error: Child ${child.id} has address but no corresponding balance result.`
        );
        formattedBalance = null;
        balanceStatus = 'failure';
      } else {
        // Child has no address, balance is not applicable
        formattedBalance = null;
        balanceStatus = 'success'; // Consider having no address a 'success' for not needing a balance
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
    console.log('ParentDashboard: Children data with on-chain balances processed.');

    // Log overall balance errors if any occurred
    if (balancesError) {
      console.error(
        'ParentDashboard Error: One or more child balance reads failed:',
        balancesError
      );
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

  // --- Combine Loading States ---
  // Consider overall loading to be true if server data is loading OR balances are loading
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
          <CardContent>
            {/* stableBalance comes from AuthContext, already handles loading/formatting */}
            {user?.family?.currencyAddress ? (
              <Currency amount={stableBalance} className="text-3xl font-bold text-[#E87E4D] mb-2" />
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
              <CardDescription className=" lg:text-md text-xs">
                Chores awaiting review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingServerData ? (
                <div className="flex items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  <span>Loading...</span>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-[#E87E4D]">{pendingChores}</div>
                  <div className=" text-muted-foreground mt-1 lg:text-md text-xs">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {/* You might want a real "Last Updated" time here */}
                    Updated just now
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Completed Chores</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingServerData ? (
                <div className="flex items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  <span>Loading...</span>
                </div>
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
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest transactions and events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoadingServerData ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
                  <span>Loading transactions...</span>
                </div>
              ) : transactions.length > 0 ? (
                transactions.map((transaction, index) => (
                  <div
                    key={transaction.id || index} // Use index as fallback key if id is missing
                    className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div>
                      <div className="font-medium">
                        {/* Improved transaction type descriptions */}
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
                        {/* Add other transaction types as needed */}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {transaction.createdAt
                          ? format(new Date(transaction.createdAt), 'MMM d, h:mm a')
                          : 'No date'}
                      </div>
                      {transaction.description && (
                        <div className="text-xs text-muted-foreground">
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
              <CardTitle>Children</CardTitle>
              <CardDescription>Manage your children's accounts</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Use combined loading state for the overall children list */}
              {isLoading ? (
                <div className="flex justify-center items-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2">Loading children data...</span>
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
                      <div className="text-xs text-muted-foreground">
                        {child.formattedAddress}
                      </div>{' '}
                      {/* Display formatted address */}
                    </div>
                    <div className="text-right">
                      {/* WRAP these two elements in a Fragment to fix the JSX error */}
                      <>
                        {/* Display balance based on its availability and loading state */}
                        {child.balance !== null ? (
                          <Currency amount={child.balance} className="font-medium text-[#E87E4D]" />
                        ) : isLoadingBalances ? ( // Use isLoadingBalances for the balance column specifically
                          <span className="text-sm text-muted-foreground">Loading...</span>
                        ) : (
                          // Show error if balance is null and not currently loading balances
                          <span className="text-sm text-destructive">Balance Error</span>
                        )}

                        <div className="text-xs text-muted-foreground">
                          {child.pendingChores} pending{' '}
                          {child.pendingChores === 1 ? 'chore' : 'chores'}
                        </div>
                      </>{' '}
                      {/* End of Fragment */}
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
