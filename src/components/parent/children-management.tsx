'use client';

import { useState, useEffect, useMemo, useCallback } from 'react'; // Import hooks
import { getCountries } from '@/lib/bando-api'; // Import getCountries function
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
  Copy,
  ExternalLink,
  ShoppingCart,
  Gift,
  LogIn,
  Loader2,
  Gem,
  AlertTriangle,
  Send,
  Users,
  Pencil,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/authContext';
import { deleteChild } from '@/server/kids'; // Assuming server functions are correct
import { updateKidPermissions, getKidPermissions } from '@/server/permissions'; // Assuming server functions are correct
import { updateKidSidebarOptions } from '@/server/sidebar'; // Assuming server functions are correct
import { useReadContracts } from 'wagmi'; // Import wagmi hook
import { erc20Abi } from 'viem'; // Import ABI
import { Currency } from '@/components/shared/currency-symbol'; // Assuming Currency componentimport { availableTokens } from '@/lib/tokens'; // Import available tokens
import { SelectTokensDialog } from '@/components/dialogs/select-tokens-dialog'; // Add import
import { SelectNftsDialog } from '@/components/dialogs/select-nfts-dialog'; // Add import for NFT selection
import { ChildActivityModal } from '@/components/dialogs/child-activity-modal'; // Add import for Child Activity Modal
import { SendFundsModal } from '@/components/dialogs/send-funds-modal'; // Add import for Send Funds Modal
import { toast } from 'react-toastify';
import { devLog } from '@/lib/devlog';
import { NftCollection } from '@prisma/client';
import { HardcodedNft } from '@/lib/nfts';
import {
  getNftCollections,
  getReservoirCollection,
  addCustomNftCollection,
} from '@/server/crypto/nft';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [countries, setCountries] = useState<
    Array<{ code: string; name: string; flagUrl: string }>
  >([]); // For permission saving
  const [selectedChildId, setSelectedChildId] = useState(''); // For permissions tab
  const [showSelectTokensDialog, setShowSelectTokensDialog] = useState(false); // Add state for token dialog
  const [showSelectNftsDialog, setShowSelectNftsDialog] = useState(false); // Add state for NFT dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false); // State for delete confirmation dialog
  const [childToDelete, setChildToDelete] = useState<string | null>(null); // ID of child to delete
  const [newRecipientAddress, setNewRecipientAddress] = useState(''); // For adding new allowed recipient addresses
  const [newRecipientNickname, setNewRecipientNickname] = useState(''); // For adding nicknames to addresses
  const [childNameToDelete, setChildNameToDelete] = useState<string>('');
  const [showImportNftDialog, setShowImportNftDialog] = useState(false);
  const [importAddress, setImportAddress] = useState('');
  const [fetchedCollection, setFetchedCollection] = useState<any>(null);
  const [isFetchingCollection, setIsFetchingCollection] = useState(false);
  const [isImporting, setIsImporting] = useState(false); // Name of child to delete for display
  const [confirmDeleteCheckbox, setConfirmDeleteCheckbox] = useState(false); // State for confirmation checkbox

  const [isDeletingChild, setIsDeletingChild] = useState(false); // Loading state for delete operation

  // Fetch countries when component mounts
  useEffect(() => {
    const fetchCountries = async () => {
      setIsLoadingCountries(true);
      try {
        const response = await getCountries();
        if (response && response.data && Array.isArray(response.data.results)) {
          // Map the API response to match the expected format
          const formattedCountries = response.data.results.map(country => ({
            code: country.isoAlpha2,
            name: country.name,
            flagUrl: country.flagUrl || '',
          }));
          setCountries(formattedCountries);
        }
      } catch (error) {
        console.error('Error fetching countries:', error);
        // Fallback to some default countries if the API fails
      } finally {
        setIsLoadingCountries(false);
      }
    };

    fetchCountries();
  }, []);

  // Activity modal states
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [selectedActivityChildId, setSelectedActivityChildId] = useState<string | null>(null);
  const [selectedActivityChildName, setSelectedActivityChildName] = useState<string>('');

  // Send funds modal states
  const [showSendFundsModal, setShowSendFundsModal] = useState(false);
  const [selectedSendFundsChildId, setSelectedSendFundsChildId] = useState<string | null>(null);
  const [selectedSendFundsChildName, setSelectedSendFundsChildName] = useState<string>('');
  // Define the permissions type
  type Permissions = {
    tradingEnabled: boolean;
    nftEnabled: boolean;
    giftCardsEnabled: boolean;
    maxTradeAmount: number | null;
    maxNftTradeAmount: number | null;
    maxGiftCardAmount: number | null;
    requireGiftCardApproval: boolean;
    cryptoTransferEnabled: boolean;
    maxTransferAmount: number | null;
    allowedRecipientAddresses: string[];
    recipientNicknames: Record<string, string>;
    // Legacy fields - keep for backward compatibility
    allowEth: boolean;
    allowUsdc: boolean;
    allowBase: boolean;
    allowedTokenSymbols: string[];
    allowGamingGiftCards: boolean;
    allowFoodGiftCards: boolean;
    allowEntertainmentGiftCards: boolean;
    allowShoppingGiftCards: boolean;
    allowedGiftCardCategories: string[];
    allowedNftSlugs: string[]; // Update type to include allowedNftSlugs
    // New fields
    allowChoreCreation: boolean;
    allowChoreCompletion: boolean;
    allowTransactionHistory: boolean;
    allowNotifications: boolean;
    includeFamilyWallet: boolean;
    giftCardCountry: string;
    giftCardEmail: string;
  };

  const [permissions, setPermissions] = useState<Permissions>({
    // Initialize with default or empty permissions
    tradingEnabled: false,
    nftEnabled: false,
    giftCardsEnabled: false,
    maxTradeAmount: 0, // Use 0 for unlimited as per comment
    maxNftTradeAmount: 0, // Use 0 for unlimited NFT trades
    maxGiftCardAmount: 0, // Use 0 for unlimited as per comment
    requireGiftCardApproval: true,
    cryptoTransferEnabled: false,
    maxTransferAmount: 0, // Use 0 for unlimited transfers
    allowedRecipientAddresses: [],
    recipientNicknames: {},
    // Legacy fields - keep for backward compatibility
    allowEth: true,
    allowUsdc: true,
    allowBase: true,
    allowedTokenSymbols: [],
    allowGamingGiftCards: true,
    allowFoodGiftCards: true,
    allowEntertainmentGiftCards: true,
    allowShoppingGiftCards: false,
    allowedGiftCardCategories: [],
    allowedNftSlugs: [], // Initialize with empty array
    // New fields
    allowChoreCreation: true,
    allowChoreCompletion: true,
    allowTransactionHistory: true,
    allowNotifications: true,
    includeFamilyWallet: true, // New state for family wallet option
    giftCardCountry: 'US',
    giftCardEmail: '',
  });

  // State for children data combined with on-chain balance for display
  const [displayChildren, setDisplayChildren] = useState<ChildDisplayData[]>([]);

  // Get children list and user from AuthContext
  // The 'children' from AuthContext is the server-fetched list
  const { user, family, children: authChildren } = useAuth();

  const [nftCollections, setNftCollections] = useState<{
    hardcoded: HardcodedNft[];
    custom: NftCollection[];
  }>({ hardcoded: [], custom: [] });

  const handleFetchCollection = async () => {
    if (!importAddress) return;
    setIsFetchingCollection(true);
    try {
      const collection = await getReservoirCollection(importAddress);
      if (collection) {
        setFetchedCollection(collection);
      } else {
        toast.error('Collection not found.');
      }
    } catch (error) {
      toast.error('Failed to fetch collection.');
    } finally {
      setIsFetchingCollection(false);
    }
  };

  const handleImportCollection = async () => {
    if (!fetchedCollection || !family) return;
    setIsImporting(true);
    try {
      await addCustomNftCollection(family.id, fetchedCollection);
      toast.success('Collection imported successfully!');
      setShowImportNftDialog(false);
      setFetchedCollection(null);
      setImportAddress('');
      const collections = await getNftCollections(family.id);
      setNftCollections(collections);
    } catch (error) {
      toast.error('Failed to import collection.');
    } finally {
      setIsImporting(false);
    }
  };

  // Function to fetch NFT collections
  const fetchCollections = useCallback(async () => {
    if (family) {
      try {
        const collections = await getNftCollections(family.id);
        setNftCollections(collections);
      } catch (error) {
        toast.error('Failed to load NFT collections.');
        console.error(error);
      }
    }
  }, [family]);

  // Fetch NFT collections when family changes
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // --- Fetch Permissions for Selected Child ---
  // Use useCallback to memoize the function
  const fetchChildPermissions = useCallback(
    async (childId: string) => {
      if (!childId) {
        devLog.log('ChildrenManagement: No childId selected for permissions fetch.');
        // Optionally reset permissions state to defaults here
        return;
      }

      devLog.log(`ChildrenManagement: Fetching permissions for child: ${childId}`);
      setIsSubmitting(true); // Use isSubmitting for permission saving/loading
      try {
        const response = await getKidPermissions(childId);

        if (response.status >= 200 && response.status < 300 && response.data) {
          devLog.log('ChildrenManagement: Permissions fetched successfully', response.data);
          // Create an object that matches our state structure from the response data
          const permissionDefaults = {
            tradingEnabled: response.data.tradingEnabled ?? true,
            nftEnabled: response.data.nftEnabled ?? true,
            giftCardsEnabled: response.data.giftCardsEnabled ?? true,
            maxTradeAmount: response.data.maxTradeAmount ?? null,
            maxNftTradeAmount: response.data.maxNftTradeAmount ?? null,
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
            allowedNftSlugs: response.data.allowedNftSlugs ?? [], // Populate allowed NFT slugs from DB

            // General permissions not in schema
            allowChoreCompletion: true,
            allowTransactionHistory: true,
            allowNotifications: true,
            giftCardCountry: response.data.giftCardCountry ?? 'US',
            giftCardEmail: response.data.giftCardEmail ?? '',
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
    devLog.log('ChildrenManagement: Auth children updated effect.');
    if (
      authChildren &&
      authChildren.length > 0 &&
      (!selectedChildId || !authChildren.find(c => c.id === selectedChildId))
    ) {
      devLog.log(`ChildrenManagement: Auto-selecting first child: ${authChildren[0].id}`);
      setSelectedChildId(authChildren[0].id);
      // Fetch permissions for the auto-selected child
      fetchChildPermissions(authChildren[0].id);
    } else if (authChildren && authChildren.length === 0 && selectedChildId) {
      // If children list becomes empty, clear selected child
      devLog.log('ChildrenManagement: Children list is empty, clearing selected child.');
      setSelectedChildId('');
      // Optionally reset permissions state to defaults here
    } else if (
      selectedChildId &&
      authChildren &&
      authChildren.find(c => c.id === selectedChildId)
    ) {
      // If children list updates but the selected child is still in the list,
      // re-fetch permissions for the currently selected child in case they changed server-side.
      devLog.log(
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
      devLog.log(
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

    devLog.log(
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
    devLog.log('ChildrenManagement: Processing children balances effect...');

    // We need the children list from AuthContext
    if (!authChildren || authChildren.length === 0) {
      devLog.log('ChildrenManagement: No children from AuthContext, clearing display children.');
      setDisplayChildren([]); // Clear display list if authChildren is empty
      return;
    }

    // We need the balance data from the chain read, but only after it has been fetched
    if (!childrenBalancesFetched) {
      devLog.log('ChildrenManagement: Waiting for children balance data to be fetched.');
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
    devLog.log('ChildrenManagement: Merging Auth children data with on-chain balances.');

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
    devLog.log('ChildrenManagement: Children data with on-chain balances processed.');

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
    devLog.log(`ChildrenManagement: Saving trading permissions for ${selectedChildId}`);
    setIsSubmitting(true);
    try {
      const result = await updateKidPermissions(selectedChildId, {
        tradingEnabled: permissions.tradingEnabled,
        nftEnabled: permissions.nftEnabled,
        maxTradeAmount: permissions.maxTradeAmount,
        maxNftTradeAmount: permissions.maxNftTradeAmount,
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

  const handleSaveGiftCardPermissions = async () => {
    if (!selectedChildId) return;

    setIsSubmitting(true);
    try {
      const response = await updateKidPermissions(selectedChildId, {
        giftCardsEnabled: permissions.giftCardsEnabled,
        maxGiftCardAmount: permissions.maxGiftCardAmount,
        requireGiftCardApproval: permissions.requireGiftCardApproval,
        allowedGiftCardCategories: permissions.allowedGiftCardCategories,
        giftCardCountry: permissions.giftCardCountry,
        giftCardEmail: permissions.giftCardEmail,
      });

      if (response.status === 200) {
        toast.success('Gift card permissions updated successfully');
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('Error updating gift card permissions:', error);
      toast.error('Failed to update gift card permissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveTransferPermissions = useCallback(async () => {
    if (!selectedChildId) {
      toast.error('Please select a child first');
      return;
    }
    devLog.log(`ChildrenManagement: Saving crypto transfer permissions for ${selectedChildId}`);
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
    devLog.log(`ChildrenManagement: Saving general permissions/sidebar for ${selectedChildId}`);
    setIsSubmitting(true);
    try {
      const permissionsUpdateResult = await updateKidPermissions(selectedChildId, {});

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
                <CardFooter className="border-t pt-4">
                  <div className="flex gap-2 w-full justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        setSelectedActivityChildId(child.id);
                        setSelectedActivityChildName(child.name);
                        setShowActivityModal(true);
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Activity
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        setSelectedSendFundsChildId(child.id);
                        setSelectedSendFundsChildName(child.name);
                        setShowSendFundsModal(true);
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Send
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        setChildToDelete(child.id);
                        setChildNameToDelete(child.name);
                        setConfirmDeleteCheckbox(false);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
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
                        Token Trading Permissions
                      </CardTitle>
                      <CardDescription>Control which tokens your child can trade</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Enable Token Trading</Label>
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

                      {permissions.tradingEnabled && (
                        <>
                          <div className="space-y-2">
                            <Label>Allowed Tokens</Label>
                            <Button
                              variant="outline"
                              className="w-full mt-1 justify-start text-left font-normal"
                              disabled={isSubmitting || !selectedChildId}
                              onClick={() => setShowSelectTokensDialog(true)}
                            >
                              Select Allowed Tokens ({permissions.allowedTokenSymbols?.length || 0})
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              Choose which specific tokens the child is allowed to trade.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="max-trade">Maximum Trade Amount (per day)</Label>
                            <div className="relative">
                              <Input
                                id="max-trade"
                                type="number"
                                value={permissions.maxTradeAmount ?? ''}
                                onChange={e =>
                                  setPermissions({
                                    ...permissions,
                                    maxTradeAmount: Number.parseFloat(e.target.value) || 0,
                                  })
                                }
                                disabled={isSubmitting || !selectedChildId}
                                min="0"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">Set to 0 for unlimited</p>
                          </div>
                        </>
                      )}

                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={handleSaveTradingPermissions}
                        disabled={isSubmitting || !selectedChildId}
                      >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save Token Trading Permissions
                      </Button>
                    </CardContent>
                  </Card>

                  {/* NFT Trading Permissions - New Separate Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Gem className="h-5 w-5 text-purple-500" />
                        NFT Trading Permissions
                      </CardTitle>
                      <CardDescription>
                        Control which NFT collections your child can trade
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Enable NFT Trading</Label>
                          <p className="text-sm text-muted-foreground">
                            Allow your child to trade NFT collections
                          </p>
                        </div>
                        <Switch
                          checked={permissions.nftEnabled}
                          onCheckedChange={checked =>
                            setPermissions({ ...permissions, nftEnabled: checked })
                          }
                          disabled={isSubmitting || !selectedChildId}
                        />
                      </div>

                      {permissions.nftEnabled && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Allowed NFT Collections</Label>
                            <Button
                              variant="outline"
                              className="w-full mt-1 justify-start text-left font-normal"
                              disabled={isSubmitting || !selectedChildId}
                              onClick={() => setShowSelectNftsDialog(true)}
                            >
                              Select Allowed NFT Collections (
                              {permissions.allowedNftSlugs?.length || 0})
                            </Button>
                            <p className="text-xs text-muted-foreground">
                              Choose which NFT collections the child is permitted to trade.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="max-nft-trade">
                              Maximum NFT Trade Amount (per day)
                            </Label>
                            <div className="relative">
                              <Input
                                id="max-nft-trade"
                                type="number"
                                value={permissions.maxNftTradeAmount ?? ''}
                                onChange={e =>
                                  setPermissions({
                                    ...permissions,
                                    maxNftTradeAmount: Number.parseFloat(e.target.value) || 0,
                                  })
                                }
                                disabled={isSubmitting || !selectedChildId}
                                min="0"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">Set to 0 for unlimited</p>
                          </div>
                          {/* <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                                                        <div className="flex items-start gap-3">
                                                            <Gem className="h-5 w-5 text-purple-500 mt-0.5" />
                                                            <div>
                                                                <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-1">
                                                                    NFT Trading Guidelines
                                                                </h4>
                                                                <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                                                                    <li>• Only approved collections can be traded</li>
                                                                    <li>• All NFT trades are subject to the general trading limits</li>
                                                                    <li>• Consider the volatility and risks of NFT investments</li>
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </div> */}
                        </div>
                      )}

                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={handleSaveTradingPermissions}
                        disabled={isSubmitting || !selectedChildId}
                      >
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save NFT Trading Permissions
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
                                  const value = e.target.value
                                    ? Number.parseFloat(e.target.value)
                                    : null;
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
                              {permissions.allowedRecipientAddresses &&
                              permissions.allowedRecipientAddresses.length
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
                      <h3 className="font-medium">Coming Soon</h3>
                    </div>
                    <div className="opacity-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-pink-500" />
                          Gift Card Permissions
                        </CardTitle>
                        <CardDescription>Control gift card purchases</CardDescription>
                        {user?.family?.currency &&
                          ['CADC', 'IDRX', 'USDC', 'EURC', 'BRZ'].includes(
                            user.family.currency
                          ) && (
                            <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] rounded-t-lg flex flex-col items-center justify-center z-10">
                              <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                              <h3 className="text-lg font-semibold">Coming Soon</h3>
                            </div>
                          )}
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
                          <div className="space-y-0.5">
                            <Label className="text-base flex items-center gap-2">
                              <Gift className="h-5 w-5 text-pink-500" />
                              Enable Gift Cards
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Allow your child to purchase gift cards
                            </p>
                          </div>
                          <Switch
                            checked={permissions.giftCardsEnabled}
                            onCheckedChange={checked =>
                              setPermissions({ ...permissions, giftCardsEnabled: checked })
                            }
                            disabled={
                              isSubmitting ||
                              !selectedChildId ||
                              (user?.family?.currency
                                ? ['CADC', 'IDRX', 'USDC', 'EURC', 'BRZ'].includes(
                                    user.family.currency
                                  )
                                : false)
                            }
                          />
                        </div>
                        {permissions.giftCardsEnabled && (
                          <>
                            <div className="space-y-2">
                              <Label>Gift Card Country</Label>
                              <Select
                                value={permissions.giftCardCountry}
                                onValueChange={value =>
                                  setPermissions({
                                    ...permissions,
                                    giftCardCountry: value,
                                  })
                                }
                                disabled={isSubmitting || !selectedChildId || isLoadingCountries}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                                <SelectContent>
                                  {isLoadingCountries ? (
                                    <div className="py-2 text-center text-sm text-muted-foreground">
                                      Loading countries...
                                    </div>
                                  ) : (
                                    countries.map(country => (
                                      <SelectItem key={country.code} value={country.code}>
                                        <div className="flex items-center gap-2">
                                          {country.flagUrl ? (
                                            <img
                                              src={country.flagUrl}
                                              alt={`${country.name} flag`}
                                              className="h-4 w-6 object-cover rounded-sm"
                                            />
                                          ) : (
                                            <span className="h-4 w-6 flex items-center justify-center">
                                              🌍
                                            </span>
                                          )}
                                          <span>{country.name}</span>
                                        </div>
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Select the country for gift card purchases
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="gift-card-email">Recipient Email</Label>
                              <Input
                                id="gift-card-email"
                                type="email"
                                placeholder="email@example.com"
                                value={permissions.giftCardEmail || ''}
                                onChange={e =>
                                  setPermissions({
                                    ...permissions,
                                    giftCardEmail: e.target.value,
                                  })
                                }
                                disabled={isSubmitting || !selectedChildId}
                              />
                              <p className="text-xs text-muted-foreground">
                                The gift card will be sent to this email
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="max-gift-card">
                                Maximum Gift Card Amount (per week)
                              </Label>
                              <div className="relative">
                                <Input
                                  id="max-gift-card"
                                  type="number"
                                  value={permissions.maxGiftCardAmount ?? ''}
                                  onChange={e =>
                                    setPermissions({
                                      ...permissions,
                                      maxGiftCardAmount: Number.parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  disabled={isSubmitting || !selectedChildId}
                                  min="0"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Set to 0 for unlimited
                              </p>
                            </div>
                          </>
                        )}

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

          {authChildren === undefined && (
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

      <SelectNftsDialog
        isOpen={showSelectNftsDialog}
        onOpenChange={setShowSelectNftsDialog}
        selectedNfts={permissions.allowedNftSlugs}
        onSave={handleNftSelectionSave}
        customNfts={nftCollections.custom}
        familyId={family?.id || ''}
        onNftImported={() => {
          // Refresh the NFT collections when a new one is imported
          fetchCollections();
        }}
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

      {/* Send Funds Modal */}
      <SendFundsModal
        isOpen={showSendFundsModal}
        onOpenChange={setShowSendFundsModal}
        childId={selectedSendFundsChildId}
        childName={selectedSendFundsChildName}
      />

      <Dialog open={showImportNftDialog} onOpenChange={setShowImportNftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import NFT Collection</DialogTitle>
            <DialogDescription>
              Enter the contract address of the NFT collection you want to import.
            </DialogDescription>
          </DialogHeader>
          {!fetchedCollection ? (
            <div className="space-y-4">
              <Input
                placeholder="0x..."
                value={importAddress}
                onChange={e => setImportAddress(e.target.value)}
              />
              <Button onClick={handleFetchCollection} disabled={isFetchingCollection}>
                {isFetchingCollection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Fetch Collection
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{fetchedCollection.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <img
                    src={fetchedCollection.image}
                    alt={fetchedCollection.name}
                    className="w-24 h-24 mx-auto"
                  />
                  <p className="text-sm text-center mt-2">{fetchedCollection.tokenCount} items</p>
                </CardContent>
              </Card>
              <DialogFooter>
                <Button variant="outline" onClick={() => setFetchedCollection(null)}>
                  Back
                </Button>
                <Button onClick={handleImportCollection} disabled={isImporting}>
                  {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Import
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
