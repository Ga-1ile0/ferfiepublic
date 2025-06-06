'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { CreateChoreDialog } from '@/components/dialogs/create-chore-dialog';
import { ChoreDetailsDialog } from '@/components/dialogs/chore-details-dialog';
import { toast } from 'react-toastify';
import { useAuth } from '@/contexts/authContext';
import {
  getChoresByParentId,
  getChoresByFamilyId,
  approveChore,
  rejectChore,
  deleteChore,
} from '@/server/chores';
import { Currency } from '@/components/shared/currency-symbol';
import { format } from 'date-fns';
import { Chore } from '../../types';

export function ParentChores() {
  const [showAddChore, setShowAddChore] = useState(false);
  const [selectedChore, setSelectedChore] = useState<Chore | null>(null);
  const [activeChores, setActiveChores] = useState<Chore[]>([]);
  const [pendingChores, setPendingChores] = useState<Chore[]>([]);
  const [completedChores, setCompletedChores] = useState<Chore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackText, setFeedbackText] = useState('');
  const { user } = useAuth();

  const fetchChores = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // If user has a family, get all family chores, otherwise just get parent's chores
      const response = user.familyId
        ? await getChoresByFamilyId(user.familyId)
        : await getChoresByParentId(user.id);

      if (response.status === 200 && response.data) {
        // Filter chores by status
        const active = response.data.filter(chore => chore.status === 'ACTIVE');
        const pending = response.data.filter(chore => chore.status === 'PENDING_APPROVAL');
        const completed = response.data.filter(chore => chore.status === 'COMPLETED');

        setActiveChores(active);
        setPendingChores(pending);
        setCompletedChores(completed);
      }
    } catch (error) {
      console.error('Error fetching chores:', error);
      toast.error('Failed to load chores');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChores();
  }, [user]);

  const handleApproveChore = async (choreId: string) => {
    if (!user?.id) return;
    //Promise toast in the trycatch block react-toastify
    try {
      const result = await approveChore({
        id: choreId,
        feedback: feedbackText,
        parentId: user.id,
      });

      if (result.status === 200) {
        toast.success('Chore Approved, reward has been sent');
        fetchChores(); // Refresh the chores list
      } else {
        toast.error('Failed to approve chore');
      }
    } catch (error) {
      console.error('Error approving chore:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleRejectChore = async (choreId: string) => {
    if (!user?.id) return;

    try {
      const result = await rejectChore({
        id: choreId,
        feedback: feedbackText || 'Rejected by parent',
        parentId: user.id,
      });

      if (result.status === 200) {
        toast.success('Chore has been rejected');
        fetchChores(); // Refresh the chores list
      } else {
        toast.error('Failed to reject chore');
      }
    } catch (error) {
      console.error('Error rejecting chore:', error);
      toast.error('Error rejecting chore');
    }
  };

  const handleDeleteChore = async (choreId: string) => {
    if (!user?.id) return;

    try {
      const result = await deleteChore(choreId, user.id);

      if (result.status === 200) {
        toast.success('Chore deleted');
        fetchChores(); // Refresh the chores list
      } else {
        toast.error('Failed to delete chore');
      }
    } catch (error) {
      console.error('Error deleting chore:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const formatDueDate = (date?: Date) => {
    if (!date) return 'No due date';

    const dueDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dueDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (dueDate.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return format(dueDate, 'MMM d, yyyy');
    }
  };

  const formatCompletedDate = (date?: Date) => {
    if (!date) return '';
    return format(new Date(date), 'MMM d, yyyy');
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setShowAddChore(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Chore
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading chores...</span>
        </div>
      ) : (
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-[#1559ed]">
            <TabsTrigger value="active">Active ({activeChores.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({pendingChores.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedChores.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 mt-6">
            {activeChores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active chores. Create a new chore to get started.
              </div>
            ) : (
              activeChores.map(chore => (
                <Card key={chore.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{chore.title}</CardTitle>
                    <CardDescription>
                      Assigned to {chore.assignedTo?.name ?? 'Unassigned'} • Due {/* @ts-ignore */}
                      {formatDueDate(chore.dueDate)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{chore.description}</p>
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex justify-between">
                    <Currency amount={chore.reward} className="font-bold text-lg" />
                    <div className="space-x-2">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteChore(chore.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4 mt-6">
            {pendingChores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No chores pending approval.
              </div>
            ) : (
              pendingChores.map(chore => (
                <Card key={chore.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{chore.title}</CardTitle>
                    <CardDescription>
                      Completed by {chore.assignedTo?.name ?? 'Unassigned'} • {/* @ts-ignore */}
                      {formatCompletedDate(chore.completedAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{chore.description}</p>
                    {chore.evidence && (
                      <div className="text-sm">
                        <span className="font-medium">Evidence: </span>
                        <span className="text-muted-foreground">{chore.evidence}</span>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex justify-between">
                    <Currency amount={chore.reward} className="font-bold text-lg" />
                    <div className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRejectChore(chore.id)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => handleApproveChore(chore.id)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-6">
            {completedChores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No completed chores yet.</div>
            ) : (
              completedChores.map(chore => (
                <Card key={chore.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{chore.title}</CardTitle>
                    <CardDescription>
                      Completed by {chore.assignedTo?.name ?? 'Unassigned'} • {/* @ts-ignore */}
                      {formatCompletedDate(chore.completedAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{chore.description}</p>
                    {chore.feedback && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Feedback: </span>
                        <span className="text-muted-foreground">{chore.feedback}</span>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="border-t pt-4 flex justify-between">
                    <Currency amount={chore.reward} className="font-bold text-lg" />
                    <Button variant="outline" size="sm" onClick={() => setSelectedChore(chore)}>
                      View Details
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      <CreateChoreDialog
        open={showAddChore}
        onOpenChange={setShowAddChore}
        onChoreCreated={fetchChores}
      />

      <ChoreDetailsDialog
        open={!!selectedChore}
        onOpenChange={open => !open && setSelectedChore(null)}
        //@ts-ignore
        chore={selectedChore}
      />
    </div>
  );
}
