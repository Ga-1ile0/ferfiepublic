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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/authContext';
import { updateChore } from '@/server/chores';
import { getChildrenForParent } from '@/server/user';
import { Symbol } from '@/components/shared/currency-symbol';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { TimePicker } from '@/components/ui/time-picker';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Chore } from '@/types';

interface EditChoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chore: Chore | null;
  onChoreUpdated?: () => void;
}

type ChildOption = {
  id: string;
  name: string;
};

export function EditChoreDialog({ open, onOpenChange, chore, onChoreUpdated }: EditChoreDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [assignTo, setAssignTo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const { user } = useAuth();

  // Initialize form with chore data when opened
  useEffect(() => {
    if (open && chore) {
      setTitle(chore.title);
      setDescription(chore.description || '');
      setReward(chore.reward.toString());
      setDueDate(chore.dueDate ? new Date(chore.dueDate) : undefined);
      setAssignTo(chore.assignedToId);
    }
  }, [open, chore]);

  // Fetch children in the family
  useEffect(() => {
    const fetchChildren = async () => {
      if (!user?.id || !user?.familyId) return;

      try {
        const childrenResponse = await getChildrenForParent(user.id);
        if (childrenResponse.status === 200 && childrenResponse.data) {
          // Transform the data to match our ChildOption type
          const childrenData = childrenResponse.data.map(child => ({
            id: child.id,
            name: child.name || 'Unnamed Child',
          }));
          setChildren(childrenData);
        }
      } catch (error) {
        console.error('Error fetching children:', error);
        toast({
          title: 'Error',
          description: 'Failed to load children',
          variant: 'destructive',
        });
      }
    };

    if (open) {
      fetchChildren();
    }
  }, [open, user]);

  const handleSubmit = async () => {
    if (!chore) return;
    
    if (!title) {
      toast({
        title: 'Error',
        description: 'Please enter a title for the chore',
        variant: 'destructive',
      });
      return;
    }

    if (!reward || isNaN(Number(reward)) || Number(reward) <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid reward amount',
        variant: 'destructive',
      });
      return;
    }

    if (!dueDate) {
      toast({
        title: 'Error',
        description: 'Please select a due date and time for the chore.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData = {
        id: chore.id,
        title,
        description,
        reward: Number(reward),
        dueDate,
      };

      const result = await updateChore(updateData);

      if (result.status === 200) {
        toast({
          title: 'Success',
          description: `Chore "${title}" has been updated`,
        });
        onOpenChange(false);
        if (onChoreUpdated) onChoreUpdated();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to update chore',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating chore:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Chore</DialogTitle>
          <DialogDescription>Update chore details and reward amount.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Chore Title</Label>
            <Input
              id="title"
              placeholder="e.g., Clean your room"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Provide details about what needs to be done"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reward">Reward Amount</Label>
              <div className="relative">
                <Symbol className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                <Input
                  id="reward"
                  type="number"
                  placeholder="0.00"
                  className="pl-10"
                  value={reward}
                  onChange={e => setReward(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date & Time</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left text-white font-normal border-white',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    {!dueDate && <CalendarIcon className="mr-2 h-4 w-4" />}
                    {dueDate ? format(dueDate, 'MMM d, h:mm a') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 z-[9999] pointer-events-auto"
                  align="start"
                  onInteractOutside={e => {
                    const target = e.target as Element;
                    const dialogElement = target.closest('[data-radix-dialog-content]');
                    const popoverElement = target.closest('[data-radix-popover-content]');

                    if (dialogElement && !popoverElement) {
                      e.preventDefault();
                    }
                  }}
                  onPointerDownOutside={e => {
                    const target = e.target as Element;
                    const dialogElement = target.closest('[data-radix-dialog-content]');
                    const popoverElement = target.closest('[data-radix-popover-content]');

                    if (dialogElement && !popoverElement) {
                      e.preventDefault();
                    }
                  }}
                >
                  <div
                    className="pointer-events-auto bg-background rounded-lg border shadow-lg"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                  >
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={date => {
                        if (date) {
                          const newDate = new Date(date);
                          if (dueDate) {
                            newDate.setHours(dueDate.getHours(), dueDate.getMinutes(), 0, 0);
                          } else {
                            newDate.setHours(23, 59, 0, 0);
                          }
                          setDueDate(newDate);
                        } else {
                          setDueDate(undefined);
                        }
                      }}
                      initialFocus
                    />
                    <div className="p-3 border-t border-border bg-muted/30">
                      <div className="flex items-center justify-center">
                        <TimePicker value={dueDate} onChange={newDate => setDueDate(newDate)} />
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assign-to">Assigned To</Label>
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4" />
              <span>{chore?.assignedTo?.name || 'Unassigned'}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Assignment cannot be changed after creation</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Chore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}