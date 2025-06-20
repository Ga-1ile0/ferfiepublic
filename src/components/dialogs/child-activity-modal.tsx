'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Gift,
    DollarSign,
    ExternalLink,
    ShoppingCart,
    Gem,
    RefreshCw,
    Send,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getChildTransactions } from '@/server/transaction';
import { formatDistanceToNow, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { TransactionType } from '@prisma/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Currency } from '@/components/shared/currency-symbol';

interface ChildActivityModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    childId: string | null;
    childName: string;
}

export function ChildActivityModal({
    isOpen,
    onOpenChange,
    childId,
    childName,
}: ChildActivityModalProps) {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [transactions, setTransactions] = useState<any[]>([]);
    const pageSize = 10;

    // Fetch transactions when the dialog opens or page changes
    useEffect(() => {
        if (isOpen && childId) {
            fetchTransactions();
        }
    }, [isOpen, childId, currentPage]);

    const fetchTransactions = async () => {
        if (!childId) return;

        setIsLoading(true);
        setError(null);

        try {
            const response = await getChildTransactions(childId, currentPage, pageSize);

            if (response.status === 200 && response.data) {
                setTransactions(response.data.transactions);
                setTotalPages(response.data.pagination.totalPages);
            } else {
                throw new Error(response.message || 'Failed to fetch transactions');
            }
        } catch (error) {
            console.error('Error fetching child transactions:', error);
            setError('Failed to load activity. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    // Get the appropriate icon and color for each transaction type
    const getTransactionDetails = (type: TransactionType) => {
        switch (type) {
            case 'ALLOWANCE':
                return {
                    icon: <DollarSign className="h-4 w-4" />,
                    color: 'bg-green-100 text-green-800',
                    label: 'Allowance',
                };
            case 'CHORE_REWARD':
                return {
                    icon: <Gift className="h-4 w-4" />,
                    color: 'bg-blue-100 text-blue-800',
                    label: 'Chore Reward',
                };
            case 'GIFT_CARD_PURCHASE':
                return {
                    icon: <ShoppingCart className="h-4 w-4" />,
                    color: 'bg-purple-100 text-purple-800',
                    label: 'Gift Card',
                };
            case 'TOKEN_TRADE':
                return {
                    icon: <RefreshCw className="h-4 w-4" />,
                    color: 'bg-amber-100 text-amber-800',
                    label: 'Token Trade',
                };
            case 'NFT_TRADE':
                return {
                    icon: <Gem className="h-4 w-4" />,
                    color: 'bg-indigo-100 text-indigo-800',
                    label: 'NFT Trade',
                };
            case 'TOKEN_TRANSFER':
                return {
                    icon: <Send className="h-4 w-4" />,
                    color: 'bg-amber-100 text-amber-800',
                    label: 'Token Transfer',
                };
            default:
                return {
                    icon: <ExternalLink className="h-4 w-4" />,
                    color: 'bg-gray-100 text-gray-800',
                    label: 'Transaction',
                };
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md md:max-w-xl w-[95vw] max-w-[95vw]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        {childName}'s Activity
                    </DialogTitle>
                </DialogHeader>

                <div className="min-h-[350px] max-h-[500px] w-full">
                    {isLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-md border">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-1.5 flex-1">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-full" />
                                    </div>
                                    <Skeleton className="h-6 w-16" />
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <AlertTriangle className="h-10 w-10 mb-4 text-amber-500" />
                            <p>{error}</p>
                            <Button variant="outline" className="mt-4" onClick={fetchTransactions}>
                                Try Again
                            </Button>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <p>No activity found for this child.</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-3 pr-4 max-w-[calc(100%-8px)]">
                                {transactions.map(transaction => {
                                    const { icon, color, label } = getTransactionDetails(transaction.type);
                                    const date = new Date(transaction.createdAt);

                                    return (
                                        <div
                                            key={transaction.id}
                                            className="p-3 rounded-md border hover:bg-muted/50 transition-colors w-full"
                                            style={{ maxWidth: 'calc(100% - 8px)', boxSizing: 'border-box' }}
                                        >
                                            <div className="w-full">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <Badge variant="outline" className={`${color} flex-shrink-0`}>
                                                        <span className="flex items-center">
                                                            {icon}
                                                            <span className="ml-1">{label}</span>
                                                        </span>
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                                        {formatDistanceToNow(date, { addSuffix: true })}
                                                    </span>
                                                    <span className="ml-auto font-medium flex-shrink-0">
                                                        <Currency amount={transaction.amount} />
                                                    </span>
                                                </div>

                                                <p className="text-sm break-words whitespace-normal">
                                                    {transaction.description || `${label} transaction`}
                                                </p>

                                                {transaction.hash && (
                                                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                                                        <span className="mr-1 flex-shrink-0">TX:</span>
                                                        <span className="truncate max-w-[200px]">
                                                            {transaction.hash.substring(0, 10)}...
                                                            {transaction.hash.substring(transaction.hash.length - 8)}
                                                        </span>
                                                        <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                                                    </div>
                                                )}

                                                <div className="text-xs text-muted-foreground mt-1">
                                                    {format(date, 'PPP p')}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                {!isLoading && !error && transactions.length > 0 && (
                    <DialogFooter className="flex items-center justify-between sm:justify-between">
                        <div className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrevPage}
                                disabled={currentPage === 1 || isLoading}
                            >
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages || isLoading}
                            >
                                Next
                                <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
