'use client';

import { devLog } from '@/lib/devlog';
import { useEffect, useState } from 'react';
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
import type { CheckedState } from '@radix-ui/react-checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { markPrivateKeyDownloaded } from '@/server/kids';
import { AlertTriangle, KeyRound, Copy as CopyIcon, CheckCircle, Loader2 } from 'lucide-react';

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

/**
 * Detects if the app is running in a wallet browser environment.
 * It prioritizes checking for window.ethereum, the standard for web3 providers,
 * and falls back to user agent sniffing for broader compatibility.
 */
const isWalletEnvironment = (): boolean => {
    if (typeof window === 'undefined') return false;

    // Primary, most reliable method: Check for an injected Ethereum provider (EIP-1193)
    if (typeof window.ethereum !== 'undefined') {
        return true;
    }

    // Fallback: Check for common wallet strings in the user agent. Less reliable.
    const walletUserAgents = [
        'Trust', 'MetaMask', 'CoinbaseWallet', 'WalletConnect', 'Rainbow',
        'imToken', 'Brave Wallet', 'TokenPocket', 'MathWallet', 'SafePal',
        'Tokenary', '1inch', 'Zerion', 'Rabby', 'Frame'
    ];
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    return walletUserAgents.some(wallet => userAgent.includes(wallet));
};

// Helper function to detect Safari browser
const isSafari = () => {
    // Check if running in browser
    if (typeof window === 'undefined') return false;

    // Test for Safari (including iOS)
    const ua = window.navigator.userAgent.toLowerCase();
    return (
        ua.includes('safari/') &&
        !ua.includes('chrome/') &&
        !ua.includes('edg/') &&
        !ua.includes('opr/') &&
        !ua.includes('firefox/')
    );
};

const handleCopyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        devLog.error('Failed to copy to clipboard:', error);
        return false;
    }
};

const handleDownloadFile = async (content: string, filename: string) => {
    try {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);

        await new Promise<void>((resolve) => {
            a.click();
            // Small delay to ensure the download starts
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                resolve();
            }, 100);
        });
        return true;
    } catch (error) {
        devLog.error('Download failed:', error);
        return false;
    }
};

export function DownloadPrivateKeyDialog({
    open,
    onOpenChange,
    wallets,
    onDownloadComplete,
}: DownloadPrivateKeyDialogProps) {
    const [confirmDownload, setConfirmDownload] = useState(false);
    const [isActionInProgress, setIsActionInProgress] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isWalletEnv, setIsWalletEnv] = useState(false);

    useEffect(() => {
        // We only run this detection logic on the client-side
        setIsWalletEnv(isWalletEnvironment());
    }, []);

    const handleAction = async () => {
        if (!confirmDownload) {
            toast({
                title: 'Confirmation Required',
                description: 'Please confirm that you understand the importance of saving the private keys.',
                variant: 'destructive',
            });
            return;
        }

        setIsActionInProgress(true);

        try {
            const formattedKeys = wallets
                .map(wallet => `${wallet.name}: ${wallet.privateKey}`)
                .join('\n\n');

            let success = false;

            // For Safari or wallet environments, use clipboard
            if (isSafari() || isWalletEnv) {
                success = await handleCopyToClipboard(formattedKeys);
                if (success) {
                    setIsCopied(true);
                    toast({
                        title: 'Copied to Clipboard',
                        description: 'Private keys have been copied. Please save them securely.',
                    });
                }
            } else {
                // For other browsers, try to download the file
                success = await handleDownloadFile(formattedKeys, 'ferfiefam_wallet_private_keys.txt');
                if (!success) {
                    // If download fails, fall back to clipboard
                    success = await handleCopyToClipboard(formattedKeys);
                    if (success) {
                        setIsCopied(true);
                        toast({
                            title: 'Copied to Clipboard',
                            description: 'Private keys have been copied. Please save them securely.',
                        });
                    }
                } else {
                    toast({
                        title: 'Download Started',
                        description: 'Your private keys file is downloading. You will be redirected shortly...',
                    });
                }
            }

            if (success) {
                // Mark wallets as downloaded after action is initiated
                const childWallets = wallets.filter(w => w.type === 'child');
                if (childWallets.length > 0) {
                    await Promise.all(
                        childWallets.map(wallet => markPrivateKeyDownloaded(wallet.id))
                    );
                }
                onDownloadComplete();
                // Close the dialog and notify parent
                onOpenChange(false);
            }
        } catch (error) {
            devLog.error('Error handling private keys:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
            toast({
                title: 'Error',
                description: `Could not complete the action. ${errorMessage}`,
                variant: 'destructive',
            });
            setIsActionInProgress(false);
        } finally {
            // Let the success/error states handle the loading state
            if (!isWalletEnv) {
                setIsActionInProgress(false);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-yellow-500" />
                        {isWalletEnv || isSafari() ? 'Copy Your Private Keys' : 'Download Your Private Keys'}
                    </DialogTitle>
                    <DialogDescription>
                        {isWalletEnv || isSafari()
                            ? 'Your private keys will be copied to your clipboard. Please save them in a secure location. You will need them to recover your wallet.'
                            : 'Your private keys will be downloaded as a text file. Please save them in a secure location. You will need them to recover your wallet.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="rounded-md bg-amber-50 p-4 border border-amber-200">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-amber-800">Security Warning</h3>
                                <div className="mt-2 text-sm text-amber-700">
                                    <ul className="list-disc space-y-1 pl-5">
                                        <li>This is the ONLY time you can {isWalletEnv || isSafari() ? 'copy' : 'download'} these private keys.</li>
                                        <li>Anyone with these keys has FULL access to the wallet funds.</li>
                                        <li>Store them in a secure offline location (e.g., password manager).</li>
                                        <li>The platform cannot recover keys if you lose them.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start space-x-2 pt-2">
                        <Checkbox
                            id="confirm-download"
                            checked={confirmDownload}
                            onCheckedChange={(checked: CheckedState) => setConfirmDownload(!!checked)}
                        />
                        <Label
                            htmlFor="confirm-download"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            I understand this is the only time I can access these keys and I will store them securely.
                        </Label>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isActionInProgress}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleAction}
                        disabled={isActionInProgress || !confirmDownload}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white"
                    >
                        {isActionInProgress ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isWalletEnv || isSafari() ? 'Copying...' : 'Downloading...'}
                            </>
                        ) : isCopied ? (
                            <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Copied!
                            </>
                        ) : isWalletEnv || isSafari() ? (
                            <>
                                <CopyIcon className="mr-2 h-4 w-4" />
                                Copy Keys
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Download Keys
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default DownloadPrivateKeyDialog;
