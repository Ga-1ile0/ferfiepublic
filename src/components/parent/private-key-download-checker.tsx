'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/authContext';
import { getChildrenNeedingKeyDownload } from '@/server/kids';
import { DownloadPrivateKeyDialog } from '@/components/dialogs/download-private-key-dialog';

type WalletKeyInfo = {
  id: string; // Can be childId or 'family' for family wallet
  name: string;
  privateKey: string;
  type: 'child' | 'family';
};

export function PrivateKeyDownloadChecker() {
  const { user } = useAuth();
  const [walletsNeedingDownload, setWalletsNeedingDownload] = useState<WalletKeyInfo[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Check for wallets needing private key download when component mounts
  useEffect(() => {
    const checkForPendingDownloads = async () => {
      if (!user || user.role !== 'parent' || !user.id || isChecking) return;

      try {
        setIsChecking(true);
        const result = await getChildrenNeedingKeyDownload(user.id);

        let walletsToDownload: WalletKeyInfo[] = [];

        // Add children needing download
        if (result.status === 200 && result.data && result.data.length > 0) {
          // Convert the API response to match our expected type
          const childWallets = result.data.map(child => ({
            // @ts-ignore
            id: child.id,
            // @ts-ignore
            name: child.name || 'Child', // Provide default in case name is null
            // @ts-ignore
            privateKey: child.privateKey || '', // Provide default in case privateKey is null
            type: 'child' as const,
          }));

          walletsToDownload = [...childWallets];
        }

        // Add family wallet (parent's private key) if available
        if (user.privateKey) {
          walletsToDownload.push({
            id: 'family',
            name: 'Family Wallet',
            privateKey: user.privateKey,
            type: 'family' as const,
          });
        }

        // If we have wallets to download, show the dialog
        if (walletsToDownload.length > 0) {
          setWalletsNeedingDownload(walletsToDownload);
          setShowDialog(true);
        }
      } catch (error) {
        console.error('Error checking for pending private key downloads:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkForPendingDownloads();
  }, [user]);

  const handleDownloadComplete = () => {
    // Clear wallets needing download and close dialog
    setWalletsNeedingDownload([]);
    setShowDialog(false);
  };

  // Don't render anything visible, this is just a checker component
  if (walletsNeedingDownload.length === 0) return null;

  return (
    <DownloadPrivateKeyDialog
      open={showDialog}
      onOpenChange={setShowDialog}
      wallets={walletsNeedingDownload}
      onDownloadComplete={handleDownloadComplete}
    />
  );
}
