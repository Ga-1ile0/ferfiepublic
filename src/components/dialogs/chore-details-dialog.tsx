'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Currency } from '@/components/shared/currency-symbol';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Calendar, DollarSign, MessageSquare, User } from 'lucide-react';

interface ChoreDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chore: {
    id: string;
    title: string;
    description?: string;
    status: string;
    reward: number;
    evidence?: string;
    feedback?: string;
    completedAt?: Date;
    assignedTo: {
      name: string;
    };
  } | null;
}

export function ChoreDetailsDialog({ open, onOpenChange, chore }: ChoreDetailsDialogProps) {
  if (!chore) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{chore.title}</DialogTitle>
          <Badge className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        </DialogHeader>

        <div className="space-y-4">
          {chore.description && (
            <div className="text-sm text-muted-foreground">{chore.description}</div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Completed by {chore.assignedTo.name}</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {chore.completedAt
                  ? format(new Date(chore.completedAt), 'PPP')
                  : 'Completion date not recorded'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Currency amount={chore.reward} className="text-sm font-medium" />
            </div>
          </div>

          {chore.evidence && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Evidence Provided</h4>
              <p className="text-sm text-muted-foreground">{chore.evidence}</p>
            </div>
          )}

          {chore.feedback && (
            <div className="space-y-1 border-t pt-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Parent Feedback
              </h4>
              <p className="text-sm text-muted-foreground">{chore.feedback}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
