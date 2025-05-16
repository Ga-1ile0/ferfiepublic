'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateKidSidebarOptions } from '@/server/sidebar';
import { getKidPermissions } from '@/server/permissions';
import { toast } from '@/hooks/use-toast';

type KidOption = {
  id: string;
  name: string;
};

type SidebarPermissionsProps = {
  kids?: KidOption[];
};

export function SidebarPermissions({ kids = [] }: SidebarPermissionsProps) {
  const [selectedKidId, setSelectedKidId] = useState<string>('');
  const [permissions, setPermissions] = useState({
    allowTrade: true,
    allowGiftCards: true,
    allowNFTs: true,
    allowChores: true,
    allowSettings: true,
  });
  const [kidPermissions, setKidPermissions] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch permissions when selected kid changes
  useEffect(() => {
    const fetchPermissions = async () => {
      if (!selectedKidId) return;

      try {
        setIsLoading(true);
        // Get the kid's permissions from the database
        const response = await getKidPermissions(selectedKidId);

        if (response.status === 200 && response.data) {
          // @ts-ignore
          setKidPermissions(response.data);
          // Map database permissions to sidebar permissions
          setPermissions({
            allowTrade: response.data.tradingEnabled,
            allowGiftCards: response.data.giftCardsEnabled,
            allowNFTs: response.data.nftEnabled,
            allowChores: true, // Always allow chores for now
            allowSettings: true, // Always allow settings for now
          });
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
        toast({
          title: 'Error',
          description: 'Failed to load permissions',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPermissions();
  }, [selectedKidId]);

  const handleSavePermissions = async () => {
    if (!selectedKidId) {
      toast({
        title: 'Error',
        description: 'Please select a child first',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateKidSidebarOptions(selectedKidId, permissions);

      if (result.status === 200) {
        toast({
          title: 'Success',
          description: 'Navigation permissions updated successfully',
        });
      } else {
        throw new Error(result.message || 'Failed to update permissions');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update permissions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Navigation Access</CardTitle>
        <CardDescription>Control which pages your child can access in the app</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="kid-select">Select Child</Label>
          <Select
            value={selectedKidId}
            onValueChange={setSelectedKidId}
            disabled={kids.length === 0}
          >
            <SelectTrigger id="kid-select">
              <SelectValue placeholder="Select a child" />
            </SelectTrigger>
            <SelectContent>
              {kids.map(kid => (
                <SelectItem key={kid.id} value={kid.id}>
                  {kid.name}
                </SelectItem>
              ))}
              {kids.length === 0 && (
                <SelectItem value="no-kids" disabled>
                  No children added yet
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedKidId && (
          <>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allow-trade"
                  checked={permissions.allowTrade}
                  onCheckedChange={checked =>
                    setPermissions({ ...permissions, allowTrade: checked as boolean })
                  }
                />
                <Label htmlFor="allow-trade">Enable Trading</Label>
                <span className="text-xs text-muted-foreground">(in Spend section)</span>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="allow-gift-cards"
                  checked={permissions.allowGiftCards}
                  onCheckedChange={checked =>
                    setPermissions({ ...permissions, allowGiftCards: checked as boolean })
                  }
                />
                <Label htmlFor="allow-gift-cards">Enable Gift Cards</Label>
                <span className="text-xs text-muted-foreground">(in Spend section)</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="chores-access">Chores Access</Label>
                  <p className="text-sm text-muted-foreground">Allow access to the Chores page</p>
                </div>
                <Switch
                  id="chores-access"
                  checked={permissions.allowChores}
                  onCheckedChange={checked =>
                    setPermissions({ ...permissions, allowChores: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="settings-access">Settings Access</Label>
                  <p className="text-sm text-muted-foreground">Allow access to the Settings page</p>
                </div>
                <Switch
                  id="settings-access"
                  checked={permissions.allowSettings}
                  onCheckedChange={checked =>
                    setPermissions({ ...permissions, allowSettings: checked })
                  }
                />
              </div>
            </div>

            <Button onClick={handleSavePermissions} className="w-full" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Navigation Permissions'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
