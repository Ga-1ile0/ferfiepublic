'use client';

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
    useCallback,
} from 'react';
import { useAccount, useDisconnect, useAccountEffect } from 'wagmi';
import { useRouter, usePathname } from 'next/navigation';
import { getCookie, setCookie, deleteCookie } from 'cookies-next';
import { useRole } from '@/components/role-provider'; // Assuming this hook is correct
import { onAuthenticateUser, onAuthenticateChild, getChildrenForParent } from '@/server/user'; // Assuming server functions are correct
import { Family } from '@prisma/client'; // Assuming Prisma types are correct
import { useReadContracts } from 'wagmi';
import { erc20Abi } from 'viem';

// TYPES
type AuthResponse = {
    status: number;
    user?: {
        id: string;
        name: string | null;
        role: string; // e.g., 'PARENT', 'KID'
        address?: string;
        familyAddress?: string;
        familyId?: string;
        family?: Family;
    };
    message?: string; // Added for server error messages
};

type ChildrenResponse = {
    status: number;
    data?: Child[];
    message?: string; // Added for server error messages
};

type User = {
    id: string;
    name: string;
    role: 'parent' | 'kid';
    walletAddress?: string;
    familyAddress?: string;
    familyId?: string;
    family?: Family;
    needsOnboarding?: boolean; // Determined based on role/name presence
    privateKey?: string; // Parent's wallet private key
};

type Child = {
    id: string;
    name: string;
    address: string;
    role: string;
    createdAt: string; // Example, adjust as needed
    allowances?: any[]; // Example, adjust as needed
    permissions?: any; // Example, adjust as needed
};

type AuthContextType = {
    user: User | null;
    children: Child[];
    isLoading: boolean; // Global loading state for initial auth process
    isAuthenticated: boolean;
    needsOnboarding: boolean;
    login: (kidId: string, kidAddress: string) => void;
    logout: () => void;
    generateKidToken: (kidId: string, kidName: string) => string; // Still here, consider if needed in context
    setUserRole: (role: 'parent' | 'kid') => void; // Use the RoleProvider hook directly if possible
    completeOnboarding: () => void;
    refreshChildren: () => Promise<void>;
    refreshBalance: () => void;
    stableBalance: number | null;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use a helper function for route checks
const isPublicRoute = (pathname: string) => ['/signin'].includes(pathname);
const isExemptFromOnboarding = (pathname: string) => ['/signin', '/onboarding'].includes(pathname);

// Keys for caching in localStorage
const STORAGE_KEYS = {
    USER: 'auth_user',
    CHILDREN: 'auth_children',
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [stableBalance, setStableBalance] = useState<number | null>(null);
    const [balanceVersion, setBalanceVersion] = useState(0);
    const [childrenData, setChildrenData] = useState<Child[]>([]);
    const [isLoading, setIsLoading] = useState(true); // Start loading
    const [needsOnboarding, setNeedsOnboarding] = useState(false);
    const { address, isConnected } = useAccount(); // Use isConnected as well
    const { disconnect } = useDisconnect();
    const router = useRouter();
    const pathname = usePathname();
    const { role, setRole } = useRole(); // Use role from RoleProvider

    // --- Caching Helpers ---
    const cacheAuthData = useCallback((userData: User | null, childrenInfo: Child[]) => {
        try {
            if (userData) {
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
            } else {
                localStorage.removeItem(STORAGE_KEYS.USER);
            }
            if (childrenInfo && childrenInfo.length > 0) {
                // Check childrenInfo validity
                localStorage.setItem(STORAGE_KEYS.CHILDREN, JSON.stringify(childrenInfo));
            } else {
                localStorage.removeItem(STORAGE_KEYS.CHILDREN);
            }
        } catch (error) {
            console.error('AuthContext Error: Failed to cache auth data:', error);
        }
    }, []); // Dependencies are stable

    const loadCachedData = useCallback(() => {
        try {
            const cachedUser = localStorage.getItem(STORAGE_KEYS.USER);
            const cachedChildren = localStorage.getItem(STORAGE_KEYS.CHILDREN);
            if (cachedUser) {
                setUser(JSON.parse(cachedUser));
            }
            if (cachedChildren) {
                setChildrenData(JSON.parse(cachedChildren));
            }
        } catch (error) {
            console.error('AuthContext Error: Failed to load cached auth data:', error);
        }
    }, []); // Dependencies are stable

    // --- Internal State Reset Helper ---
    const resetAuthState = useCallback(() => {
        setUser(null);
        setChildrenData([]);
        setNeedsOnboarding(false);
        setStableBalance(null);
        setRole(undefined); // Clear role in RoleProvider
        cacheAuthData(null, []); // Clear cache
    }, [setRole, cacheAuthData]);

    // --- Authentication Handlers ---
    // Internal handler for fetching user/children and updating state
    const fetchAndSetUserState = useCallback(
        async (authAddress: string, kidId?: string) => {
            console.log(`AuthContext: Attempting to authenticate address: ${authAddress}`);
            try {
                if (kidId) {
                    //@ts-ignore
                    const res: AuthResponse = await onAuthenticateChild(kidId, authAddress);
                    if (res.status >= 200 && res.status < 300 && res.user) {
                        console.log('AuthContext: Authentication successful', res.user);
                        const userData: User = {
                            id: res.user.id,
                            name: res.user.name || 'Unknown User',
                            role: res.user.role.toLowerCase() as 'parent' | 'kid',
                            walletAddress: res.user.address,
                            familyId: res.user.familyId,
                            family: res.user.family,
                            familyAddress: res.user.familyAddress,
                            needsOnboarding: res.user.role.toLowerCase() === 'parent' && !res.user.name,
                        };
                        setUser(userData);
                        setRole(userData.role); // Sync role with RoleProvider
                        setNeedsOnboarding(!!userData.needsOnboarding);

                        // Only attempt to fetch children if the role is parent
                        let fetchedChildren: Child[] = [];
                        if (userData.role === 'parent') {
                            try {
                                //@ts-ignore
                                const childrenRes: ChildrenResponse = await getChildrenForParent(userData.id);
                                if (childrenRes.status >= 200 && childrenRes.status < 300) {
                                    fetchedChildren = childrenRes.data || [];
                                    console.log('AuthContext: Children fetched successfully');
                                } else {
                                    console.error(
                                        'AuthContext Error: Failed to fetch children:',
                                        childrenRes.status,
                                        childrenRes.message
                                    );
                                    fetchedChildren = []; // Ensure it's an empty array on failure
                                }
                            } catch (childrenError) {
                                console.error('AuthContext Error: Exception fetching children:', childrenError);
                                fetchedChildren = []; // Ensure it's an empty array on error
                            }
                        }
                        setChildrenData(fetchedChildren);

                        // Cache the data after successful fetch
                        cacheAuthData(userData, fetchedChildren); // Cache with the fetched children
                    } else {
                        // Handle cases where auth fails or user not found for address
                        console.warn(
                            'AuthContext Warning: Authentication failed or user not found for address:',
                            authAddress,
                            res.status,
                            res.message
                        );
                        resetAuthState(); // Reset all auth state
                    }
                } else {
                    //@ts-ignore
                    const res: AuthResponse = await onAuthenticateUser(authAddress);

                    if (res.status >= 200 && res.status < 300 && res.user) {
                        console.log('AuthContext: Authentication successful', res.user);
                        const userData: User = {
                            id: res.user.id,
                            name: res.user.name || 'Unknown User',
                            role: res.user.role.toLowerCase() as 'parent' | 'kid',
                            walletAddress: res.user.address,
                            familyId: res.user.familyId,
                            family: res.user.family,
                            familyAddress: res.user.familyAddress,
                            needsOnboarding: res.user.role.toLowerCase() === 'parent' && !res.user.name,
                        };
                        setUser(userData);
                        setRole(userData.role); // Sync role with RoleProvider
                        setNeedsOnboarding(!!userData.needsOnboarding);

                        // Only attempt to fetch children if the role is parent
                        let fetchedChildren: Child[] = [];
                        if (userData.role === 'parent') {
                            try {
                                //@ts-ignore
                                const childrenRes: ChildrenResponse = await getChildrenForParent(userData.id);
                                if (childrenRes.status >= 200 && childrenRes.status < 300) {
                                    fetchedChildren = childrenRes.data || [];
                                    console.log('AuthContext: Children fetched successfully');
                                } else {
                                    console.error(
                                        'AuthContext Error: Failed to fetch children:',
                                        childrenRes.status,
                                        childrenRes.message
                                    );
                                    fetchedChildren = []; // Ensure it's an empty array on failure
                                }
                            } catch (childrenError) {
                                console.error('AuthContext Error: Exception fetching children:', childrenError);
                                fetchedChildren = []; // Ensure it's an empty array on error
                            }
                        }
                        setChildrenData(fetchedChildren);

                        // Cache the data after successful fetch
                        cacheAuthData(userData, fetchedChildren); // Cache with the fetched children
                    } else {
                        // Handle cases where auth fails or user not found for address
                        console.warn(
                            'AuthContext Warning: Authentication failed or user not found for address:',
                            authAddress,
                            res.status,
                            res.message
                        );
                        resetAuthState(); // Reset all auth state
                    }
                }
            } catch (e) {
                console.error('AuthContext Error: Exception during authentication process:', e);
                resetAuthState(); // Reset all auth state on exception
            }
        },
        [setRole, cacheAuthData, resetAuthState]
    ); // Removed childrenData from dependencies

    // --- Initial Authentication Effect ---
    useEffect(() => {
        let isMounted = true; // Flag to prevent state updates if component unmounts during async op

        const initializeAuth = async () => {
            console.log('AuthContext: Initializing authentication...');
            setIsLoading(true);
            // Attempt to load cached data immediately for faster initial render
            loadCachedData(); // This runs sync

            try {
                const kidSessionToken = getCookie('kid_session_token') as string | undefined;
                const kidId = getCookie('kid_id') as string | undefined;
                const kidAddress = getCookie('kid_address') as string | undefined;

                if (kidSessionToken && kidId && kidAddress) {
                    console.log('AuthContext: Kid cookies found, attempting kid auth.');
                    // Kid auth flow (primarily via cookies)
                    await fetchAndSetUserState(kidAddress, kidId);
                    // Role is set within fetchAndSetUserState based on server response
                } else if (isConnected && address) {
                    console.log(`AuthContext: Wallet connected (${address}), attempting parent auth.`);
                    // Parent auth flow (via wallet connection)
                    await fetchAndSetUserState(address);
                    // Role is set within fetchAndSetUserState based on server response
                } else {
                    console.log('AuthContext: No auth state found (cookies or wallet). Resetting state.');
                    // No auth state found
                    resetAuthState(); // Ensure state is clean
                }
            } catch (error) {
                console.error('AuthContext Error: Exception during initial auth check:', error);
                resetAuthState(); // Ensure state is clean on error
            } finally {
                // Ensure isLoading is set to false in the end only if component is still mounted
                if (isMounted) {
                    console.log('AuthContext: Initialization finished.');
                    setIsLoading(false);
                }
            }
        };

        // Execute the initialization
        initializeAuth();

        // Cleanup function
        return () => {
            isMounted = false; // Set flag to false on unmount
            console.log('AuthContext: Initial auth effect cleanup.');
        };
    }, [address, isConnected, loadCachedData, fetchAndSetUserState, setRole, resetAuthState]); // Dependencies: react to wallet changes and initial mount

    // --- Caching Effect (Reacts to state changes after initial load) ---
    useEffect(() => {
        // Cache data whenever user or childrenData state changes *after* the initial load
        // This catches updates like completing onboarding or refreshing children
        // Only cache if user is actually authenticated (user object exists)
        if (!isLoading && user) {
            console.log('AuthContext: User/children data changed, updating cache.');
            cacheAuthData(user, childrenData);
        } else if (!isLoading && !user) {
            // If not loading and user is null, ensure cache is cleared
            console.log('AuthContext: User is null, clearing cache.');
            cacheAuthData(null, []);
        }
    }, [user, childrenData, cacheAuthData, isLoading]);

    // --- Redirect Effect ---
    useEffect(() => {
        // Redirect once initial auth loading completes
        if (isLoading) {
            console.log('AuthContext: Redirect effect awaiting auth completion.');
            return;
        }
        // Handle return path after signin
        const searchParams = new URLSearchParams(window.location.search);
        const nextPath = searchParams.get('next');
        if (user && nextPath) {
            console.log('AuthContext: Redirecting to next path', nextPath);
            router.replace(nextPath);
            return;
        }
        const currentPath = pathname;
        const isPublic = isPublicRoute(currentPath);
        if (!user) {
            // Not authenticated: only redirect when no wallet connection
            if (!isPublic && !(address && isConnected)) {
                console.log('AuthContext: Redirecting unauthenticated user to signin.');
                router.push(`/signin?next=${currentPath}`);
            }
        } else {
            // Authenticated user
            if (isPublic) {
                // On signin page: send to home
                console.log('AuthContext: Redirecting authenticated user from signin to home.');
                router.push('/');
            } else if (user.role === 'parent' && needsOnboarding && currentPath !== '/onboarding') {
                console.log('AuthContext: Redirecting parent to onboarding page.');
                router.push('/onboarding');
            } else if (user.role === 'parent' && !needsOnboarding && currentPath === '/onboarding') {
                console.log('AuthContext: Redirecting parent from onboarding to home.');
                router.push('/');
            } else {
                console.log('AuthContext: No redirect needed.');
            }
        }
    }, [isLoading, user, needsOnboarding, pathname, router, address, isConnected]);

    // --- Wallet Events (Optional logging, remove if not needed) ---
    useAccountEffect({
        onConnect(data) {
            console.log('AuthContext: Wallet Connected!', data.address);
            // Immediately authenticate parent on wallet connect
            //@ts-ignore
            fetchAndSetUserState(data.address);
        },
        onDisconnect() {
            console.log('AuthContext: Wallet Disconnected!');
            logout();
        },
    });

    // --- Stable Balance Contract Configuration ---
    // Create a stable contract config that only changes when the currency address or relevant address changes
    const contractConfig = useMemo(() => {
        const currencyAddress = user?.family?.currencyAddress as `0x${string}` | undefined;
        const addressToCheck =
            user?.role === 'parent'
                ? (user?.familyAddress as `0x${string}` | undefined)
                : (user?.walletAddress as `0x${string}` | undefined);

        // Only create config if both currency address and addressToCheck are valid hex addresses
        if (
            !currencyAddress ||
            !currencyAddress.startsWith('0x') ||
            currencyAddress.length !== 42 ||
            !addressToCheck ||
            !addressToCheck.startsWith('0x') ||
            addressToCheck.length !== 42
        ) {
            console.log('AuthContext: Skipping stable balance config due to missing/invalid addresses.');
            return null;
        }

        return {
            contracts: [
                {
                    address: currencyAddress,
                    abi: erc20Abi,
                    functionName: 'balanceOf',
                    args: [addressToCheck],
                },
                {
                    address: currencyAddress,
                    abi: erc20Abi,
                    functionName: 'decimals',
                },
                {
                    address: currencyAddress,
                    abi: erc20Abi,
                    functionName: 'symbol', // Added symbol read back
                },
            ],
            allowFailure: false, // Keep this false to easily detect failed reads
        };
    }, [
        user?.family?.currencyAddress,
        user?.familyAddress,
        user?.walletAddress,
        user?.role,
        balanceVersion,
    ]);

    // Only read contracts when we have a valid configuration
    const {
        data: balanceData,
        isLoading: isBalanceLoading,
        error: balanceError,
    } = useReadContracts(
        contractConfig ? { contracts: contractConfig.contracts, allowFailure: false } : ({} as any)
    ); // Pass empty object or skip if config is null

    // Update stable balance when contract read data changes
    useEffect(() => {
        console.log('AuthContext: Stable balance effect running.', {
            balanceData,
            isBalanceLoading,
            balanceError,
            contractConfigExists: !!contractConfig,
        });
        if (balanceData && balanceData.length === 3 && !balanceError) {
            try {
                const rawBalance = balanceData[0]; // BigInt or null/undefined on failure
                const decimals = balanceData[1]; // number or null/undefined on failure
                // const symbol = balanceData[2]; // string or null/undefined - not used in calculation

                if (
                    rawBalance !== undefined &&
                    rawBalance !== null &&
                    typeof rawBalance === 'bigint' &&
                    decimals !== undefined &&
                    decimals !== null &&
                    typeof decimals === 'number'
                ) {
                    // Convert the raw balance to a number and format it
                    setStableBalance(Number(rawBalance) / 10 ** decimals);
                    console.log('AuthContext: Stable balance updated.');
                } else {
                    console.warn('AuthContext Warning: Stable balance data incomplete or wrong type.');
                    setStableBalance(null); // Reset if data is incomplete or wrong type
                }
            } catch (error) {
                console.error('AuthContext Error: Exception calculating stable balance:', error);
                setStableBalance(null); // Reset on calculation error
            }
        } else if (!isBalanceLoading && balanceError) {
            console.error('AuthContext Error: Reading stable balance contract failed:', balanceError);
            setStableBalance(null); // Reset on read error
        } else if (!contractConfig) {
            console.log('AuthContext: Contract config is null, clearing stable balance.');
            setStableBalance(null); // Reset if contract config becomes null
        }
    }, [balanceData, isBalanceLoading, balanceError, contractConfig]);

    // --- ACTIONS ---
    // Simplified login function for Kid flow (called from SignInPage after code/QR auth)
    const login = useCallback(
        async (kidId: string, kidAddress: string) => {
            console.log(`AuthContext: Initiating kid login for id: ${kidId}, address: ${kidAddress}`);
            // Set kid cookies (AuthContext initializes based on these)
            setCookie('kid_session_token', `kid_${kidId}_${Date.now()}`, { maxAge: 365 * 24 * 60 * 60 }); // 1 year
            setCookie('kid_id', kidId, { maxAge: 365 * 24 * 60 * 60 });
            setCookie('kid_address', kidAddress, { maxAge: 365 * 24 * 60 * 60 });

            // Trigger state update by fetching user data for the kid's address
            // This lets the main effect and redirect effect handle navigation
            // No need to set global isLoading here, fetchAndSetUserState will handle its own state updates
            await fetchAndSetUserState(kidAddress, kidId); // Use the internal handler
            console.log('AuthContext: Kid login process finished.');
        },
        [fetchAndSetUserState]
    ); // Dependency: the state-setting handler

    const logout = useCallback(() => {
        console.log('AuthContext: Logging out...');

        // Clear all cookies
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i];
            const eqPos = cookie.indexOf('=');
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }

        // Disconnect wallet if connected (Parent flow)
        if (isConnected) {
            console.log('AuthContext: Disconnecting wallet...');
            disconnect();
        }

        // Reset all auth state
        resetAuthState();
        console.log('AuthContext: State reset, redirecting to signin.');

        // Redirect to signin
        router.push('/signin');
    }, [disconnect, isConnected, resetAuthState, router]);

    // generateKidToken seems like a utility function, perhaps move out of context?
    // Keeping it for now but consider if it truly needs to be here.
    const generateKidToken = (kidId: string, kidName: string) => {
        console.log(`AuthContext: Generating kid token for ${kidName} (${kidId})`);
        return JSON.stringify({
            token: `kid_${kidId}_${Date.now()}`,
            kidId,
            name: kidName,
            expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year expiration in ms
        });
    };

    // setUserRole function provided for external components to potentially switch context roles
    // Consider if useRole().setRole is sufficient directly in those components.
    // Keeping it for backward compatibility with existing usage.
    const setUserRole = useCallback(
        (newRole: 'parent' | 'kid') => {
            console.log(`AuthContext: Manually setting user role to ${newRole}`);
            setRole(newRole); // Update RoleProvider state
            // Note: This doesn't re-fetch user data. If switching roles requires re-auth/re-fetch,
            // additional logic would be needed here or after calling this.
        },
        [setRole]
    );

    const completeOnboarding = useCallback(() => {
        console.log('AuthContext: Completing onboarding.');
        setNeedsOnboarding(false);
        // Update user state immediately locally
        if (user) {
            const updatedUser = { ...user, needsOnboarding: false };
            setUser(updatedUser);
            // Also update cache
            cacheAuthData(updatedUser, childrenData);
        } else {
            console.warn('AuthContext Warning: completeOnboarding called but user is null.');
            // This case shouldn't happen if they are completing onboarding, but handle defensively
            cacheAuthData(null, childrenData);
        }
    }, [user, childrenData, cacheAuthData]);

    const refreshChildren = useCallback(async () => {
        if (user?.role === 'parent' && user.id) {
            console.log(`AuthContext: Refreshing children for parent ${user.id}`);
            try {
                const childrenRes = await getChildrenForParent(user.id);
                if (childrenRes.status >= 200 && childrenRes.status < 300) {
                    const fetchedChildren = childrenRes.data || [];
                    //@ts-ignore
                    setChildrenData(fetchedChildren);
                    console.log('AuthContext: Children data refreshed successfully.');
                    // Update the cache after refreshing
                    //@ts-ignore
                    cacheAuthData(user, fetchedChildren);
                } else {
                    console.error(
                        'AuthContext Error: Failed to refresh children data:',
                        childrenRes.status,
                        childrenRes.message
                    );
                }
            } catch (error) {
                console.error('AuthContext Error: Exception refreshing children data:', error);
            }
        } else {
            console.warn(
                'AuthContext Warning: refreshChildren called but user is not a parent or user ID is missing.'
            );
        }
    }, [user, cacheAuthData]); // Depends on user to know which parent's children to fetch

    const refreshBalance = useCallback(() => {
        console.log('AuthContext: Refreshing stable balance');
        setBalanceVersion(v => v + 1);
    }, []);

    // --- Memoized Context Value ---
    const contextValue = useMemo(
        () => ({
            user,
            children: childrenData,
            isLoading, // Global loading for initial auth
            isAuthenticated: !!user,
            needsOnboarding,
            stableBalance,
            login, // Memoized via useCallback
            logout, // Memoized via useCallback
            generateKidToken, // Not memoized as it doesn't depend on state
            setUserRole, // Memoized via useCallback
            completeOnboarding, // Memoized via useCallback
            refreshChildren, // Memoized via useCallback
            refreshBalance, // Memoized via useCallback
        }),
        [
            user,
            childrenData,
            isLoading,
            needsOnboarding,
            stableBalance,
            login,
            logout,

            // generateKidToken, // No dependency
            setUserRole,
            completeOnboarding,
            refreshChildren,
            refreshBalance,
        ]
    );

    return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
