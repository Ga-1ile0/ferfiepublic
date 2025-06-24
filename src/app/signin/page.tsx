'use client';
import { useState, useEffect, useCallback } from 'react';

type ChildAuthResponse = {
  status: number;
  data?: {
    childId: string;
    child: {
      address: string;
    };
  };
  message?: string;
};
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QrScanner } from '@/components/shared/qr-scanner';
import { Wallet, QrCode, User, Users, AlertCircle, LogOut } from 'lucide-react';
import { WalletModal } from '@coinbase/onchainkit/wallet';
import { useAuth } from '@/contexts/authContext';
import { validateChildAuthCode, validateChildAuthQR } from '@/server/childAuth';
import { setCookie } from 'cookies-next';
import { useAccount } from 'wagmi';
import { Static } from '@/components/Static';

export default function SignInPage() {
  const [showQrScanner, setShowQrScanner] = useState(false);

  const [uiUserType, setUiUserType] = useState<'parent' | 'kid'>('parent');
  const [isAuthenticatingKid, setIsAuthenticatingKid] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const { login, logout, user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { address, isConnected } = useAccount();

  const handleKidCodeAuth = useCallback(
    async (code: string) => {
      const cleanCode = code.replace(/\s/g, '');
      if (cleanCode.length !== 8 || isAuthenticatingKid) return; // Prevent multiple attempts

      setIsAuthenticatingKid(true);
      setAuthError(null);

      try {
        // Add delay to prevent brute force
        await new Promise(resolve => setTimeout(resolve, 200));
        const result = (await validateChildAuthCode(cleanCode)) as ChildAuthResponse;

        if (result.status === 200 && result.data) {
          setCookie('kid_address', result.data.child.address, { maxAge: 365 * 24 * 60 * 60 });
          login(result.data.childId, result.data.child.address);
        } else {
          if (result.message === 'This code has already been used') {
            setAuthError(
              'This sign-in code has already been used. Please request a new one from your parent.'
            );
          } else {
            setAuthError(result.message || 'Invalid or expired code');
          }
        }
      } catch (error) {
        console.error('Error authenticating with code:', error);
        setAuthError('An unexpected error occurred during code authentication.');
      } finally {
        setIsAuthenticatingKid(false);
      }
    },
    [login, isAuthenticatingKid]
  );

  const handleQrCodeResult = useCallback(
    async (result: string) => {
      setShowQrScanner(false);
      setIsAuthenticatingKid(true);
      setAuthError(null);

      try {
        const validationResult = (await validateChildAuthQR(result)) as ChildAuthResponse;

        if (validationResult.status === 200 && validationResult.data) {
          setCookie('kid_address', validationResult.data.child.address, {
            maxAge: 365 * 24 * 60 * 60,
          });
          login(validationResult.data.childId, validationResult.data.child.address);
        } else if (validationResult.message === 'This code has already been used') {
          setAuthError(
            'This QR code has already been used. Please request a new one from your parent.'
          );
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
  );

  // Format 8-digit code with space after 4 digits
  const formatCodeInput = (value: string) => {
    const digits = value.replace(/\D/g, '');

    if (digits.length > 4) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
    }
    return digits;
  };

  // Handle 8-digit code input with formatting
  useEffect(() => {
    const inputElement = document.getElementById(`${uiUserType}-otp`) as HTMLInputElement;
    if (inputElement) {
      const handler = (event: Event) => {
        const target = event.target as HTMLInputElement;
        const cursorPosition = target.selectionStart || 0;
        const inputValue = target.value;

        const rawValue = inputValue.replace(/\s/g, '');

        // Format the value with space
        const formattedValue = formatCodeInput(rawValue);

        target.value = formattedValue;

        // Handle cursor position for formatted input
        if (cursorPosition === 5 && inputValue.length < formattedValue.length) {
          // If we just added a space, move cursor after it
          target.setSelectionRange(cursorPosition + 1, cursorPosition + 1);
        } else if (cursorPosition === 4 && inputValue.length > formattedValue.length) {
          // If we just removed a space, keep cursor at position 4
          target.setSelectionRange(cursorPosition - 1, cursorPosition - 1);
        } else {
          // Otherwise, try to maintain cursor position
          const newCursorPosition =
            cursorPosition > 4 && inputValue.length < formattedValue.length
              ? cursorPosition + 1
              : cursorPosition > 4 && inputValue.length > formattedValue.length
                ? cursorPosition - 1
                : cursorPosition;
          target.setSelectionRange(newCursorPosition, newCursorPosition);
        }

        // Only attempt auth if code is complete
        if (uiUserType === 'kid' && rawValue.length === 8) {
          // Add delay to prevent brute force
          const timeout = setTimeout(() => {
            handleKidCodeAuth(rawValue);
          }, 200);

          return () => clearTimeout(timeout);
        }
      };

      inputElement.addEventListener('input', handler);
      return () => {
        inputElement.removeEventListener('input', handler);
      };
    }
  }, [uiUserType, handleKidCodeAuth]); // Re-attach handler when user type changes

  if (isAuthLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="container flex items-center justify-center min-h-screen min-w-screen px-4 py-8">
      <div className="fixed left-0 top-0 -z-10 h-screen w-full">
        <Static />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex justify-center">
            Welcome!{' '}
            {isConnected ? (
              <LogOut onClick={logout} className="text-red-800 hover:cursor-pointer" />
            ) : null}
          </CardTitle>
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
                  <Button
                    className="w-full flex border rounded-md items-center justify-center gap-2"
                    onClick={() => setIsWalletModalOpen(true)}
                  >
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </Button>
                  <WalletModal
                    isOpen={isWalletModalOpen}
                    onClose={() => setIsWalletModalOpen(false)}
                    className="bg-black/80 rounded-xl"
                  />
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
                      placeholder="1234 5678"
                      maxLength={9} // 8 digits + 1 space
                      className="text-center text-lg tracking-widest"
                      disabled={isAuthenticatingKid} // Disable input while authenticating
                      // Format the value with space as user types
                      onKeyDown={e => {
                        // Allow paste shortcuts (Ctrl+V/Cmd+V)
                        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                          return; // Allow default paste behavior
                        }

                        // Allow numbers, backspace, delete, tab, and navigation keys
                        if (
                          !/^[0-9\b]$/.test(e.key) &&
                          ![
                            'Backspace',
                            'Delete',
                            'Tab',
                            'ArrowLeft',
                            'ArrowRight',
                            'ArrowUp',
                            'ArrowDown',
                            'Home',
                            'End',
                          ].includes(e.key)
                        ) {
                          e.preventDefault();
                        }
                      }}
                      // Add onPaste handler to clean up pasted content
                      onPaste={e => {
                        e.preventDefault();
                        const pastedText = e.clipboardData.getData('text/plain');
                        const cleanText = pastedText.replace(/\D/g, ''); // Remove non-digits

                        // Get current input value and cursor position
                        const input = e.target as HTMLInputElement;
                        const startPos = input.selectionStart || 0;
                        const endPos = input.selectionEnd || 0;
                        const currentValue = input.value.replace(/\s/g, '');

                        // Insert pasted text at cursor position
                        const newValue =
                          currentValue.substring(0, startPos) +
                          cleanText +
                          currentValue.substring(endPos);

                        // Format and update input value
                        const formattedValue = formatCodeInput(newValue.substring(0, 8));
                        input.value = formattedValue;

                        // Trigger input event to handle authentication if needed
                        if (
                          uiUserType === 'kid' &&
                          formattedValue.replace(/\s/g, '').length === 8
                        ) {
                          handleKidCodeAuth(formattedValue.replace(/\s/g, ''));
                        }
                      }}
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
