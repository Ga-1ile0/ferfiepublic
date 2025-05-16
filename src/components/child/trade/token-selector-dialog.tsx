'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Check } from 'lucide-react';
import { availableTokens } from '@/lib/tokens';

type Token = {
  id: number;
  contract: string;
  name: string;
  symbol: string;
  decimals: number;
  image: string;
};

type TokenSelectorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (tokenContract: string) => void;
  currentToken?: string; // Current token contract address
  allowedTokenSymbols?: string[]; // Optional list of allowed token symbols
};

export function TokenSelectorDialog({
  open,
  onOpenChange,
  onSelect,
  currentToken,
  allowedTokenSymbols = [],
}: TokenSelectorDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([]);

  // Filter tokens based on search query and allowed tokens
  useEffect(() => {
    let tokens = [...availableTokens];

    // Filter by allowed tokens if provided
    if (allowedTokenSymbols.length > 0) {
      tokens = tokens.filter(token => allowedTokenSymbols.includes(token.symbol));
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tokens = tokens.filter(
        token =>
          token.name.toLowerCase().includes(query) || token.symbol.toLowerCase().includes(query)
      );
    }

    setFilteredTokens(tokens);
  }, [searchQuery, allowedTokenSymbols]);

  const handleTokenSelect = (tokenContract: string) => {
    onSelect(tokenContract);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Token</DialogTitle>
          <DialogDescription>Choose a token from the list to trade with</DialogDescription>
        </DialogHeader>

        <div className="relative my-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or symbol"
            className="pl-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto pr-1">
          {filteredTokens.length > 0 ? (
            <div className="space-y-1">
              {filteredTokens.map(token => (
                <Button
                  key={token.contract}
                  variant="ghost"
                  className={`w-full justify-start h-auto py-3 ${token.contract === currentToken ? 'bg-muted' : ''}`}
                  onClick={() => handleTokenSelect(token.contract)}
                >
                  <div className="flex items-center w-full">
                    <div className="w-8 h-8 mr-3 rounded-full overflow-hidden flex-shrink-0">
                      <img
                        src={token.image || `/placeholder.svg?height=32&width=32`}
                        alt={token.symbol}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-grow">
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-xs text-muted-foreground">{token.name}</div>
                    </div>
                    {token.contract === currentToken && (
                      <Check className="h-4 w-4 text-primary ml-2" />
                    )}
                  </div>
                </Button>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              {allowedTokenSymbols.length > 0 && searchQuery
                ? 'No matching tokens found'
                : allowedTokenSymbols.length > 0
                  ? 'No allowed tokens available'
                  : 'No tokens available'}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
