'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { getReservoirCollection } from '@/server/crypto/nft';
import { addCustomNftCollection } from '@/server/crypto/nft';
import { devLog } from '@/lib/devlog';

interface ImportNftDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onImportSuccess: () => void;
    familyId: string;
}

type ViewState = 'input' | 'confirm';

export function ImportNftDialog({
    isOpen,
    onOpenChange,
    onImportSuccess,
    familyId,
}: ImportNftDialogProps) {
    const [importAddress, setImportAddress] = useState('');
    const [fetchedCollection, setFetchedCollection] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [viewState, setViewState] = useState<ViewState>('input');

    const resetState = () => {
        setImportAddress('');
        setFetchedCollection(null);
        setViewState('input');
        setIsLoading(false);
    };

    const handleOpenChange = (open: boolean) => {
        devLog.log('handleOpenChange called with:', open);
        if (!open) {
            resetState();
        }
        onOpenChange(open);
    };

    const handleImport = async () => {
        if (!importAddress) {
            toast.error('Please enter a contract address');
            return;
        }

        setIsLoading(true);
        try {
            const collection = await getReservoirCollection(importAddress);
            if (collection) {
                setFetchedCollection(collection);
                setViewState('confirm');
            } else {
                toast.error('Collection not found. Please check the address and try again.');
            }
        } catch (error) {
            console.error('Error fetching collection:', error);
            toast.error('Failed to fetch collection. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!fetchedCollection || !familyId) return;

        setIsLoading(true);
        try {
            await addCustomNftCollection(familyId, fetchedCollection);
            toast.success('Collection imported successfully!');
            onImportSuccess();
            handleOpenChange(false);
        } catch (error) {
            console.error('Error importing collection:', error);
            toast.error('Failed to import collection. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Import NFT Collection</DialogTitle>
                    <DialogDescription>
                        {viewState === 'input'
                            ? 'Enter the contract address of the NFT collection to import.'
                            : 'Review the collection details before importing.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {viewState === 'input' ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="contract-address">Contract Address</Label>
                                <div className="flex space-x-2">
                                    <Input
                                        id="contract-address"
                                        placeholder="0x..."
                                        value={importAddress}
                                        onChange={(e) => setImportAddress(e.target.value)}
                                        disabled={isLoading}
                                        onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : fetchedCollection ? (
                        <div className="space-y-4">
                            <div className="border rounded-md p-4 space-y-3">
                                <div className="flex items-start space-x-3">
                                    {fetchedCollection.image ? (
                                        <img
                                            src={fetchedCollection.image}
                                            alt={fetchedCollection.name || 'Collection'}
                                            className="h-16 w-16 rounded-md object-cover flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center">
                                            <span className="text-muted-foreground">NFT</span>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <h4 className="font-medium text-lg">
                                            {fetchedCollection.name || 'Unnamed Collection'}
                                        </h4>
                                        {fetchedCollection.contract && (
                                            <div className="text-sm text-muted-foreground font-mono">
                                                {`${fetchedCollection.contract.slice(0, 6)}...${fetchedCollection.contract.slice(-4)}`}
                                            </div>
                                        )}
                                        {fetchedCollection.tokenCount && (
                                            <div className="text-sm text-muted-foreground">
                                                {fetchedCollection.tokenCount.toLocaleString()} items
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {fetchedCollection.description && (
                                    <div className="pt-2">
                                        <p className="text-sm text-muted-foreground">
                                            {fetchedCollection.description.length > 200
                                                ? `${fetchedCollection.description.substring(0, 200)}...`
                                                : fetchedCollection.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (viewState === 'confirm') {
                                setViewState('input');
                            } else {
                                handleOpenChange(false);
                            }
                        }}
                        disabled={isLoading}
                        className="w-full sm:w-auto"
                    >
                        {viewState === 'confirm' ? 'Back' : 'Cancel'}
                    </Button>

                    {viewState === 'input' ? (
                        <Button
                            onClick={handleImport}
                            disabled={!importAddress || isLoading}
                            className="w-full sm:w-auto"
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Search className="h-4 w-4" />
                                    Find Collection
                                </span>
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleConfirmImport}
                            disabled={isLoading}
                            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Check className="h-4 w-4" />
                                    Confirm Import
                                </span>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
