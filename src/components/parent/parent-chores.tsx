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
import { Plus, CheckCircle, XCircle, Edit } from 'lucide-react';
import { CreateChoreDialog } from '@/components/dialogs/create-chore-dialog';
import { ChoreDetailsDialog } from '@/components/dialogs/chore-details-dialog';
import { EditChoreDialog } from '@/components/dialogs/edit-chore-dialog';
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
import { Skeleton } from '@/components/ui/skeleton';

export function ParentChores() {
    const [showAddChore, setShowAddChore] = useState(false);
    const [selectedChore, setSelectedChore] = useState<Chore | null>(null);
    const [editChore, setEditChore] = useState<Chore | null>(null);
    const [activeChores, setActiveChores] = useState<Chore[]>([]);
    const [pendingChores, setPendingChores] = useState<Chore[]>([]);
    const [completedChores, setCompletedChores] = useState<Chore[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [feedbackText, setFeedbackText] = useState('');
    const [approvingChoreId, setApprovingChoreId] = useState<string | null>(null);
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
        setApprovingChoreId(choreId);
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
        } finally {
            setApprovingChoreId(null);
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

        // Format the time part
        const timeStr = format(dueDate, 'h:mm a');

        if (dueDate.toDateString() === today.toDateString()) {
            return `Today ${timeStr}`;
        } else if (dueDate.toDateString() === tomorrow.toDateString()) {
            return `Tomorrow ${timeStr}`;
        } else {
            return format(dueDate, 'MMM d') + ` ${timeStr}`;
        }
    };

    const formatCompletedDate = (date?: Date) => {
        if (!date) return '';
        return format(new Date(date), 'MMM d, yyyy');
    };

    const LoadingSpinner = () => (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Loading chores...</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowAddChore(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Chore
                </Button>
            </div>

            <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-[#1559ed]">
                    <TabsTrigger value="active">
                        Active ({isLoading ? '...' : activeChores.length})
                    </TabsTrigger>
                    <TabsTrigger value="pending">
                        Pending ({isLoading ? '...' : pendingChores.length})
                    </TabsTrigger>
                    <TabsTrigger value="completed">
                        Completed ({isLoading ? '...' : completedChores.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="space-y-4 mt-6">
                    {isLoading ? (
                        <LoadingSpinner />
                    ) : activeChores.length === 0 ? (
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
                                        <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => setEditChore(chore)}
                                        >
                                            <Edit className="mr-2 h-4 w-4" />
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
                    {isLoading ? (
                        <LoadingSpinner />
                    ) : pendingChores.length === 0 ? (
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
                                    <Currency amount={chore.reward} className="font-bold text-lg flex" />
                                    <div className='justify-end flex flex-col'>
                                        <Button size="sm" onClick={() => handleRejectChore(chore.id)}>
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Reject
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => handleApproveChore(chore.id)}
                                            disabled={!!approvingChoreId}
                                        >
                                            {approvingChoreId === chore.id ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                    Approve
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardFooter>
                            </Card>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="completed" className="space-y-4 mt-6">
                    {isLoading ? (
                        <LoadingSpinner />
                    ) : completedChores.length === 0 ? (
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

            <EditChoreDialog
                open={!!editChore}
                onOpenChange={open => !open && setEditChore(null)}
                chore={editChore}
                onChoreUpdated={fetchChores}
            />
        </div>
    );
}
