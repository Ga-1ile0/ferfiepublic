'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Check, Clock, ExternalLink, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/authContext';
import { getTradeHistory } from '@/server/crypto/tokens';
import { TokenType } from '@prisma/client';

type TransactionStatus = 'completed' | 'pending' | 'failed';

type TokenTrade = {
  id: string;
  fromAmount: number;
  fromToken: TokenType;
  toAmount: number;
  toToken: TokenType;
  exchangeRate: number;
  txHash?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
};

const getStatusIcon = (status: TransactionStatus) => {
  switch (status) {
    case 'completed':
      return <Check className="h-4 w-4 text-emerald-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-amber-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
  }
};

const getStatusText = (status: TransactionStatus) => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
  }
};

const getTokenSymbol = (token: TokenType) => {
  switch (token) {
    case TokenType.USDC:
      return 'USDC';
    case TokenType.EURC:
      return 'EURC';
    case TokenType.CADC:
      return 'CADC';
    case TokenType.ETH:
      return 'ETH';
    default:
      return token;
  }
};

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<TokenTrade[]>([]);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        const trades = await getTradeHistory(user.id);
        //@ts-ignore
        setTransactions(trades);
      } catch (error) {
        console.error('Error fetching trade history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [user?.id]);

  const getTransactionStatus = (tx: TokenTrade): TransactionStatus => {
    if (tx.completedAt) return 'completed';
    if (Date.now() - new Date(tx.createdAt).getTime() > 1000 * 60 * 15) return 'failed'; // 15 minutes timeout
    return 'pending';
  };

  const getBlockExplorerUrl = (txHash: string | null | undefined) => {
    if (!txHash) return '#';
    return `https://basescan.org/tx/${txHash}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>Your recent token trades</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-0.5">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">No transactions yet</p>
              <p className="text-sm text-muted-foreground">
                Your trading journey is about to begin
              </p>
            </div>
          ) : (
            transactions.map(tx => {
              const status = getTransactionStatus(tx);

              return (
                <div key={tx.id} className="border-b last:border-b-0">
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1.5 font-medium">
                            {getTokenSymbol(tx.fromToken)} → {getTokenSymbol(tx.toToken)}
                          </div>
                          <span
                            className={cn(
                              'text-xs px-1.5 py-0.5 rounded-full',
                              status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-800'
                                : status === 'pending'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}
                          >
                            {getStatusText(status)}
                          </span>
                        </div>
                        <div className="text-sm">
                          {tx.fromAmount.toFixed(6)} {getTokenSymbol(tx.fromToken)} →{' '}
                          {tx.toAmount.toFixed(6)} {getTokenSymbol(tx.toToken)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString()} at{' '}
                          {new Date(tx.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <ChevronRight
                        className={cn(
                          'h-5 w-5 text-muted-foreground transition-transform',
                          expandedTx === tx.id && 'transform rotate-90'
                        )}
                      />
                    </div>
                  </button>

                  {expandedTx === tx.id && (
                    <div className="bg-muted/30 px-4 py-3 border-t">
                      <div className="flex justify-between text-sm py-1">
                        <span className="text-muted-foreground">Status</span>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(status)}
                          <span>{getStatusText(status)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm py-1">
                        <span className="text-muted-foreground">Exchange Rate</span>
                        <span>
                          1 {getTokenSymbol(tx.fromToken)} = {tx.exchangeRate.toFixed(2)}{' '}
                          {getTokenSymbol(tx.toToken)}
                        </span>
                      </div>
                      {tx.txHash && (
                        <div className="flex justify-between text-sm py-1">
                          <span className="text-muted-foreground">Transaction Hash</span>
                          <a
                            href={getBlockExplorerUrl(tx.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-primary"
                            onClick={e => e.stopPropagation()}
                          >
                            {tx.txHash.substring(0, 6)}...
                            {tx.txHash.substring(tx.txHash.length - 4)}
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </div>
                      )}
                      <div className="flex justify-between text-sm py-1">
                        <span className="text-muted-foreground">Completed</span>
                        <span>
                          {tx.completedAt
                            ? new Date(tx.completedAt).toLocaleString()
                            : status === 'pending'
                              ? 'Processing...'
                              : 'Failed'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
      {transactions.length > 0 && (
        <CardFooter className="border-t pt-4">
          <Button variant="ghost" className="w-full">
            End Of History
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
