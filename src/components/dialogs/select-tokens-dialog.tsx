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
import { availableTokens } from '@/lib/tokens';

interface SelectTokensDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTokens: string[]; // Array of allowed token symbols
  onSave: (selectedSymbols: string[]) => void;
}

export function SelectTokensDialog({
  isOpen,
  onOpenChange,
  selectedTokens,
  onSave,
}: SelectTokensDialogProps) {
  const [currentlySelected, setCurrentlySelected] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Initialize selection state
  useEffect(() => {
    if (isOpen) {
      setCurrentlySelected([...selectedTokens]);
      setSearchQuery(''); // Reset search when dialog opens
    }
  }, [isOpen, selectedTokens]);

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    return availableTokens.filter(token =>
      [token.name, token.symbol].join(' ').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleCheckboxChange = (symbol: string, checked: boolean) => {
    setCurrentlySelected(prev => (checked ? [...prev, symbol] : prev.filter(s => s !== symbol)));
  };

  const handleSelectAll = () => {
    if (currentlySelected.length === availableTokens.length) {
      // If all are selected, deselect all
      setCurrentlySelected([]);
    } else {
      // Select all
      setCurrentlySelected(availableTokens.map(token => token.symbol));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Allowed Tokens</DialogTitle>
          <DialogDescription>
            Choose which tokens the child is permitted to trade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
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
            {currentlySelected.length === availableTokens.length ? 'Deselect All' : 'Select All'}
          </Button>

          <ScrollArea className="h-[300px] w-full pr-4">
            <div className="grid gap-4 py-4">
              {filteredTokens.map(token => (
                <div
                  key={token.symbol}
                  className="flex items-center justify-between space-x-2 border p-3 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={token.image}
                      alt={token.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <Label htmlFor={`token-${token.symbol}`} className="font-normal">
                      {token.name} ({token.symbol})
                    </Label>
                  </div>
                  <Checkbox
                    id={`token-${token.symbol}`}
                    checked={currentlySelected.includes(token.symbol)}
                    onCheckedChange={checked =>
                      handleCheckboxChange(token.symbol, checked as boolean)
                    }
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
              onSave(currentlySelected), onOpenChange(false);
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
