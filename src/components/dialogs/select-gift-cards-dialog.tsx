'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

// Define a type for gift card categories if not already available
interface GiftCardCategory {
  id: string; // e.g., 'gaming', 'food'
  name: string; // e.g., 'Gaming', 'Food & Dining'
  icon?: string; // Optional icon
}

// Define available categories (replace with actual data source if available)
const availableGiftCardCategories: GiftCardCategory[] = [
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'food', name: 'Food & Dining', icon: '🍔' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️' },
  // Add more categories as needed
];

interface SelectGiftCardsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategories: string[]; // Array of allowed category IDs
  onSave: (selectedIds: string[]) => void;
}

export function SelectGiftCardsDialog({
  isOpen,
  onOpenChange,
  selectedCategories,
  onSave,
}: SelectGiftCardsDialogProps) {
  const [currentlySelected, setCurrentlySelected] = useState<string[]>([]);

  // Initialize the dialog's selection state when it opens or selectedCategories prop changes
  useEffect(() => {
    if (isOpen) {
      setCurrentlySelected([...selectedCategories]);
    }
  }, [isOpen, selectedCategories]);

  const handleCheckboxChange = (categoryId: string, checked: boolean) => {
    setCurrentlySelected(prev =>
      checked ? [...prev, categoryId] : prev.filter(id => id !== categoryId)
    );
  };

  const handleSave = () => {
    onSave(currentlySelected);
    onOpenChange(false); // Close the dialog after saving
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Allowed Gift Card Categories</DialogTitle>
          <DialogDescription>
            Choose which types of gift cards the child is permitted to purchase.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[300px] w-full pr-4">
          <div className="grid gap-4 py-4">
            {availableGiftCardCategories.map((category: GiftCardCategory) => (
              <div
                key={category.id}
                className="flex items-center justify-between space-x-2 border p-3 rounded-md"
              >
                <Label
                  htmlFor={`category-${category.id}`}
                  className="flex items-center gap-3 font-normal"
                >
                  {category.icon && <span className="text-xl">{category.icon}</span>}
                  {category.name}
                </Label>
                <Checkbox
                  id={`category-${category.id}`}
                  checked={currentlySelected.includes(category.id)}
                  onCheckedChange={checked => handleCheckboxChange(category.id, checked as boolean)}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
