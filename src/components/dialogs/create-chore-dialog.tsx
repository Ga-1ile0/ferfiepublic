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
import { DollarSign, Users, User, Trophy } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/authContext';
import { createChore, ChoreAssignmentType } from '@/server/chores';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getChildrenForParent } from '@/server/user';
import { Symbol } from '@/components/shared/currency-symbol';

interface CreateChoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoreCreated?: () => void;
}

type ChildOption = {
  id: string;
  name: string;
};

export function CreateChoreDialog({ open, onOpenChange, onChoreCreated }: CreateChoreDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [assignmentType, setAssignmentType] = useState<ChoreAssignmentType>('individual');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [children, setChildren] = useState<ChildOption[]>([]);
  const { user } = useAuth();

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

    if (assignmentType === 'individual' && !assignTo) {
      toast({
        title: 'Error',
        description: 'Please select a child to assign the chore to',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.id || !user?.familyId) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create chores',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const choreData = {
        title,
        description,
        reward: Number(reward),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        createdById: user.id,
        assignmentType,
        assignedToId: assignmentType === 'individual' ? assignTo : undefined,
        familyId: assignmentType !== 'individual' ? user.familyId : undefined,
      };

      const result = await createChore(choreData);

      if (result.status === 201) {
        toast({
          title: 'Success',
          description: `Chore "${title}" has been created`,
        });
        resetForm();
        onOpenChange(false);
        if (onChoreCreated) onChoreCreated();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to create chore',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating chore:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setReward('');
    setDueDate('');
    setAssignTo('');
    setAssignmentType('individual');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={open => {
        if (!open) resetForm();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a New Chore</DialogTitle>
          <DialogDescription>Add a new chore with details and reward amount.</DialogDescription>
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
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assignment Type</Label>
            <RadioGroup
              value={assignmentType}
              onValueChange={value => setAssignmentType(value as ChoreAssignmentType)}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="individual" id="individual" />
                <Label htmlFor="individual" className="flex items-center cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Individual Child
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="flex items-center cursor-pointer">
                  <Users className="h-4 w-4 mr-2" />
                  All Children
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="first-to-complete" id="first-to-complete" />
                <Label htmlFor="first-to-complete" className="flex items-center cursor-pointer">
                  <Trophy className="h-4 w-4 mr-2" />
                  First to Complete
                </Label>
              </div>
            </RadioGroup>
          </div>

          {assignmentType === 'individual' && (
            <div className="space-y-2">
              <Label htmlFor="assign-to">Assign To</Label>
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger id="assign-to">
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map(child => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Chore'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
