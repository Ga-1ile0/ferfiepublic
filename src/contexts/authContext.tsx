'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  useCallback,
} from 'react';
import { devLog } from '@/lib/devlog';
import { useAccount, useDisconnect, useAccountEffect } from 'wagmi';
import { useRouter, usePathname } from 'next/navigation';
import { getCookie, setCookie, deleteCookie } from 'cookies-next';
import { useRole } from '@/components/role-provider'; // Assuming this hook is correct
import { onAuthenticateUser, onAuthenticateChild, getChildrenForParent } from '@/server/user'; // Assuming server functions are correct
import { createChildAuthCode } from '@/server/childAuth';
import { createOrUpdateSession } from '@/server/userSessions';
import { validateUserSession } from '@/server/userSessions';
import { toast } from 'sonner';
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
  family: Family | null;
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

  const loadCachedData = useCallback(async (): Promise<boolean> => {
    try {
      const cachedUser = localStorage.getItem(STORAGE_KEYS.USER);
      const cachedChildren = localStorage.getItem(STORAGE_KEYS.CHILDREN);
      
      if (cachedUser) {
        const userData = JSON.parse(cachedUser);
        const sessionToken = localStorage.getItem(`session_${userData.id}`);
        
        // Validate session if we have a session token
        if (sessionToken) {
          try {
            const { isValid } = await validateUserSession(userData.id, sessionToken);
            if (!isValid) {
              // Session is invalid, clear auth data and cookies
              console.log('Session invalid, clearing auth data');
              localStorage.removeItem(STORAGE_KEYS.USER);
              localStorage.removeItem(STORAGE_KEYS.CHILDREN);
              localStorage.removeItem(`session_${userData.id}`);
              
              // Clear all cookies
              const cookies = document.cookie.split(';');
              for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i];
                const eqPos = cookie.indexOf('=');
                const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
              }
              return false;
            }
          } catch (validationError) {
            console.warn('Session validation failed:', validationError);
            // If validation fails, clear the data to be safe
            localStorage.removeItem(STORAGE_KEYS.USER);
            localStorage.removeItem(STORAGE_KEYS.CHILDREN);
            localStorage.removeItem(`session_${userData.id}`);
            return false;
          }
        }
        
        setUser(userData);
        setRole(userData.role); // Set role from cached data
        setNeedsOnboarding(!!userData.needsOnboarding);
        
        if (cachedChildren) {
          setChildrenData(JSON.parse(cachedChildren));
        }
        return true; // Valid cached data was loaded
      }
      return false; // No cached user data
    } catch (error) {
      console.error('AuthContext Error: Failed to load cached auth data:', error);
      return false;
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

            // Create or update session for this user
            try {
              const sessionToken = `session_${userData.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const deviceInfo = await import('@/server/userSessions').then(m => m.getDeviceInfo(navigator.userAgent));
              await createOrUpdateSession(userData.id, sessionToken, deviceInfo);
              
              // Store session token in localStorage for validation
              localStorage.setItem(`session_${userData.id}`, sessionToken);
            } catch (sessionError) {
              console.warn('Failed to create/update session:', sessionError);
            }

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

            // Create or update session for this user
            try {
              const sessionToken = `session_${userData.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const deviceInfo = await import('@/server/userSessions').then(m => m.getDeviceInfo(navigator.userAgent));
              await createOrUpdateSession(userData.id, sessionToken, deviceInfo);
              
              // Store session token in localStorage for validation
              localStorage.setItem(`session_${userData.id}`, sessionToken);
            } catch (sessionError) {
              console.warn('Failed to create/update session:', sessionError);
            }

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
      devLog.log('AuthContext: Initializing authentication...');
      setIsLoading(true);
      
      // Attempt to load cached data immediately for faster initial render
      const hasValidCachedData = await loadCachedData();
      
      // Only proceed with fresh authentication if no valid cached data exists
      if (!hasValidCachedData) {
        try {
          const kidSessionToken = getCookie('kid_session_token') as string | undefined;
          const kidId = getCookie('kid_id') as string | undefined;
          const kidAddress = getCookie('kid_address') as string | undefined;

          if (kidSessionToken && kidId && kidAddress) {
            devLog.log('AuthContext: Kid cookies found, attempting kid auth.');
            // Kid auth flow (primarily via cookies)
            await fetchAndSetUserState(kidAddress, kidId);
            // Role is set within fetchAndSetUserState based on server response
          } else if (isConnected && address) {
            devLog.log(`AuthContext: Wallet connected (${address}), attempting parent auth.`);
            // Parent auth flow (via wallet connection)
            await fetchAndSetUserState(address);
            // Role is set within fetchAndSetUserState based on server response
          } else {
            devLog.log('No auth state found (cookies or wallet). Resetting state.');
            // No auth state found
            resetAuthState(); // Ensure state is clean
          }
        } catch (error) {
          devLog.error('Exception during initial auth check:', error);
          resetAuthState(); // Ensure state is clean on error
        }
      } else {
        devLog.log('Valid cached data loaded, skipping fresh authentication.');
      }
      
      // Ensure isLoading is set to false in the end only if component is still mounted
      if (isMounted) {
        devLog.log('Initialization finished.');
        setIsLoading(false);
      }
    };

    // Execute the initialization
    initializeAuth();

    // Cleanup function
    return () => {
      isMounted = false; // Set flag to false on unmount
      devLog.log('Initial auth effect cleanup.');
    };
  }, [address, isConnected, loadCachedData, fetchAndSetUserState, setRole, resetAuthState]); // Dependencies: react to wallet changes and initial mount

  // --- Caching Effect (Reacts to state changes after initial load) ---
  useEffect(() => {
    // Cache data whenever user or childrenData state changes *after* the initial load
    // This catches updates like completing onboarding or refreshing children
    // Only cache if user is actually authenticated (user object exists)
    if (!isLoading && user) {
      devLog.log('User/children data changed, updating cache.');
      cacheAuthData(user, childrenData);
    } else if (!isLoading && !user) {
      // If not loading and user is null, ensure cache is cleared
      devLog.log('User is null, clearing cache.');
      cacheAuthData(null, []);
    }
  }, [user, childrenData, cacheAuthData, isLoading]);

  // --- Redirect Effect ---
  useEffect(() => {
    // Redirect once initial auth loading completes
    if (isLoading) {
      devLog.log('AuthContext: Redirect effect awaiting auth completion.');
      return;
    }
    // Handle return path after signin
    const searchParams = new URLSearchParams(window.location.search);
    const nextPath = searchParams.get('next');
    if (user && nextPath) {
      devLog.log('Redirecting to next path', nextPath);
      router.replace(nextPath);
      return;
    }
    const currentPath = pathname;
    const isPublic = isPublicRoute(currentPath || '');
    if (!user) {
      // Not authenticated: only redirect when no wallet connection
      if (!isPublic && !(address && isConnected)) {
        devLog.log('Redirecting unauthenticated user to signin.');
        router.push(`/signin?next=${currentPath}`);
      }
    } else {
      // Authenticated user
      if (isPublic) {
        // On signin page: send to home
        devLog.log('Redirecting authenticated user from signin to home.');
        router.push('/');
      } else if (user.role === 'parent' && needsOnboarding && currentPath !== '/onboarding') {
        devLog.log('Redirecting parent to onboarding page.');
        router.push('/onboarding');
      } else if (user.role === 'parent' && !needsOnboarding && currentPath === '/onboarding') {
        devLog.log('Redirecting parent from onboarding to home.');
        router.push('/');
      } else {
        devLog.log('No redirect needed.');
      }
    }
  }, [isLoading, user, needsOnboarding, pathname, router, address, isConnected]);

  // --- Wallet Events (Optional logging, remove if not needed) ---
  useAccountEffect({
    onConnect(data) {
      devLog.log('Wallet Connected!', data.address);
      // Note: fetchAndSetUserState is already called in the main useEffect
      // No need to call it again here to avoid duplicate sessions
    },
    onDisconnect() {
      devLog.log('Wallet Disconnected!');
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
      devLog.log('Skipping stable balance config due to missing/invalid addresses.');
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
    refetch: refetchBalance,
  } = useReadContracts({
    contracts: contractConfig?.contracts || [],
    allowFailure: false,
  });

  // Refetch balance when balanceVersion changes
  useEffect(() => {
    if (contractConfig) {
      refetchBalance();
    }
  }, [balanceVersion, contractConfig, refetchBalance]);

  // Update stable balance when contract read data changes
  useEffect(() => {
    devLog.log('Stable balance effect running', {
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
          devLog.log('Stable balance updated');
        } else {
          devLog.warn('Stable balance data incomplete or wrong type');
          setStableBalance(null); // Reset if data is incomplete or wrong type
        }
      } catch (error) {
        devLog.error('Exception calculating stable balance:', error);
        setStableBalance(null); // Reset on calculation error
      }
    } else if (!isBalanceLoading && balanceError) {
      devLog.error('AuthContext Error: Reading stable balance contract failed:', balanceError);
      setStableBalance(null); // Reset on read error
    } else if (!contractConfig) {
      devLog.log('Contract config is null, clearing stable balance.');
      setStableBalance(null); // Reset if contract config becomes null
    }
  }, [balanceData, isBalanceLoading, balanceError, contractConfig]);

  // --- ACTIONS ---
  // Simplified login function for Kid flow (called from SignInPage after code/QR auth)
  const login = useCallback(
    async (kidId: string, kidAddress: string) => {
      devLog.log(`AuthContext: Initiating kid login for id: ${kidId}, address: ${kidAddress}`);
      // Set kid cookies (AuthContext initializes based on these)
      setCookie('kid_session_token', `kid_${kidId}_${Date.now()}`, { maxAge: 365 * 24 * 60 * 60 }); // 1 year
      setCookie('kid_id', kidId, { maxAge: 365 * 24 * 60 * 60 });
      setCookie('kid_address', kidAddress, { maxAge: 365 * 24 * 60 * 60 });

      // Trigger state update by fetching user data for the kid's address
      // This lets the main effect and redirect effect handle navigation
      // No need to set global isLoading here, fetchAndSetUserState will handle its own state updates
      await fetchAndSetUserState(kidAddress, kidId); // Use the internal handler
      devLog.log('Kid login process finished');
    },
    [fetchAndSetUserState]
  ); // Dependency: the state-setting handler

  const logout = useCallback(() => {
    devLog.log('Logging out...');

    // Clear session tokens from localStorage
    if (user?.id) {
      localStorage.removeItem(`session_${user.id}`);
    }

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
      devLog.log('Disconnecting wallet...');
      disconnect();
    }

    // Reset all auth state
    resetAuthState();
    devLog.log('State reset, redirecting to signin');

    // Redirect to signin
    router.push('/signin');
  }, [disconnect, isConnected, resetAuthState, router, user?.id]);

  // generateKidToken seems like a utility function, perhaps move out of context?
  // Keeping it for now but consider if it truly needs to be here.
  const generateKidToken = (kidId: string, kidName: string) => {
    devLog.log(`AuthContext: Generating kid token for ${kidName} (${kidId})`);
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
      devLog.log(`AuthContext: Manually setting user role to ${newRole}`);
      setRole(newRole); // Update RoleProvider state
      // Note: This doesn't re-fetch user data. If switching roles requires re-auth/re-fetch,
      // additional logic would be needed here or after calling this.
    },
    [setRole]
  );

  const completeOnboarding = useCallback(() => {
    devLog.log('AuthContext: Completing onboarding.');
    setNeedsOnboarding(false);
    // Update user state immediately locally
    if (user) {
      const updatedUser = { ...user, needsOnboarding: false };
      setUser(updatedUser);
      // Also update cache
      cacheAuthData(updatedUser, childrenData);
    } else {
      devLog.warn('AuthContext Warning: completeOnboarding called but user is null.');
      // This case shouldn't happen if they are completing onboarding, but handle defensively
      cacheAuthData(null, childrenData);
    }
  }, [user, childrenData, cacheAuthData]);

  const refreshChildren = useCallback(async () => {
    if (user?.role === 'parent' && user.id) {
      devLog.log(`AuthContext: Refreshing children for parent ${user.id}`);
      try {
        const childrenRes = await getChildrenForParent(user.id);
        if (childrenRes.status >= 200 && childrenRes.status < 300) {
          const fetchedChildren = childrenRes.data || [];
          //@ts-ignore
          setChildrenData(fetchedChildren);
          devLog.log('AuthContext: Children data refreshed successfully.');
          // Update the cache after refreshing
          //@ts-ignore
          cacheAuthData(user, fetchedChildren);
        } else {
          devLog.error(
            'AuthContext Error: Failed to refresh children data:',
            childrenRes.status,
            childrenRes.message
          );
        }
      } catch (error) {
        devLog.error('Exception refreshing children data:', error);
      }
    } else {
      devLog.warn('refreshChildren called but user is not a parent or user ID is missing');
    }
  }, [user, cacheAuthData]); // Depends on user to know which parent's children to fetch

  // Track last refresh time to prevent rapid refreshes
  const lastRefreshTime = React.useRef(0);
  const REFRESH_COOLDOWN_MS = 3000; // 3 second cooldown between refreshes

  const refreshBalance = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshTime.current > REFRESH_COOLDOWN_MS) {
      devLog.log('Refreshing stable balance');
      lastRefreshTime.current = now;
      setBalanceVersion(v => v + 1);
    } else {
      devLog.log('Refresh request throttled');
    }
  }, []);

  // --- Memoized Context Value ---
  const contextValue = useMemo(
    () => ({
      user,
      family: user?.family || null,
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
