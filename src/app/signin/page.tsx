'use client';
import { useState, useEffect, useCallback } from 'react'; // Import useCallback
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QrScanner } from '@/components/shared/qr-scanner'; // Assuming QrScanner is correct
import { Wallet, QrCode, User, Users, AlertCircle } from 'lucide-react';
import { ConnectWallet } from '@coinbase/onchainkit/wallet'; // Assuming ConnectWallet is correct
import { useAuth } from '@/contexts/authContext'; // Import useAuth
import { validateChildAuthCode, validateChildAuthQR } from '@/server/childAuth'; // Assuming server functions are correct
import { setCookie } from 'cookies-next'; // Keep setCookie for initial setting before AuthContext takes over
import { useAccount } from 'wagmi'; // Import useAccount
import { Static } from '@/components/Static';

export default function SignInPage() {
  const [showQrScanner, setShowQrScanner] = useState(false);
  // User type is mainly for UI tab state, AuthContext manages actual role
  const [uiUserType, setUiUserType] = useState<'parent' | 'kid'>('parent');
  const [isAuthenticatingKid, setIsAuthenticatingKid] = useState(false); // Specific loading state for kid auth methods
  const [authError, setAuthError] = useState<string | null>(null);

  // Get auth state and actions from AuthContext
  const { login, user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  // Get wagmi account state (needed for ConnectWallet interactions)
  const { address, isConnected } = useAccount();

  // IMPORTANT: No useEffect here watching 'address' to redirect!
  // AuthContext handles authentication and redirection based on `address` changing.

  // Handle authentication with 8-digit code
  const handleKidCodeAuth = useCallback(
    async (code: string) => {
      if (code.length !== 8 || isAuthenticatingKid) return; // Prevent multiple attempts

      setIsAuthenticatingKid(true);
      setAuthError(null);

      try {
        const result = await validateChildAuthCode(code);

        if (result.status === 200 && result.data) {
          // Cookies will be set *inside* the AuthContext's login function now
          // Set kid_address cookie immediately here, as AuthContext login needs it
          setCookie('kid_address', result.data.child.address, { maxAge: 365 * 24 * 60 * 60 });

          // Call login from AuthContext - this will set other cookies and trigger auth state update
          login(result.data.childId, result.data.child.address);

          // AuthContext's redirect effect will handle navigation to / or /onboarding
        } else {
          setAuthError(result.message || 'Invalid or expired code');
        }
      } catch (error) {
        console.error('Error authenticating with code:', error);
        setAuthError('An unexpected error occurred during code authentication.');
      } finally {
        setIsAuthenticatingKid(false);
      }
    },
    [login, isAuthenticatingKid]
  ); // Dependencies: login action, local state

  // Handle QR code scan result
  const handleQrCodeResult = useCallback(
    async (result: string) => {
      setShowQrScanner(false); // Hide scanner after scan attempt
      setIsAuthenticatingKid(true);
      setAuthError(null);

      try {
        const validationResult = await validateChildAuthQR(result);

        if (validationResult.status === 200 && validationResult.data) {
          // Cookies will be set *inside* the AuthContext's login function now
          // Set kid_address cookie immediately here, as AuthContext login needs it
          setCookie('kid_address', validationResult.data.child.address, {
            maxAge: 365 * 24 * 60 * 60,
          });

          // Call login from AuthContext - this will set other cookies and trigger auth state update
          login(validationResult.data.childId, validationResult.data.child.address);

          // AuthContext's redirect effect will handle navigation to / or /onboarding
        } else {
          setAuthError(validationResult.message || 'Invalid QR code');
        }
      } catch (error) {
        console.error('Error processing QR code:', error);
        setAuthError('Failed to process QR code');
      } finally {
        setIsAuthenticatingKid(false);
      }
    },
    [login]
  ); // Dependencies: login action

  // Effect to handle the 8-character input change
  useEffect(() => {
    const inputElement = document.getElementById(`${uiUserType}-otp`) as HTMLInputElement;
    if (inputElement) {
      const handler = (event: Event) => {
        const code = (event.target as HTMLInputElement).value.replace(/\s/g, '');
        // Only attempt kid auth if the tab is 'kid' and code is complete
        if (uiUserType === 'kid' && code.length === 8) {
          handleKidCodeAuth(code);
        }
        // Optional: Add parent code handling here if needed
      };
      inputElement.addEventListener('input', handler);
      return () => {
        inputElement.removeEventListener('input', handler);
      };
    }
  }, [uiUserType, handleKidCodeAuth]); // Re-attach handler when user type changes

  // While AuthContext is loading or user is already authenticated,
  // we might show a loading spinner or just render nothing until AuthContext redirects.
  // For a Sign-In page, if isAuthenticated is true (meaning AuthContext already determined auth state),
  // AuthContext's redirect effect will send them away, so we don't need a complex loading state here.
  // However, showing a loading spinner if AuthContext is still determining state (isAuthLoading)
  // might prevent a brief flash of the sign-in form before redirect.
  if (isAuthLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>; // Or a better spinner
  }

  // If the user is already authenticated, AuthContext will handle the redirect.
  // We don't need to render the sign-in form.
  if (isAuthenticated) {
    return null; // Or a loading spinner, but AuthContext redirect should be fast
  }

  return (
    <div className="container flex items-center justify-center min-h-screen min-w-screen px-4 py-8">
      <div className="fixed left-0 top-0 -z-10 h-screen w-full">
        <Static /> {/* Assuming Static component is correct */}
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome!</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {authError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              <p className="text-sm">{authError}</p>
            </div>
          )}

          <Tabs
            defaultValue="parent"
            className="w-full"
            onValueChange={value => {
              setUiUserType(value as 'parent' | 'kid');
              setAuthError(null); // Clear error on tab change
              setShowQrScanner(false); // Hide scanner on tab change
            }}
          >
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="parent" className="flex items-center gap-2">
                <User size={16} />
                <span>Parent</span>
              </TabsTrigger>
              <TabsTrigger value="kid" className="flex items-center gap-2">
                <Users size={16} />
                <span>Kid</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="parent">
              {/* Parent Content */}
              {showQrScanner ? (
                <div className="space-y-4">
                  {/* QrScanner component needs to handle camera access */}
                  <QrScanner onResult={handleQrCodeResult} />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowQrScanner(false)}
                    disabled={isAuthenticatingKid}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Connect Wallet button - AuthContext handles wallet connection state */}
                  <ConnectWallet
                    className="w-full flex border rounded-md items-center justify-center gap-2"
                    // No need for onConnect - AuthContext reacts to address change
                  >
                    {/* ConnectWallet button content */}
                  </ConnectWallet>

                  {/* Optional: Parent QR or Code Login - implementation needed */}
                  {/* Keeping the fields but they currently point to kid handlers */}
                  {/* <Button
                     variant="outline"
                     className="w-full flex items-center justify-center gap-2"
                     onClick={() => setShowQrScanner(true)}
                     disabled={isAuthenticatingKid}
                   >
                     <QrCode size={16} />
                     Scan Parent QR (If applicable)
                   </Button>

                   <div className="space-y-2">
                     <Label htmlFor="parent-otp">Enter 8-character code (If applicable)</Label>
                     <Input
                       id="parent-otp"
                       placeholder="Enter code"
                       maxLength={8}
                       className="text-center text-lg tracking-widest"
                        // Add parent code handler here if needed
                     />
                   </div> */}
                </div>
              )}
            </TabsContent>

            <TabsContent value="kid">
              {/* Kid Content */}
              {showQrScanner ? (
                <div className="space-y-4">
                  {/* QrScanner component needs to handle camera access */}
                  <QrScanner onResult={handleQrCodeResult} />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowQrScanner(false)}
                    disabled={isAuthenticatingKid}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Kid Wallet Connect - Only if applicable to your kid flow */}
                  {/* <ConnectWallet
                    className="w-full flex border rounded-md items-center justify-center gap-2"
                    // If kid connects wallet, AuthContext will react
                  >
                      <Wallet size={16} />
                     Connect Kid Wallet (If applicable)
                  </ConnectWallet> */}

                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={() => setShowQrScanner(true)}
                    disabled={isAuthenticatingKid}
                  >
                    <QrCode size={16} />
                    Scan QR Code
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="kid-otp">Enter 8-character code</Label>
                    <Input
                      id="kid-otp" // ID used by useEffect listener
                      placeholder="Enter code"
                      maxLength={8}
                      className="text-center text-lg tracking-widest"
                      disabled={isAuthenticatingKid} // Disable input while authenticating
                      // onChange handler removed - replaced by useEffect listener
                    />
                    {isAuthenticatingKid && (
                      <p className="text-sm text-muted-foreground">Authenticating...</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
