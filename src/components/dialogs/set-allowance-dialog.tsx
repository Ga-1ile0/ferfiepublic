'use client';

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from 'lucide-react';
import { toast } from 'react-toastify';
import { AllowanceFrequency } from '@prisma/client';
import { useAuth } from '@/contexts/authContext';
import { setAllowance } from '@/server/allowance';
import { Token, Symbol } from '../shared/currency-symbol';

interface SetAllowanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetAllowanceDialog({ open, onOpenChange }: SetAllowanceDialogProps) {
  const [child, setChild] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [day, setDay] = useState('1'); // 0-6 for weekly (0 = Sunday)
  const [date, setDate] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { children, refreshChildren } = useAuth();

  const handleSubmit = async () => {
    if (!child) {
      toast('Please select a child');
      return;
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);

    try {
      // Map the frequency to the enum value expected by the server
      const frequencyMap: Record<string, AllowanceFrequency> = {
        daily: 'DAILY',
        weekly: 'WEEKLY',
        monthly: 'MONTHLY',
      };

      // Call the server function to set the allowance
      const result = await setAllowance(child, {
        amount: Number(amount),
        frequency: frequencyMap[frequency],
        dayOfWeek: frequency === 'weekly' ? parseInt(day) : undefined,
        dayOfMonth: frequency === 'monthly' ? parseInt(date) : undefined,
      });

      if (result.status === 200) {
        toast('Allowance set successfully');
        // Refresh the children data to update the UI
        if (refreshChildren) {
          refreshChildren();
        }
        onOpenChange(false);
      } else {
        throw new Error(result.message || 'Failed to set allowance');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to set allowance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set Allowance</DialogTitle>
          <DialogDescription>Configure recurring allowances for your children</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="child">Select Child</Label>
            <Select value={child} onValueChange={setChild}>
              <SelectTrigger id="child">
                <SelectValue placeholder="Select a child" />
              </SelectTrigger>
              <SelectContent>
                {children && children.length > 0 ? (
                  children.map(child => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name || 'Unnamed Child'}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-children" disabled>
                    No children found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <Symbol className="absolute left-4 top-2 h-5 w-5 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                className="pl-10 pr-18"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              <Token className="absolute right-10 top-2 h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger id="frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {frequency === 'weekly' && (
            <div className="space-y-2">
              <Label htmlFor="day">Day of Week</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger id="day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {frequency === 'monthly' && (
            <div className="space-y-2">
              <Label htmlFor="date">Date of Month</Label>
              <Select value={date} onValueChange={setDate}>
                <SelectTrigger id="date">
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => (
                    <SelectItem key={i} value={(i + 1).toString()}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleSubmit} disabled={isSubmitting}>
            <Calendar className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Scheduling...' : 'Schedule Allowance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
