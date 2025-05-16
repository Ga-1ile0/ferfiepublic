import { ChoreStatus } from '@prisma/client';

export type Chore = {
  id: string;
  title: string;
  description?: string | null;
  reward: number;
  dueDate?: Date | null;
  status: ChoreStatus;
  evidence?: string | null;
  feedback?: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  assignedTo: { id: string; name: string | null };
  createdById: string;
  assignedToId: string;
};
