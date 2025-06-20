'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus } from 'lucide-react';
import { availableNfts } from '@/lib/nfts';
import { NftCollection } from '@prisma/client';
import { ImportNftDialog } from './import-nft-dialog';
import { devLog } from '@/lib/devlog';

interface SelectNftsDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    selectedNfts: string[]; // Array of allowed NFT slugs
    onSave: (selectedSlugs: string[]) => void;
    customNfts: NftCollection[];
    familyId: string;
    onNftImported?: () => void; // Callback when an NFT is imported
}

export function SelectNftsDialog({
    isOpen,
    onOpenChange,
    selectedNfts,
    onSave,
    customNfts,
    familyId,
    onNftImported,
}: SelectNftsDialogProps) {
    const [currentlySelected, setCurrentlySelected] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showImportDialog, setShowImportDialog] = useState(false);

    // Initialize selection state
    useEffect(() => {
        if (isOpen) {
            setCurrentlySelected([...selectedNfts]);
            setSearchQuery(''); // Reset search when dialog opens
        }
    }, [isOpen, selectedNfts]);

    const allNfts = useMemo(() => {
        const hardcoded = availableNfts.map(nft => ({
            name: nft.name,
            slug: nft.slug,
            image: nft.image,
        }));
        const custom = customNfts
            .filter(nft => nft.slug)
            .map(nft => ({
                name: nft.name,
                slug: nft.slug!,
                image: nft.imageUrl || '/placeholder.svg',
            }));
        return [...hardcoded, ...custom];
    }, [customNfts]);

    // Filter NFTs based on search query
    const filteredNfts = useMemo(() => {
        return allNfts.filter(nft =>
            [nft.name, nft.slug].join(' ').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, allNfts]);

    const handleCheckboxChange = (slug: string, checked: boolean) => {
        setCurrentlySelected(prev => (checked ? [...prev, slug] : prev.filter(s => s !== slug)));
    };

    const handleSelectAll = () => {
        if (currentlySelected.length === allNfts.length) {
            // If all are selected, deselect all
            setCurrentlySelected([]);
        } else {
            // Select all
            setCurrentlySelected(allNfts.map(nft => nft.slug));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Select Allowed NFT Collections</DialogTitle>
                    <DialogDescription>
                        Choose which NFT collections the child is permitted to trade.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Search input */}
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search NFT collections..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Buttons row */}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            className="flex-1 border-dashed"
                        >
                            {currentlySelected.length === allNfts.length ? 'Deselect All' : 'Select All'}
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowImportDialog(true);
                                devLog.log('Import button clicked, setting showImportDialog to true');
                            }}
                            className="flex-1 border-dashed flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Import
                        </Button>
                    </div>

                    <ScrollArea className="h-[300px] w-full pr-4">
                        <div className="grid gap-4 py-4">
                            {filteredNfts.map(nft => (
                                <div
                                    key={nft.slug}
                                    className="flex items-center justify-between space-x-2 border p-3 rounded-md"
                                >
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={nft.image}
                                            alt={nft.name}
                                            className="h-8 w-8 rounded-full object-cover"
                                        />
                                        <Label htmlFor={`nft-${nft.slug}`} className="font-normal">
                                            {nft.name}
                                        </Label>
                                    </div>
                                    <Checkbox
                                        id={`nft-${nft.slug}`}
                                        checked={currentlySelected.includes(nft.slug)}
                                        onCheckedChange={checked => handleCheckboxChange(nft.slug, checked as boolean)}
                                    />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            onSave(currentlySelected);
                            onOpenChange(false);
                        }}
                        className="w-full"
                    >
                        Save Changes ({currentlySelected.length} selected)
                    </Button>
                </DialogFooter>
            </DialogContent>

            {showImportDialog && (
                <ImportNftDialog
                    isOpen={showImportDialog}
                    onOpenChange={(open) => {
                        setShowImportDialog(open);
                        if (!open) {
                            // Reset any dialog state if needed
                            setShowImportDialog(false);
                        }
                    }}
                    onImportSuccess={() => {
                        // Call the onNftImported callback if provided
                        if (onNftImported) {
                            onNftImported();
                        }
                        // Close the import dialog after successful import
                        setShowImportDialog(false);
                    }}
                    familyId={familyId}
                />
            )}
        </Dialog>
    );
}
