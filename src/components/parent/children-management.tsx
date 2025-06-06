'use client';

import { useState, useEffect, useMemo, useCallback } from 'react'; // Import hooks
import { ChildSignInContent } from '@/components/parent/child-sign-in-content'; // Assuming this component is correct
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
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AddChildDialog } from '@/components/dialogs/add-child-dialog'; // Assuming this component is correct
import {
  Plus,
  Trash2,
  Edit,
  Copy,
  ExternalLink,
  ShoppingCart,
  Gift,
  LogIn,
  Loader2, // Import Loader2 for loading spinners
  Gem,
  AlertTriangle,
  Send,
  Users,
  Pencil,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/authContext'; // Assuming the updated AuthContext
import { createChildWithWallet, deleteChild } from '@/server/kids'; // Assuming server functions are correct
import { updateKidPermissions, getKidPermissions } from '@/server/permissions'; // Assuming server functions are correct
import { updateKidSidebarOptions } from '@/server/sidebar'; // Assuming server functions are correct
import { useReadContracts } from 'wagmi'; // Import wagmi hook
import { erc20Abi } from 'viem'; // Import ABI
import { Currency } from '@/components/shared/currency-symbol'; // Assuming Currency componentimport { availableTokens } from '@/lib/tokens'; // Import available tokens
import { SelectTokensDialog } from '@/components/dialogs/select-tokens-dialog'; // Add import
import { SelectGiftCardsDialog } from '@/components/dialogs/select-gift-cards-dialog'; // Add import
import { SelectNftsDialog } from '@/components/dialogs/select-nfts-dialog'; // Add import for NFT selection
import { ChildActivityModal } from '@/components/dialogs/child-activity-modal'; // Add import for Child Activity Modal
import { toast } from 'react-toastify';
// Final type used for rendering the active children list
type ChildDisplayData = {
  id: string;
  name: string;
  address: string; // Full wallet address
  formattedAddress: string; // Shortened address for display
  balance: number | null; // On-chain balance (null while loading/error)
  allowanceDisplay: string; // Formatted allowance string
};

export function ChildrenManagement() {
  const [showAddChild, setShowAddChild] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // For permission saving
  const [selectedChildId, setSelectedChildId] = useState(''); // For permissions tab
  const [showSelectTokensDialog, setShowSelectTokensDialog] = useState(false); // Add state for token dialog
  const [showSelectGiftCardsDialog, setShowSelectGiftCardsDialog] = useState(false); // Add state for gift card dialog
  const [showSelectNftsDialog, setShowSelectNftsDialog] = useState(false); // Add state for NFT dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false); // State for delete confirmation dialog
  const [childToDelete, setChildToDelete] = useState<string | null>(null); // ID of child to delete
  const [newRecipientAddress, setNewRecipientAddress] = useState(''); // For adding new allowed recipient addresses
  const [newRecipientNickname, setNewRecipientNickname] = useState(''); // For adding nicknames to addresses
  const [childNameToDelete, setChildNameToDelete] = useState<string>(''); // Name of child to delete for display
  const [confirmDeleteCheckbox, setConfirmDeleteCheckbox] = useState(false); // State for confirmation checkbox
  const [isDeletingChild, setIsDeletingChild] = useState(false); // Loading state for delete operation

  // Activity modal states
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedActivityChildId, setSelectedActivityChildId] = useState<string | null>(null);
  const [selectedActivityChildName, setSelectedActivityChildName] = useState<string>('');
  const [permissions, setPermissions] = useState({
    // Initialize with default or empty permissions
    tradingEnabled: true,
    nftEnabled: true,
    giftCardsEnabled: true,
    maxTradeAmount: 0, // Use 0 for unlimited as per comment
    maxGiftCardAmount: 0, // Use 0 for unlimited as per comment
    requireGiftCardApproval: true,
    // Crypto transfer permissions
    cryptoTransferEnabled: false, // Disabled by default for security
    maxTransferAmount: null, // No limit by default
    allowedRecipientAddresses: [] as string[], // Empty by default - no restrictions
    recipientNicknames: {} as Record<string, string>, // New state for recipient nicknames with proper typing
    // Legacy fields
    allowEth: true,
    allowUsdc: true,
    allowBase: true,
    allowGamingGiftCards: true,
    allowFoodGiftCards: true,
    allowEntertainmentGiftCards: true,
    allowShoppingGiftCards: false,
    allowedTokenSymbols: [] as string[], // New state for allowed tokens
    allowedGiftCardCategories: [] as string[], // New state for allowed gift card categories
    allowedNftSlugs: [] as string[], // New state for allowed NFT collections
    // General permissions (assuming these are handled locally or in sidebar options)
    allowChoreCompletion: true,
    allowTransactionHistory: true,
    allowNotifications: true,
    includeFamilyWallet: true, // New state for family wallet option
  });

  // State for children data combined with on-chain balance for display
  const [displayChildren, setDisplayChildren] = useState<ChildDisplayData[]>([]);

  // Get children list and user from AuthContext
  // The 'children' from AuthContext is the server-fetched list
  const { user, children: authChildren } = useAuth();

  // --- Fetch Permissions for Selected Child ---
  // Use useCallback to memoize the function
  const fetchChildPermissions = useCallback(
    async (childId: string) => {
      if (!childId) {
        console.log('ChildrenManagement: No childId selected for permissions fetch.');
        // Optionally reset permissions state to defaults here
        return;
      }

      console.log(`ChildrenManagement: Fetching permissions for child: ${childId}`);
      setIsSubmitting(true); // Use isSubmitting for permission saving/loading
      try {
        const response = await getKidPermissions(childId);

        if (response.status >= 200 && response.status < 300 && response.data) {
          console.log('ChildrenManagement: Permissions fetched successfully', response.data);
          // Create an object that matches our state structure from the response data
          const permissionDefaults = {
            tradingEnabled: response.data.tradingEnabled ?? true,
            nftEnabled: response.data.nftEnabled ?? true,
            giftCardsEnabled: response.data.giftCardsEnabled ?? true,
            maxTradeAmount: response.data.maxTradeAmount ?? null,
            maxGiftCardAmount: response.data.maxGiftCardAmount ?? null,
            requireGiftCardApproval: response.data.requireGiftCardApproval ?? true,

            // Crypto transfer permissions
            cryptoTransferEnabled: response.data.cryptoTransferEnabled ?? false,
            maxTransferAmount: response.data.maxTransferAmount ?? null,
            allowedRecipientAddresses: response.data.allowedRecipientAddresses ?? [],
            recipientNicknames: response.data.recipientNicknames ?? ({} as Record<string, string>),
            includeFamilyWallet: response.data.includeFamilyWallet !== false, // Default to true unless explicitly false

            // Legacy fields
            allowEth: true,
            allowUsdc: true,
            allowBase: true,
            allowGamingGiftCards: true,
            allowFoodGiftCards: true,
            allowEntertainmentGiftCards: true,
            allowShoppingGiftCards: false,

            // Arrays
            allowedTokenSymbols: response.data.allowedTokenSymbols ?? [], // Populate from DB
            allowedGiftCardCategories: response.data.allowedGiftCardCategories ?? [], // Populate from DB
            //@ts-ignore
            allowedNftSlugs: response.data.allowedNftSlugs ?? [], // Populate allowed NFT slugs from DB

            // General permissions not in schema
            allowChoreCompletion: true,
            allowTransactionHistory: true,
            allowNotifications: true,
          };
          // @ts-ignore
          setPermissions(permissionDefaults);
        } else {
          console.error(
            'ChildrenManagement Error: Failed to load permissions:',
            response.status,
            (response as any).message
          );
          toast.error(response.message || 'Failed to load permissions');
          // Optionally reset permissions state to defaults on failure
          // setPermissions({...defaultPermissions}); // You would need to define defaultPermissions
        }
      } catch (error) {
        console.error('ChildrenManagement Error: Exception fetching permissions:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to load permissions');
        // Optionally reset permissions state to defaults on exception
      } finally {
        setIsSubmitting(false);
      }
    },
    [toast]
  ); // Dependencies: toast is stable

  // --- Auto-select the first child and fetch permissions when children are loaded ---
  useEffect(() => {
    console.log('ChildrenManagement: Auth children updated effect.');
    if (
      authChildren &&
      authChildren.length > 0 &&
      (!selectedChildId || !authChildren.find(c => c.id === selectedChildId))
    ) {
      console.log(`ChildrenManagement: Auto-selecting first child: ${authChildren[0].id}`);
      setSelectedChildId(authChildren[0].id);
      // Fetch permissions for the auto-selected child
      fetchChildPermissions(authChildren[0].id);
    } else if (authChildren && authChildren.length === 0 && selectedChildId) {
      // If children list becomes empty, clear selected child
      console.log('ChildrenManagement: Children list is empty, clearing selected child.');
      setSelectedChildId('');
      // Optionally reset permissions state to defaults here
    } else if (
      selectedChildId &&
      authChildren &&
      authChildren.find(c => c.id === selectedChildId)
    ) {
      // If children list updates but the selected child is still in the list,
      // re-fetch permissions for the currently selected child in case they changed server-side.
      console.log(
        `ChildrenManagement: Children list updated, re-fetching permissions for selected child: ${selectedChildId}`
      );
      fetchChildPermissions(selectedChildId);
    }
  }, [authChildren, selectedChildId, fetchChildPermissions]); // Dependencies: React to changes in children from AuthContext or selectedChildId

  // --- Prepare Contract Calls for Child Balances ---
  // Memoize the contract configuration based on children from AuthContext and currency
  const childrenBalancesContractConfig = useMemo(() => {
    const currencyAddress = user?.family?.currencyAddress as `0x${string}` | undefined;

    // Filter for children who have a valid wallet address from AuthContext data
    const childrenWithValidAddresses = authChildren.filter(
      child => !!child.address && child.address.startsWith('0x') && child.address.length === 42
    );

    // Need currency address and at least one child with a valid address
    if (!currencyAddress || childrenWithValidAddresses.length === 0) {
      console.log(
        'ChildrenManagement: Skipping children balance config (missing currency address or valid child addresses).'
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
      `ChildrenManagement: Prepared ${contractCalls.length} contract calls for children balances.`
    );

    return {
      contracts: contractCalls,
      allowFailure: true, // Allow individual child balance calls to fail
    };
  }, [authChildren, user?.family?.currencyAddress]); // Rerun if authChildren or currency address changes

  // --- Fetch On-Chain Balances using wagmi hook ---
  const {
    data: childrenBalancesData,
    isLoading: isLoadingBalances, // Loading state specifically for balance fetches
    error: balancesError,
    isFetched: childrenBalancesFetched, // Use isFetched to know when the call has completed (success or failure)
  } = useReadContracts(
    childrenBalancesContractConfig
      ? { contracts: childrenBalancesContractConfig.contracts, allowFailure: true }
      : ({} as any) // Pass empty config if null
  );

  // --- Process On-Chain Balances and Merge with Auth Children Data ---
  // This effect runs when authChildren data is available OR when on-chain balance data changes
  useEffect(() => {
    console.log('ChildrenManagement: Processing children balances effect...');

    // We need the children list from AuthContext
    if (!authChildren || authChildren.length === 0) {
      console.log('ChildrenManagement: No children from AuthContext, clearing display children.');
      setDisplayChildren([]); // Clear display list if authChildren is empty
      return;
    }

    // We need the balance data from the chain read, but only after it has been fetched
    if (!childrenBalancesFetched) {
      console.log('ChildrenManagement: Waiting for children balance data to be fetched.');
      // While loading balances, display children with null balances but other info
      const childrenWithNullBalances = authChildren.map(child => {
        const allowanceDisplay =
          child.allowances && child.allowances.length > 0
            ? `$${child.allowances[0].amount.toFixed(2)}/${child.allowances[0].frequency.toLowerCase()}`
            : 'Not set';
        return {
          id: child.id,
          name: child.name || 'Unnamed Child',
          address: child.address || '0x',
          formattedAddress: child.address
            ? `${child.address.substring(0, 6)}...${child.address.substring(child.address.length - 4)}`
            : 'No wallet',
          balance: null, // Balance is null while loading
          allowanceDisplay: allowanceDisplay,
        };
      });
      setDisplayChildren(childrenWithNullBalances);
      return;
    }

    // --- Data is ready to be processed ---
    console.log('ChildrenManagement: Merging Auth children data with on-chain balances.');

    // The last result in childrenBalancesData is the decimals call result, if config was not null
    const decimalsResult =
      childrenBalancesContractConfig && childrenBalancesData && childrenBalancesData.length > 0
        ? (childrenBalancesData[childrenBalancesData.length - 1]?.result as number | undefined)
        : undefined; // Safely access the last element

    const currencyDecimals =
      decimalsResult !== undefined && decimalsResult !== null && typeof decimalsResult === 'number'
        ? decimalsResult
        : undefined;

    const childrenWithOnChainBalances: ChildDisplayData[] = authChildren.map(child => {
      const allowanceDisplay =
        child.allowances && child.allowances.length > 0
          ? `$${child.allowances[0].amount.toFixed(2)}/${child.allowances[0].frequency.toLowerCase()}`
          : 'Not set';

      let formattedBalance: number | null = null;
      // let balanceStatus: 'success' | 'failure' | 'loading' = 'loading'; // Optional: track status per child

      // Find the balance result for this specific child by matching address
      // This relies on the order of results in childrenBalancesData matching
      // the order of valid addresses in authChildren used to build the config.
      const childIndexInValidAddresses = authChildren
        .filter(c => !!c.address && c.address.startsWith('0x') && c.address.length === 42)
        .findIndex(c => c.id === child.id);

      if (childIndexInValidAddresses !== -1 && childrenBalancesData?.[childIndexInValidAddresses]) {
        const balanceResultEntry = childrenBalancesData[childIndexInValidAddresses];
        // balanceStatus = balanceResultEntry.status; // Use this if tracking status per child

        if (
          balanceResultEntry.status === 'success' &&
          currencyDecimals !== undefined &&
          currencyDecimals !== null &&
          balanceResultEntry.result !== undefined &&
          balanceResultEntry.result !== null &&
          typeof balanceResultEntry.result === 'bigint'
        ) {
          try {
            formattedBalance = Number(balanceResultEntry.result) / 10 ** currencyDecimals;
          } catch (e) {
            console.error(
              `ChildrenManagement Error: Failed to format balance for child ${child.id}:`,
              e
            );
            formattedBalance = null;
            // balanceStatus = 'failure';
          }
        } else if (balanceResultEntry.status === 'failure') {
          console.warn(
            `ChildrenManagement Warning: Failed to get balance for child ${child.id} (${child.address}).`
          );
          formattedBalance = null; // Indicate balance fetch failed
          // balanceStatus = 'failure';
        }
        // If status is 'pending', formattedBalance remains null and status remains 'loading'
      } else if (child.address) {
        // Child has an address but wasn't found in balance results - unexpected, treat as error
        console.error(
          `ChildrenManagement Error: Child ${child.id} has address but no corresponding balance result.`
        );
        formattedBalance = null;
        // balanceStatus = 'failure';
      } else {
        // Child has no address, balance is not applicable
        formattedBalance = null;
        // balanceStatus = 'success'; // Or 'not_applicable'
      }

      return {
        id: child.id,
        name: child.name || 'Unnamed Child',
        address: child.address || '0x',
        formattedAddress: child.address
          ? `${child.address.substring(0, 6)}...${child.address.substring(child.address.length - 4)}`
          : 'No wallet',
        balance: formattedBalance,
        allowanceDisplay: allowanceDisplay,
        // balanceStatus: balanceStatus // Include if tracking status per child
      };
    });

    setDisplayChildren(childrenWithOnChainBalances);
    console.log('ChildrenManagement: Children data with on-chain balances processed.');

    // Log overall balance errors if any occurred
    if (balancesError) {
      console.error(
        'ChildrenManagement Error: One or more child balance reads failed:',
        balancesError
      );
    }
  }, [
    authChildren,
    childrenBalancesData,
    childrenBalancesFetched,
    user?.family,
    childrenBalancesContractConfig,
    balancesError,
  ]); // Added dependencies

  // --- Handle Saving Permissions ---
  // Memoize save handlers
  const handleSaveTradingPermissions = useCallback(async () => {
    if (!selectedChildId) {
      toast.error('Please select a child first');
      return;
    }
    console.log(`ChildrenManagement: Saving trading permissions for ${selectedChildId}`);
    setIsSubmitting(true);
    try {
      const result = await updateKidPermissions(selectedChildId, {
        tradingEnabled: permissions.tradingEnabled,
        nftEnabled: permissions.nftEnabled,
        maxTradeAmount: permissions.maxTradeAmount,
        allowedTokenSymbols: permissions.allowedTokenSymbols, //@ts-ignore
        allowedNftSlugs: permissions.allowedNftSlugs, // Send the NFT slugs array
        // Remove old boolean flags if fully migrated
        // allowEth: permissions.allowEth, // Example: remove or keep based on migration strategy
        // allowUsdc: permissions.allowUsdc,
        // allowBase: permissions.allowBase,
      });
      if (result.status === 200) {
        toast.success('Trading permissions updated successfully');
      } else {
        throw new Error(result.message || 'Failed to update permissions');
      }
    } catch (error) {
      console.error('ChildrenManagement Error: Failed to save trading permissions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update permissions');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedChildId, permissions, toast]);

  const handleSaveGiftCardPermissions = useCallback(async () => {
    if (!selectedChildId) {
      toast.error('Please select a child first');
      return;
    }
    console.log(`ChildrenManagement: Saving gift card permissions for ${selectedChildId}`);
    setIsSubmitting(true);
    try {
      const result = await updateKidPermissions(selectedChildId, {
        giftCardsEnabled: permissions.giftCardsEnabled,
        maxGiftCardAmount: permissions.maxGiftCardAmount,
        requireGiftCardApproval: permissions.requireGiftCardApproval,
        allowedGiftCardCategories: permissions.allowedGiftCardCategories,
      });
      if (result.status === 200) {
        toast.success('Gift card permissions updated successfully');
      } else {
        throw new Error(result.message || 'Failed to update permissions');
      }
    } catch (error) {
      console.error('ChildrenManagement Error: Failed to save gift card permissions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update permissions');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedChildId, permissions, toast]);

  const handleSaveTransferPermissions = useCallback(async () => {
    if (!selectedChildId) {
      toast.error('Please select a child first');
      return;
    }
    console.log(`ChildrenManagement: Saving crypto transfer permissions for ${selectedChildId}`);
    setIsSubmitting(true);
    try {
      const result = await updateKidPermissions(selectedChildId, {
        // @ts-ignore - These fields are new in the schema
        cryptoTransferEnabled: permissions.cryptoTransferEnabled,
        // @ts-ignore
        maxTransferAmount: permissions.maxTransferAmount,
        // @ts-ignore
        allowedRecipientAddresses: permissions.allowedRecipientAddresses,
        // @ts-ignore
        recipientNicknames: permissions.recipientNicknames,
        // @ts-ignore
        includeFamilyWallet: permissions.includeFamilyWallet,
      });
      if (result.status === 200) {
        toast.success('Crypto transfer permissions updated successfully');
      } else {
        throw new Error(result.message || 'Failed to update transfer permissions');
      }
    } catch (error) {
      console.error('ChildrenManagement Error: Failed to save crypto transfer permissions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update transfer permissions');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedChildId, permissions, toast]);

  const handleTokenSelectionSave = useCallback((selectedSymbols: string[]) => {
    setPermissions(prev => ({ ...prev, allowedTokenSymbols: selectedSymbols }));
  }, []);

  const handleGiftCardCategorySelectionSave = useCallback((selectedIds: string[]) => {
    setPermissions(prev => ({ ...prev, allowedGiftCardCategories: selectedIds }));
  }, []);

  const handleNftSelectionSave = useCallback((selectedSlugs: string[]) => {
    setPermissions(prev => ({ ...prev, allowedNftSlugs: selectedSlugs }));
  }, []);

  const handleSaveGeneralPermissions = useCallback(async () => {
    if (!selectedChildId) {
      toast.error('Please select a child first');
      return;
    }
    console.log(`ChildrenManagement: Saving general permissions/sidebar for ${selectedChildId}`);
    setIsSubmitting(true);
    try {
      // Update general permissions (if schema fields existed)
      // For now, this primarily triggers sidebar options update
      // Assuming updateKidPermissions handles null/undefined for fields not being updated
      const permissionsUpdateResult = await updateKidPermissions(selectedChildId, {
        // Pass only fields that exist in schema and are meant to be general
        // Based on schema, none of allowChoreCompletion etc are there.
        // So this call might just be a placeholder or needs schema update.
      });

      // Update sidebar options based on trading and gift card permissions
      const sidebarUpdateResult = await updateKidSidebarOptions(selectedChildId, {
        allowTrade: permissions.tradingEnabled,
        allowGiftCards: permissions.giftCardsEnabled,
        allowChores: permissions.allowChoreCompletion, // Use general permission state
        allowSettings: true, // Always allow settings for now
        // Add other sidebar options as needed
      });

      if (permissionsUpdateResult.status === 200 && sidebarUpdateResult.status === 200) {
        toast.success('General settings updated successfully');
      } else {
        // Combine potential error messages
        const errorMessage =
          (permissionsUpdateResult.message || '') + ' ' + (sidebarUpdateResult.message || '');
        throw new Error(errorMessage.trim() || 'Failed to update general settings');
      }
    } catch (error) {
      console.error('ChildrenManagement Error: Failed to save general permissions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedChildId, permissions, toast]);

  // --- Combined Loading State ---
  // Consider loading if permissions are submitting OR balances are loading
  const isLoading = isSubmitting || isLoadingBalances;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setShowAddChild(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Child
        </Button>
        {/* AddChildDialog component */}
        <AddChildDialog open={showAddChild} onOpenChange={setShowAddChild} />
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 ">
          <TabsTrigger value="active">Active Children</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 pt-4">
          {/* Use displayChildren which includes on-chain balance */}
          {isLoading && displayChildren.length === 0 ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading children...</span>
            </div>
          ) : displayChildren.length > 0 ? (
            displayChildren.map(child => (
              <Card key={child.id}>
                <CardHeader>
                  <CardTitle className=" flex justify-between items-center">
                    {' '}
                    {/* Added items-center */}
                    {child.name || 'Unnamed Child'}{' '}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          {' '}
                          {/* Use size="sm" for consistency */}
                          <LogIn className="mr-2 h-4 w-4" /> Sign In
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Child Sign In</DialogTitle>
                          <DialogDescription>
                            Let your child sign in by scanning this QR code or entering the code
                            below.
                          </DialogDescription>
                        </DialogHeader>
                        {/* Pass the full address to ChildSignInContent if needed */}
                        <ChildSignInContent childId={child.id} childName={child.name || 'Child'} />
                      </DialogContent>
                    </Dialog>
                  </CardTitle>
                  {/* Condensed Address with Copy Button */}
                  <CardDescription className="flex items-center gap-1">
                    <span className="font-mono text-sm">{child.formattedAddress}</span>{' '}
                    {/* Use font-mono for address, text-sm */}
                    {child.address &&
                      child.address !== '0x' && ( // Only show copy if address exists
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5" // Slightly larger icon button
                          onClick={() => {
                            navigator.clipboard.writeText(child.address); // Copy the full address
                            toast.success('Address copied to clipboard');
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Current Balance</div>
                      {/* Display fetched on-chain balance */}
                      {child.balance !== null ? (
                        <Currency amount={child.balance} className="font-medium text-[#E87E4D]" />
                      ) : isLoadingBalances ? (
                        <div className="text-sm text-muted-foreground flex items-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-1" /> Loading...
                        </div>
                      ) : (
                        <div className="text-sm text-destructive">Balance Error</div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Allowance</div>
                      <div className="font-medium">
                        {child.allowanceDisplay} {/* Use pre-formatted allowance string */}
                      </div>
                    </div>
                  </div>
                </CardContent>
                {/* Improved Button Styling in CardFooter */}
                <CardFooter className="border-t pt-4 flex flex-wrap w-full justify-between items-center gap-2">
                  <div className="flex gap-2 flex-wrap justify-end">
                    {' '}
                    {/* Added flex, gap-2, flex-wrap, justify-end */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedActivityChildId(child.id);
                        setSelectedActivityChildName(child.name);
                        setShowActivityModal(true);
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Activity
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setChildToDelete(child.id);
                        setChildNameToDelete(child.name);
                        setConfirmDeleteCheckbox(false);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))
          ) : (
            // Only show "No children" message if not loading and list is empty
            !isLoading && (
              <Card>
                <CardContent className="py-10">
                  <div className="text-center">
                    <p className="text-muted-foreground">No children found</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowAddChild(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Child
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4 pt-4">
          {/* Permissions tab content */}
          {authChildren && authChildren.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="child-select">Select Child</Label>
                <Select
                  value={selectedChildId}
                  onValueChange={value => {
                    setSelectedChildId(value);
                    fetchChildPermissions(value); // Fetch permissions when child changes
                  }}
                  disabled={isLoadingBalances} // Disable select while balances load (optional)
                >
                  <SelectTrigger id="child-select">
                    <SelectValue placeholder="Select a child" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Use authChildren here as it's the source for the select list */}
                    {authChildren.map(child => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.name || 'Unnamed Child'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Show permissions cards only if a child is selected */}
              {selectedChildId && (
                <div className="space-y-6">
                  {/* Permissions Cards */}
                  {/* Trading Permissions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Trading Permissions
                      </CardTitle>
                      <CardDescription>
                        Control which tokens and NFTs your child can trade
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Enable Trading</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow your child to trade their money for tokens
                          </p>
                        </div>
                        <Switch
                          checked={permissions.tradingEnabled}
                          onCheckedChange={checked =>
                            setPermissions({ ...permissions, tradingEnabled: checked })
                          }
                          disabled={isSubmitting || !selectedChildId}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Allowed Tokens</Label>
                        <Button
                          variant="outline"
                          className="w-full mt-1 justify-start text-left font-normal"
                          disabled={isSubmitting || !selectedChildId || !permissions.tradingEnabled}
                          onClick={() => setShowSelectTokensDialog(true)} // Open token dialog
                        >
                          Select Allowed Tokens ({permissions.allowedTokenSymbols?.length || 0})
                        </Button>
                        {/* Dialog component is added near the end of the file */}
                        <p className="text-xs text-muted-foreground">
                          Choose which specific tokens the child is allowed to trade.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
                          <div className="space-y-0.5">
                            <Label className="text-base flex items-center gap-2">
                              <Gem className="h-5 w-5 text-purple-500" />
                              Enable NFT Trading
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Allow your child to trade NFT collections
                            </p>
                          </div>
                          <Switch
                            checked={permissions.nftEnabled}
                            onCheckedChange={checked =>
                              setPermissions({ ...permissions, nftEnabled: checked })
                            }
                            disabled={
                              isSubmitting || !selectedChildId || !permissions.tradingEnabled
                            }
                          />
                        </div>

                        {permissions.nftEnabled && permissions.tradingEnabled && (
                          <div className="pl-4 border-l-2 border-purple-200 mt-2">
                            <h3 className="font-medium mb-2">Allowed NFT Collections</h3>
                            <Button
                              variant="outline"
                              className="w-full mt-1 justify-start text-left font-normal"
                              disabled={
                                isSubmitting ||
                                !selectedChildId ||
                                !permissions.nftEnabled ||
                                !permissions.tradingEnabled
                              }
                              onClick={() => setShowSelectNftsDialog(true)}
                            >
                              Select Allowed NFT Collections (
                              {permissions.allowedNftSlugs?.length || 0})
                            </Button>
                            <p className="text-xs text-muted-foreground mt-1">
                              Choose which NFT collections the child is permitted to trade.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max-trade">Maximum Trade Amount (per day)</Label>
                        <div className="relative">
                          <Input
                            id="max-trade"
                            type="number"
                            value={permissions.maxTradeAmount ?? ''} // Use ?? '' for controlled input
                            onChange={e =>
                              setPermissions({
                                ...permissions,
                                maxTradeAmount: parseFloat(e.target.value) || 0,
                              })
                            }
                            disabled={isSubmitting || !selectedChildId}
                            min="0" // Prevent negative input
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Set to 0 for unlimited</p>
                      </div>

                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={handleSaveTradingPermissions}
                        disabled={isSubmitting || !selectedChildId}
                      >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Trading Permissions
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Crypto Transfer Permissions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-blue-500" />
                        Crypto Transfer Permissions
                      </CardTitle>
                      <CardDescription>Control crypto transfer capabilities</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
                        <div className="space-y-0.5">
                          <Label className="text-base flex items-center gap-2">
                            <Send className="h-5 w-5 text-blue-500" />
                            Enable Crypto Transfers
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Allow your child to send crypto to other wallets
                          </p>
                        </div>
                        <Switch
                          checked={permissions.cryptoTransferEnabled}
                          onCheckedChange={checked =>
                            setPermissions({ ...permissions, cryptoTransferEnabled: checked })
                          }
                          disabled={isSubmitting || !selectedChildId}
                        />
                      </div>

                      {/* Family Wallet Option */}
                      <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
                        <div className="space-y-0.5">
                          <Label className="text-base flex items-center gap-2">
                            <Users className="h-5 w-5 text-blue-500" />
                            Allow Transfer to Your Wallet
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Let your child send crypto to Your wallet(not the family wallet)
                          </p>
                        </div>
                        <Switch
                          checked={permissions.includeFamilyWallet ?? true}
                          onCheckedChange={checked =>
                            setPermissions({ ...permissions, includeFamilyWallet: checked })
                          }
                          disabled={isSubmitting || !selectedChildId}
                        />
                      </div>

                      {permissions.cryptoTransferEnabled && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="max-transfer">
                              Maximum Transfer Amount (per transaction)
                            </Label>
                            <div className="relative">
                              <Input
                                id="max-transfer"
                                type="number"
                                value={permissions.maxTransferAmount ?? ''}
                                onChange={e => {
                                  const value = e.target.value ? parseFloat(e.target.value) : null;
                                  setPermissions({
                                    ...permissions,
                                    //@ts-ignore
                                    maxTransferAmount: value,
                                  });
                                }}
                                disabled={isSubmitting || !selectedChildId}
                                min="0"
                                placeholder="No limit"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Leave empty for no limit. Amount is in family currency.
                            </p>
                          </div>

                          <div className="pt-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-base">Allowed Recipients</Label>
                              <div className="text-sm text-muted-foreground">
                                {permissions.allowedRecipientAddresses?.length || 0} addresses
                              </div>
                            </div>

                            <div className="space-y-2 mt-2">
                              <div className="flex flex-col gap-2">
                                <Input
                                  placeholder="Enter wallet address"
                                  value={newRecipientAddress}
                                  onChange={e => setNewRecipientAddress(e.target.value)}
                                  disabled={isSubmitting}
                                />
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Nickname (optional)"
                                    value={newRecipientNickname}
                                    onChange={e => setNewRecipientNickname(e.target.value)}
                                    disabled={isSubmitting}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (!newRecipientAddress) return;

                                      // Add address to allowed list
                                      const currentAddresses =
                                        permissions.allowedRecipientAddresses || [];
                                      if (!currentAddresses.includes(newRecipientAddress)) {
                                        // Update address list
                                        setPermissions({
                                          ...permissions,
                                          allowedRecipientAddresses: [
                                            ...currentAddresses,
                                            newRecipientAddress,
                                          ],
                                        });

                                        // Add nickname if provided
                                        if (newRecipientNickname) {
                                          const currentNicknames =
                                            permissions.recipientNicknames || {};
                                          setPermissions(prev => ({
                                            ...prev,
                                            recipientNicknames: {
                                              ...currentNicknames,
                                              [newRecipientAddress]: newRecipientNickname,
                                            },
                                          }));
                                        }

                                        // Reset inputs
                                        setNewRecipientAddress('');
                                        setNewRecipientNickname('');
                                      }
                                    }}
                                    disabled={!newRecipientAddress || isSubmitting}
                                  >
                                    Add Address
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground mt-1">
                              {permissions.allowedRecipientAddresses?.length
                                ? 'Child can only send to these addresses'
                                : 'If no addresses are specified, child can send to any wallet'}
                            </p>

                            {permissions.allowedRecipientAddresses &&
                              permissions.allowedRecipientAddresses.length > 0 && (
                                <div className="mt-2 max-h-[150px] overflow-y-auto space-y-2">
                                  {permissions.allowedRecipientAddresses.map((address, index) => {
                                    // Access nickname if available with proper typing
                                    const nickname =
                                      (permissions.recipientNicknames as Record<string, string>)?.[
                                        address
                                      ] || '';

                                    return (
                                      <div
                                        key={index}
                                        className="flex items-center justify-between bg-muted p-2 rounded-md"
                                      >
                                        <div className="truncate">
                                          {nickname && (
                                            <span className="text-xs font-medium mr-2">
                                              {nickname}
                                            </span>
                                          )}
                                          <code className="text-xs">
                                            {address.substring(0, 8)}...
                                            {address.substring(address.length - 6)}
                                          </code>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => {
                                              // Show a small edit dialog
                                              const newNickname = prompt(
                                                'Enter a nickname for this address',
                                                nickname
                                              );
                                              if (newNickname !== null) {
                                                const currentNicknames =
                                                  permissions.recipientNicknames || {};
                                                setPermissions(prev => ({
                                                  ...prev,
                                                  recipientNicknames: {
                                                    ...currentNicknames,
                                                    [address]: newNickname,
                                                  },
                                                }));
                                              }
                                            }}
                                            disabled={isSubmitting}
                                            title="Edit Nickname"
                                          >
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => {
                                              const currentAddresses =
                                                permissions.allowedRecipientAddresses || [];
                                              const filteredAddresses = currentAddresses.filter(
                                                a => a !== address
                                              );

                                              // Remove from allowed addresses
                                              setPermissions(prev => ({
                                                ...prev,
                                                allowedRecipientAddresses: filteredAddresses,
                                              }));

                                              // Remove nickname if exists
                                              if (nickname && permissions.recipientNicknames) {
                                                const updatedNicknames = {
                                                  ...permissions.recipientNicknames,
                                                };
                                                delete updatedNicknames[address];

                                                setPermissions(prev => ({
                                                  ...prev,
                                                  recipientNicknames: updatedNicknames,
                                                }));
                                              }
                                            }}
                                            disabled={isSubmitting}
                                            title="Remove Address"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                            {permissions.allowedRecipientAddresses &&
                              permissions.allowedRecipientAddresses.length > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setPermissions({
                                      ...permissions,
                                      allowedRecipientAddresses: [],
                                    });
                                  }}
                                  disabled={isSubmitting}
                                  className="mt-2 w-full"
                                >
                                  Clear All Recipients
                                </Button>
                              )}
                          </div>
                        </div>
                      )}

                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={handleSaveTransferPermissions}
                        disabled={isSubmitting || !selectedChildId}
                      >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Transfer Permissions
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Gift Card Permissions */}
                  <Card>
                    {/* Disabled overlay with centered text */}
                    <div className="absolute inset-0 bg-background/10 backdrop-blur-[1px] rounded-xl flex flex-col items-center justify-center z-10">
                      <Clock className="h-16 w-16 text-muted-foreground mb-2" />
                      <h3 className="text-xl font-semibold">Coming Soon</h3>
                    </div>
                    <div className="opacity-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-pink-500" />
                          Gift Card Permissions
                        </CardTitle>
                        <CardDescription>Control gift card purchases</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
                          <div className="space-y-0.5">
                            <Label className="text-base flex items-center gap-2">
                              <Gift className="h-5 w-5 text-pink-500" />
                              Enable Gift Cards
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Allow your child to purchase gift cards with their allowance
                            </p>
                          </div>
                          <Switch
                            checked={permissions.giftCardsEnabled}
                            onCheckedChange={checked =>
                              setPermissions({ ...permissions, giftCardsEnabled: checked })
                            }
                            disabled={isSubmitting || !selectedChildId}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Allowed Gift Card Categories</Label>
                          <Button
                            variant="outline"
                            className="w-full mt-1 justify-start text-left font-normal"
                            disabled={
                              isSubmitting || !selectedChildId || !permissions.giftCardsEnabled
                            }
                            onClick={() => setShowSelectGiftCardsDialog(true)} // Open gift card dialog
                          >
                            Select Allowed Categories (
                            {permissions.allowedGiftCardCategories?.length || 0})
                          </Button>
                          {/* Dialog component is added near the end of the file */}
                          <p className="text-xs text-muted-foreground">
                            Choose which types of gift cards the child can purchase.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="max-gift-card">Maximum Gift Card Amount (per week)</Label>
                          <div className="relative">
                            <Input
                              id="max-gift-card"
                              type="number"
                              value={permissions.maxGiftCardAmount ?? ''} // Use ?? ''
                              onChange={e =>
                                setPermissions({
                                  ...permissions,
                                  maxGiftCardAmount: parseFloat(e.target.value) || 0,
                                })
                              }
                              disabled={isSubmitting || !selectedChildId}
                              min="0"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">Set to 0 for unlimited</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-base">Require Approval</Label>
                            <p className="text-sm text-muted-foreground">
                              Require your approval for each gift card purchase
                            </p>
                          </div>
                          <Switch
                            checked={permissions.requireGiftCardApproval}
                            onCheckedChange={checked =>
                              setPermissions({ ...permissions, requireGiftCardApproval: checked })
                            }
                            disabled={isSubmitting || !selectedChildId}
                          />
                        </div>

                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={handleSaveGiftCardPermissions}
                          disabled={isSubmitting || !selectedChildId}
                        >
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Save Gift Card Permissions
                        </Button>
                      </CardContent>
                    </div>
                  </Card>
                </div>
              )}
            </>
          ) : (
            // Only show "No children" message if authChildren is empty
            authChildren &&
            authChildren.length === 0 && (
              <Card>
                <CardContent className="py-10">
                  <div className="text-center">
                    <p className="text-muted-foreground">No children found</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowAddChild(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Child
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          )}
          {/* Show loading spinner for permissions tab if children are loading */}
          {/* This might overlap with the "No children" message if children load then become empty */}
          {/* Consider a more robust loading state indicator for the entire permissions tab */}
          {authChildren === undefined && ( // Assuming authChildren is undefined while AuthContext is loading
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading children list...</span>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* --- Dialogs --- */}
      <AddChildDialog open={showAddChild} onOpenChange={setShowAddChild} />

      <SelectTokensDialog
        isOpen={showSelectTokensDialog}
        onOpenChange={setShowSelectTokensDialog}
        selectedTokens={permissions.allowedTokenSymbols}
        onSave={handleTokenSelectionSave}
      />

      <SelectGiftCardsDialog
        isOpen={showSelectGiftCardsDialog}
        onOpenChange={setShowSelectGiftCardsDialog}
        selectedCategories={permissions.allowedGiftCardCategories}
        onSave={handleGiftCardCategorySelectionSave}
      />

      <SelectNftsDialog
        isOpen={showSelectNftsDialog}
        onOpenChange={setShowSelectNftsDialog}
        selectedNfts={permissions.allowedNftSlugs}
        onSave={handleNftSelectionSave}
      />

      {/* Delete Child Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Child Account
            </DialogTitle>
            <DialogDescription>
              You are about to permanently delete {childNameToDelete}'s account. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-destructive/10 p-4 rounded-md border border-destructive/20">
              <h4 className="font-medium mb-2">Warning:</h4>
              <ul className="text-sm space-y-2">
                <li>• All account data will be permanently deleted</li>
                <li>• Any allowances or chores will be removed</li>
                <li>
                  • Any assets in the wallet will be inaccessible unless you have the private key
                </li>
              </ul>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="confirm-delete"
                checked={confirmDeleteCheckbox}
                onCheckedChange={checked => setConfirmDeleteCheckbox(checked as boolean)}
              />
              <Label htmlFor="confirm-delete" className="text-sm">
                I understand that this action is irreversible and any assets in the wallet will be
                lost if I don't have the private key saved.
              </Label>
            </div>
          </div>

          <DialogFooter className="flex space-x-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={!confirmDeleteCheckbox || isDeletingChild}
              onClick={handleDeleteChild}
            >
              {isDeletingChild ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>Delete Account</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Child Activity Modal */}
      <ChildActivityModal
        isOpen={showActivityModal}
        onOpenChange={setShowActivityModal}
        childId={selectedActivityChildId}
        childName={selectedActivityChildName}
      />
    </div>
  );

  // Handle deleting a child account
  async function handleDeleteChild() {
    if (!childToDelete || !confirmDeleteCheckbox) return;

    setIsDeletingChild(true);
    try {
      const result = await deleteChild(childToDelete);

      if (result.status === 200) {
        toast.success('Child account deleted successfully');
        // Close the dialog
        setShowDeleteDialog(false);
        // Reset state
        setChildToDelete(null);
        setChildNameToDelete('');
        setConfirmDeleteCheckbox(false);

        // If the deleted child was selected in the permissions tab, clear selection
        if (selectedChildId === childToDelete) {
          setSelectedChildId('');
        }

        // The AuthContext should refresh the children list automatically
        // If not, you might need to call a refresh function from your AuthContext
      } else {
        throw new Error(result.message || 'Failed to delete child account');
      }
    } catch (error) {
      console.error('ChildrenManagement Error: Failed to delete child:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete child account');
    } finally {
      setIsDeletingChild(false);
    }
  }
}
