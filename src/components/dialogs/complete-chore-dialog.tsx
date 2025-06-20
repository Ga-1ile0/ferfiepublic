'use client';

import type React from 'react';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Upload } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface CompleteChoreDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chore?: {
        id: string;
        title: string;
        reward: number;
        description?: string;
    } | null;
    onComplete?: (choreId: string, evidence?: string) => void;
}

export function CompleteChoreDialog({
    open,
    onOpenChange,
    chore,
    onComplete,
}: CompleteChoreDialogProps) {
    const [description, setDescription] = useState('');
    const [evidence, setEvidence] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setEvidence(e.target.files[0]);
        }
    };

    const handleSubmit = async () => {
        if (!chore) return;

        if (!description) {
            toast({
                title: 'Error',
                description: 'Please describe how you completed this chore',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            // In a real implementation, we would upload the evidence file
            // For now, we'll just use the description as evidence
            if (onComplete) {
                await onComplete(chore.id, description);
            }

            setDescription('');
            setEvidence(null);
            onOpenChange(false);
        } catch (error) {
            console.error('Error completing chore:', error);
            toast({
                title: 'Error',
                description: 'Failed to submit chore',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={open => {
                if (!open) {
                    setDescription('');
                    setEvidence(null);
                }
                onOpenChange(open);
            }}
        >
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Mark Chore as Complete</DialogTitle>
                    <DialogDescription>
                        Submit evidence that you've completed "{chore?.title}"
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Check my room all clean..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                    {/* Will add evidence photo upload later */}
                    {/* <div className="space-y-2">
                        <Label>Evidence (Optional)</Label>
                        <div className="border-2 border-dashed rounded-lg p-6 text-center">
                            {evidence ? (
                                <div className="flex flex-col items-center gap-2">
                                    <p className="text-sm font-medium">{evidence.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {(evidence.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                    <Button variant="outline" size="sm" onClick={() => setEvidence(null)}>
                                        Remove
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <Camera className="h-8 w-8 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">Take a photo or upload evidence</p>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => document.getElementById('file-upload')?.click()}
                                        >
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload
                                        </Button>
                                        <input
                                            id="file-upload"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div> */}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
