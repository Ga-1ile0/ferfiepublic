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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { createChildWithWallet } from '@/server/kids';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAccount } from 'wagmi';
import { DownloadPrivateKeyDialog } from '@/components/dialogs/download-private-key-dialog';

interface AddChildDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddChildDialog({ open, onOpenChange }: AddChildDialogProps) {
    const [name, setName] = useState('');
    const [walletType, setWalletType] = useState('new');
    const [privateKey, setPrivateKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showKeyDownloadDialog, setShowKeyDownloadDialog] = useState(false);
    const [walletsForDownload, setWalletsForDownload] = useState<
        Array<{
            id: string;
            name: string;
            privateKey: string;
            type: 'child' | 'family';
        }>
    >([]);
    const { address } = useAccount();

    const handleSubmit = async () => {
        try {
            if (!name) {
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

            setIsSubmitting(true);

            const result = await createChildWithWallet(
                name,
                address,
                walletType === 'import' ? { privateKey } : undefined
            );

            if (result.status === 200) {
                // If this is a new wallet (not imported), show the private key download dialog
                if (walletType === 'new' && result.data && result.data.privateKey) {
                    setWalletsForDownload([
                        {
                            // @ts-ignore
                            id: result.data.id,
                            name: name,
                            privateKey: result.data.privateKey,
                            type: 'child',
                        },
                    ]);
                    setShowKeyDownloadDialog(true);
                    // Keep the dialog open until private key is downloaded
                } else {
                    toast({
                        title: 'Success',
                        description: `${name} has been added to your family`,
                    });
                    setName('');
                    setPrivateKey('');
                    onOpenChange(false);
                }
            } else {
                toast({
                    title: 'Error',
                    description: result.message || 'Failed to create child account',
                    variant: 'destructive',
                });
            }
        } catch (error) {
            toast({
                title: 'Error',
                description: 'An unexpected error occurred',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDownloadComplete = () => {
        setShowKeyDownloadDialog(false);
        toast({
            title: 'Success',
            description: `${walletsForDownload[0].name} has been added to your family and the private key has been downloaded`,
        });
        setName('');
        setPrivateKey('');
        setWalletsForDownload([]);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add a Child</DialogTitle>
                    <DialogDescription>
                        Connect your child's wallet to manage their allowance and permissions.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Child's Name</Label>
                        <Input
                            id="name"
                            placeholder="Enter name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Wallet Setup</Label>
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
                                <p className="text-xs text-muted-foreground">
                                    Enter the private key of the existing wallet you want to import.
                                </p>
                            </div>
                        )}

                        {walletType === 'new' && (
                            <p className="text-xs text-muted-foreground">
                                A new wallet will be automatically generated for your child.
                            </p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Adding...' : 'Add Child'}
                    </Button>
                </DialogFooter>
            </DialogContent>

            {/* Private Key Download Dialog */}
            {walletsForDownload.length > 0 && (
                <DownloadPrivateKeyDialog
                    open={showKeyDownloadDialog}
                    onOpenChange={setShowKeyDownloadDialog}
                    wallets={walletsForDownload}
                    onDownloadComplete={handleKeyDownloadComplete}
                />
            )}
        </Dialog>
    );
}
