'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/authContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/components/ui/use-toast';
import { TokenType } from '@prisma/client';
import { createChildWithWallet } from '@/server/kids';
import { getFamilyPrivateKey, updateFamilyCurrency } from '@/server/family';
import { updateUserName } from '@/server/user';
import { DownloadPrivateKeyDialog } from '@/components/dialogs/download-private-key-dialog';

type OnboardingStep = 'welcome' | 'profile' | 'currency' | 'family' | 'children' | 'complete';

interface ChildInfo {
  name: string;
  walletType: 'new' | 'import';
  privateKey?: string;
  id?: string; // Added for tracking created children
}

export function ParentOnboarding() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [parentName, setParentName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<TokenType>('USDC');
  const [childName, setChildName] = useState('');
  const [walletType, setWalletType] = useState<'new' | 'import'>('new');
  const [privateKey, setPrivateKey] = useState('');
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyDownloadDialog, setShowKeyDownloadDialog] = useState(false);
  const [walletsForDownload, setWalletsForDownload] = useState<
    Array<{
      id: string;
      name: string;
      privateKey: string;
      type: 'child' | 'family';
    }>
  >([]);

  const { user, completeOnboarding } = useAuth();
  const router = useRouter();

  // If user is already onboarded, redirect to dashboard
  useEffect(() => {
    // Only redirect if user is fully onboarded (has name AND needsOnboarding is false)
    if (user?.name && !user?.needsOnboarding) {
      router.push('/');
    }
  }, [user, router]);

  const handleNextStep = () => {
    const steps: OnboardingStep[] = [
      'welcome',
      'profile',
      'currency',
      'family',
      'children',
      'complete',
    ];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handlePreviousStep = () => {
    const steps: OnboardingStep[] = [
      'welcome',
      'profile',
      'currency',
      'family',
      'children',
      'complete',
    ];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleAddChild = () => {
    if (!childName) {
      toast({
        title: 'Error',
        description: 'Please enter a name for your child',
        variant: 'destructive',
      });
      return;
    }

    if (walletType === 'import' && !privateKey) {
      toast({
        title: 'Error',
        description: 'Please enter a private key',
        variant: 'destructive',
      });
      return;
    }

    const newChild: ChildInfo = {
      name: childName,
      walletType,
      ...(walletType === 'import' && { privateKey }),
    };

    setChildren([...children, newChild]);
    setChildName('');
    setPrivateKey('');
    setWalletType('new');
  };

  const handleRemoveChild = (index: number) => {
    const updatedChildren = [...children];
    updatedChildren.splice(index, 1);
    setChildren(updatedChildren);
  };

  const handleCompleteOnboarding = async () => {
    if (!user?.id) {
      toast({
        title: 'Error',
        description: 'User not authenticated',
        variant: 'destructive',
      });
      router.push('/');
      return;
    }

    setIsLoading(true);

    try {
      // Update user name
      const nameResult = await updateUserName(user.id, parentName);
      if (nameResult.status !== 200) {
        throw new Error(nameResult.message || 'Failed to update user name');
      }

      // Update family currency
      if (user.familyId) {
        let currencyAddress = '';
        switch (selectedCurrency) {
          case 'USDC':
            currencyAddress = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
            break;
          case 'EURC':
            currencyAddress = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42';
            break;
          case 'CADC':
            currencyAddress = '0x043eb4b75d0805c43d7c834902e335621983cf03';
            break;
          case 'BRZ':
            currencyAddress = '0xE9185Ee218cae427aF7B9764A011bb89FeA761B4';
            break;
          case 'IDRX':
            currencyAddress = '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22';
            break;
          default:
            throw new Error('Unsupported currency selected');
        }

        const currencyResult = await updateFamilyCurrency(
          user.familyId,
          selectedCurrency,
          currencyAddress
        );
        if (currencyResult.status !== 200) {
          throw new Error(currencyResult.message || 'Failed to update family currency');
        }
      }

      // Clear any previous wallets
      setWalletsForDownload([]);
      console.log('getting/checking family private key');
      const family = await getFamilyPrivateKey(user.id);
      console.log('family status:', family.status);
      // Add family wallet if available
      if (family.status === 200 && family.data?.privateKey) {
        console.log('Family private key: success');
        const familyWallet = {
          id: 'family',
          name: 'Family Wallet',
          privateKey: family.data.privateKey, // This is a string because we checked above
          type: 'family' as const,
        };

        setWalletsForDownload(prevWallets => [...prevWallets, familyWallet]);
        console.log('Family wallet added to download list', walletsForDownload);
      }

      // Create children
      let hasWalletsToDownload = user.privateKey ? true : false;
      for (const child of children) {
        if (!user.walletAddress) continue;

        const childResult = await createChildWithWallet(
          child.name,
          user.walletAddress,
          child.walletType === 'import' ? { privateKey: child.privateKey || '' } : undefined
        );

        if (
          childResult.status === 200 &&
          childResult.data &&
          'privateKey' in childResult.data &&
          childResult.data.privateKey
        ) {
          // Add child wallet to the list for download
          hasWalletsToDownload = true;
          setWalletsForDownload(prevWallets => [
            ...prevWallets,
            {
              id: 'id' in childResult.data ? childResult.data.id : 'child',
              name: 'name' in childResult.data ? childResult.data.name || child.name : child.name,
              privateKey: childResult.data.privateKey || '',
              type: 'child' as const,
            },
          ]);
        } else {
          toast({
            title: 'Warning',
            description: `Failed to create child ${child.name}: ${childResult.message || 'Unknown error'}`,
            variant: 'destructive',
          });
        }
      }

      // If we have wallets to download, show the dialog
      if (hasWalletsToDownload) {
        console.log('showing key download dialog');
        setShowKeyDownloadDialog(true);
        // We'll complete onboarding after key download
        console.log('completing onboarding');

        return;
      }

      // If no wallets to download, complete onboarding now
      toast({
        title: 'Success',
        description: 'Onboarding completed successfully!',
      });

      // Redirect to dashboard
      console.log('redirecting to dashboard no wallets for download');
      router.push('/');
    } catch (error) {
      console.error('Onboarding error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDownloadComplete = () => {
    console.log('key download complete');
    setShowKeyDownloadDialog(false);
    setWalletsForDownload([]);
    completeOnboarding();

    // Complete onboarding
    toast({
      title: 'Success',
      description: 'Onboarding completed successfully!',
    });

    // Redirect to dashboard
    console.log('redirecting to dashboard after key download');
    router.push('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        {currentStep === 'welcome' && (
          <>
            <CardHeader>
              <CardTitle>Welcome to ferfie!</CardTitle>
              <CardDescription>Let's set up your family account to get started.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>This quick onboarding process will help you:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Set up your profile</li>
                <li>Choose your preferred currency</li>
                <li>Create your family</li>
                <li>Add your children</li>
              </ul>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleNextStep}>Get Started</Button>
            </CardFooter>
          </>
        )}

        {currentStep === 'profile' && (
          <>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>Tell us a bit about yourself.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="parentName">Your Name</Label>
                <Input
                  id="parentName"
                  placeholder="Enter your name"
                  value={parentName}
                  onChange={e => setParentName(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handlePreviousStep}>
                Back
              </Button>
              <Button onClick={handleNextStep} disabled={!parentName}>
                Next
              </Button>
            </CardFooter>
          </>
        )}

        {currentStep === 'currency' && (
          <>
            <CardHeader>
              <CardTitle>Select Currency</CardTitle>
              <CardDescription>Choose the default currency for your family.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup
                value={selectedCurrency}
                onValueChange={value => setSelectedCurrency(value as TokenType)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="USDC" id="usdc" />
                  <Label htmlFor="usdc">USDC (United States Dollar)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EURC" id="eurc" />
                  <Label htmlFor="eurc">EURC (Euro)</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CADC" id="cadc" />
                  <Label htmlFor="cadc">CADC (Canadian Dollar)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="BRZ" id="brz" />
                  <Label htmlFor="brz">BRZ (Brazilian Reais)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="IDRX" id="idrx" />
                  <Label htmlFor="idrx">IDRX (Indonesian Rupiah)</Label>
                </div>
              </RadioGroup>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handlePreviousStep}>
                Back
              </Button>
              <Button onClick={handleNextStep}>Next</Button>
            </CardFooter>
          </>
        )}

        {currentStep === 'family' && (
          <>
            <CardHeader>
              <CardTitle>Create Your Family</CardTitle>
              <CardDescription>Give your family a name.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="familyName">Family Name</Label>
                <Input
                  id="familyName"
                  placeholder="Enter family name"
                  value={familyName}
                  onChange={e => setFamilyName(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handlePreviousStep}>
                Back
              </Button>
              <Button onClick={handleNextStep} disabled={!familyName}>
                Next
              </Button>
            </CardFooter>
          </>
        )}

        {currentStep === 'children' && (
          <>
            <CardHeader>
              <CardTitle>Add Children</CardTitle>
              <CardDescription>Add your children to your family account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="childName">Child's Name</Label>
                <Input
                  id="childName"
                  placeholder="Enter child's name"
                  value={childName}
                  onChange={e => setChildName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Wallet Setup</Label>
                {/* @ts-ignore */}
                <RadioGroup value={walletType} onValueChange={setWalletType}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="new" />
                    <Label htmlFor="new">Generate new wallet</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="import" id="import" />
                    <Label htmlFor="import">Import existing wallet</Label>
                  </div>
                </RadioGroup>
              </div>

              {walletType === 'import' && (
                <div className="space-y-2">
                  <Label htmlFor="privateKey">Private Key</Label>
                  <Input
                    id="privateKey"
                    placeholder="Enter private key"
                    value={privateKey}
                    onChange={e => setPrivateKey(e.target.value)}
                    type="password"
                  />
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleAddChild}
                disabled={!childName}
              >
                Add Child
              </Button>

              {children.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Children:</h3>
                  <ul className="space-y-2">
                    {children.map((child, index) => (
                      <li
                        key={index}
                        className="flex justify-between items-center p-2 bg-secondary rounded-md"
                      >
                        <span>{child.name}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveChild(index)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handlePreviousStep}>
                Back
              </Button>
              <Button onClick={handleNextStep}>Next</Button>
            </CardFooter>
          </>
        )}

        {currentStep === 'complete' && (
          <>
            <CardHeader>
              <CardTitle>Complete Setup</CardTitle>
              <CardDescription>Review your information and complete the setup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Your Name:</h3>
                <p className="text-sm">{parentName}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Family Name:</h3>
                <p className="text-sm">{familyName}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Default Currency:</h3>
                <p className="text-sm">{selectedCurrency}</p>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Children:</h3>
                {children.length > 0 ? (
                  <ul className="text-sm">
                    {children.map((child, index) => (
                      <li key={index}>{child.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm">No children added</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handlePreviousStep}>
                Back
              </Button>
              <Button onClick={handleCompleteOnboarding} disabled={isLoading}>
                {isLoading ? 'Setting Up...' : 'Complete Setup'}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>

      {/* Private Key Download Dialog */}
      {walletsForDownload.length > 0 && (
        <DownloadPrivateKeyDialog
          open={showKeyDownloadDialog}
          onOpenChange={setShowKeyDownloadDialog}
          wallets={walletsForDownload}
          onDownloadComplete={() => handleKeyDownloadComplete()}
        />
      )}
    </div>
  );
}
