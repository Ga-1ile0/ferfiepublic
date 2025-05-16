'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { createChildAuthCode } from '@/server/childAuth';
import { Loader2, RefreshCw } from 'lucide-react';
import Image from 'next/image';

interface ChildSignInContentProps {
  childId: string;
  childName: string;
}

export function ChildSignInContent({ childId, childName }: ChildSignInContentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authData, setAuthData] = useState<{
    code: string;
    qrCode: string;
    expiresAt: string;
  } | null>(null);

  const generateCode = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await createChildAuthCode(childId);
      if (result.status === 200) {
        // @ts-ignore
        setAuthData(result.data);
      } else {
        setError(result.message || 'Failed to generate authentication code');
      }
    } catch (err) {
      console.error('Error generating auth code:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate code on component mount
  useEffect(() => {
    generateCode();
  }, [childId]);

  // Format the expiration time
  const formatExpirationTime = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins <= 0) return 'Expired';
    return `Expires in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6 py-4">
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Generating sign-in code...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={generateCode} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
        </div>
      ) : authData ? (
        <>
          <div className="flex flex-col items-center justify-center">
            <div className="border-2 border-dashed rounded-lg p-2 bg-white">
              {/* Display QR code image */}
              <div className="w-48 h-48 relative">
                <img
                  src={authData.qrCode}
                  alt="QR Code for child sign-in"
                  className="w-full h-full"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Scan this QR code on your child's device
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Or enter this code</p>
              <div className="text-3xl font-bold tracking-widest">
                {authData.code.match(/.{1,4}/g)?.join(' ')}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {authData.expiresAt && formatExpirationTime(authData.expiresAt)}
              </p>
            </div>
          </div>

          <div className="flex justify-center mt-4">
            <Button onClick={generateCode} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-3 w-3" /> Generate New Code
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
