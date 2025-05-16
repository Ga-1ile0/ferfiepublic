'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { markPrivateKeyDownloaded } from '@/server/kids';
import { AlertTriangle, Download, KeyRound } from 'lucide-react';

interface WalletKeyInfo {
  id: string; // Can be childId or 'family' for family wallet
  name: string;
  privateKey: string;
  type: 'child' | 'family';
}

interface DownloadPrivateKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: WalletKeyInfo[];
  onDownloadComplete: () => void;
}

export function DownloadPrivateKeyDialog({
  open,
  onOpenChange,
  wallets,
  onDownloadComplete,
}: DownloadPrivateKeyDialogProps) {
  const [confirmDownload, setConfirmDownload] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!confirmDownload) {
      toast({
        title: 'Confirmation Required',
        description: 'Please confirm that you understand the importance of saving the private keys',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsDownloading(true);

      // Format the private keys with labels
      const formattedKeys = wallets
        .map(wallet => `${wallet.name}:${wallet.privateKey}`)
        .join('\n\n');

      // Create a blob with all private keys
      const blob = new Blob([formattedKeys], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `ferfiefam_wallet_private_keys.txt`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Mark all child wallets as downloaded in the database
      const childWallets = wallets.filter(w => w.type === 'child');

      if (childWallets.length > 0) {
        await Promise.all(
          childWallets.map(async wallet => {
            return markPrivateKeyDownloaded(wallet.id);
          })
        );
      }

      toast({
        title: 'Success',
        description: 'Private keys downloaded successfully',
      });

      // Auto-close the dialog after successful download
      onDownloadComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error downloading private keys:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Important: Download Private Keys
          </DialogTitle>
          <DialogDescription>
            You must download and securely store the private keys for{' '}
            {wallets.map(w => w.name).join(', ')}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">Important Security Warning</h3>
                <div className="mt-2 text-sm text-amber-700">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>This is the ONLY time you can download these private keys.</li>
                    <li>Anyone with these keys has FULL access to the wallet funds.</li>
                    <li>Store them in a secure offline place.</li>
                    <li>ferfie cannot recover these keys if you lose them.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="confirm-download"
              checked={confirmDownload}
              onCheckedChange={checked => setConfirmDownload(checked as boolean)}
            />
            <Label
              htmlFor="confirm-download"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I understand that this is the only time I can download these private keys and I will
              store them securely.
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => handleDownload()}
            disabled={isDownloading || !confirmDownload}
            className="gap-2 w-full"
          >
            {isDownloading ? (
              'Downloading...'
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                Download Private Keys
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
