'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface DeleteChildDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    childId: string | null;
    childName: string;
    onConfirm: (childId: string) => Promise<void>; // Callback to handle confirmed deletion
}

export function DeleteChildDialog({
    open,
    onOpenChange,
    childId,
    childName,
    onConfirm,
}: DeleteChildDialogProps) {
    const [confirmCheckbox, setConfirmCheckbox] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!childId) return;
        setIsDeleting(true);
        await onConfirm(childId); // Execute the confirmation logic passed from parent
        setIsDeleting(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Remove {childName}?</DialogTitle>
                    <DialogDescription>
                        This action cannot be undone. This will permanently remove the child account and
                        associated data.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="confirmDelete"
                        checked={confirmCheckbox}
                        onCheckedChange={checked => setConfirmCheckbox(!!checked)}
                    />
                    <Label
                        htmlFor="confirmDelete"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        I understand this is permanent
                    </Label>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={!confirmCheckbox || isDeleting}
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removing...
                            </>
                        ) : (
                            'Remove'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
