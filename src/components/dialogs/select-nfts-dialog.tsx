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
import { Search } from 'lucide-react';
import { availableNfts } from '@/lib/nfts';

interface SelectNftsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNfts: string[]; // Array of allowed NFT slugs
  onSave: (selectedSlugs: string[]) => void;
}

export function SelectNftsDialog({
  isOpen,
  onOpenChange,
  selectedNfts,
  onSave,
}: SelectNftsDialogProps) {
  const [currentlySelected, setCurrentlySelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize selection state
  useEffect(() => {
    if (isOpen) {
      setCurrentlySelected([...selectedNfts]);
      setSearchQuery(''); // Reset search when dialog opens
    }
  }, [isOpen, selectedNfts]);

  // Filter NFTs based on search query
  const filteredNfts = useMemo(() => {
    return availableNfts.filter(nft =>
      [nft.name, nft.slug].join(' ').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleCheckboxChange = (slug: string, checked: boolean) => {
    setCurrentlySelected(prev => (checked ? [...prev, slug] : prev.filter(s => s !== slug)));
  };

  const handleSelectAll = () => {
    if (currentlySelected.length === availableNfts.length) {
      // If all are selected, deselect all
      setCurrentlySelected([]);
    } else {
      // Select all
      setCurrentlySelected(availableNfts.map(nft => nft.slug));
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

          {/* Select/Deselect All button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="w-full border-dashed"
          >
            {currentlySelected.length === availableNfts.length ? 'Deselect All' : 'Select All'}
          </Button>

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
    </Dialog>
  );
}
