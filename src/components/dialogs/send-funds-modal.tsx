'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Currency, Token } from '@/components/shared/currency-symbol';
import { useAuth } from '@/contexts/authContext';
import { sendFundsToChild, getFamilyBalance } from '@/server/fundTransfer';
import { toast } from 'react-toastify';
import { Symbol } from '@/components/shared/currency-symbol';

interface SendFundsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string | null;
  childName: string;
}

export function SendFundsModal({ isOpen, onOpenChange, childId, childName }: SendFundsModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [familyBalance, setFamilyBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const { user, refreshBalance } = useAuth();

  // Fetch family balance when modal opens
  useEffect(() => {
    if (isOpen && user?.family?.id) {
      fetchFamilyBalance(user.family.id);
    }
  }, [isOpen, user?.family?.id]);

  const fetchFamilyBalance = async (familyId: string) => {
    setIsLoadingBalance(true);
    try {
      const response = await getFamilyBalance(familyId);
      if (response.status === 200 && response.data) {
        setFamilyBalance(response.data.balance);
      } else {
        toast.error(response.message || 'Failed to fetch family balance');
      }
    } catch (error) {
      console.error('Error fetching family balance:', error);
      toast.error('Failed to fetch family balance');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleSendFunds = async () => {
    if (!childId || !user?.id) return;

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // Check if amount exceeds available balance
    if (familyBalance !== null && amountValue > familyBalance) {
      toast.error('Insufficient funds in family wallet');
      return;
    }

    setIsSending(true);
    try {
      const response = await sendFundsToChild(user.id, childId, amountValue);

      if (response.status === 200) {
        refreshBalance();
        toast.success('Funds sent successfully');
        setAmount('');
        onOpenChange(false);

        // Refresh family balance
        if (user?.family?.id) {
          fetchFamilyBalance(user.family.id);
        }
      } else {
        toast.error(response.message || 'Failed to send funds');
      }
    } catch (error) {
      console.error('Error sending funds:', error);
      toast.error('Failed to send funds');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Funds to {childName}</DialogTitle>
          <DialogDescription>
            Transfer funds from your family wallet to your child's wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center p-4 bg-muted rounded-md">
            <span className="text-sm font-medium">Family Balance:</span>
            {isLoadingBalance ? (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading...
              </div>
            ) : familyBalance !== null ? (
              <Currency amount={familyBalance} className="font-medium" />
            ) : (
              <span className="text-destructive">Error loading balance</span>
            )}
          </div>

          <div className="relative">
            <Symbol className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              className="pl-10"
              value={amount}
              onChange={e => {
                const newValue = e.target.value;
                const numValue = parseFloat(newValue);

                // Only update if it's empty, not a number, or less than or equal to available balance
                if (
                  newValue === '' ||
                  isNaN(numValue) ||
                  familyBalance === null ||
                  numValue <= familyBalance
                ) {
                  setAmount(newValue);
                } else {
                  toast.error('Amount exceeds available balance');
                }
              }}
              max={familyBalance || 0}
            />
            <Token className="absolute right-15 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleSendFunds}
            disabled={isSending || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Funds'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
