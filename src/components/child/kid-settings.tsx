'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, User, LogOut, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/authContext';
import { Switch } from '@/components/ui/switch';

export function KidSettings() {
  const { user, logout } = useAuth();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!user?.walletAddress) return;

    try {
      await navigator.clipboard.writeText(user.walletAddress);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="my-0 mb-2 flex items-center gap-2 justify-between">
        <h1 className="text-3xl font-bold text-shadow-small">Settings</h1>
        <LogOut onClick={logout} className="text-red-800 hover:cursor-pointer" />
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                My Profile
              </CardTitle>
              <CardDescription>Manage your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input id="display-name" defaultValue={user?.name} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wallet-address">My Wallet Address</Label>
                <div className="flex gap-2">
                  <Input id="wallet-address" defaultValue={user?.walletAddress} readOnly />
                  <Button variant="outline" onClick={handleCopyAddress} disabled={isCopied}>
                    {isCopied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This is your wallet address on the Base blockchain
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 pt-4">
          <Card className="relative">
            {/* Disabled overlay with centered text */}
            <div className="absolute inset-0 bg-background/10 backdrop-blur-[1px] rounded-xl flex flex-col items-center justify-center z-10">
              <Clock className="h-16 w-16 text-muted-foreground mb-2" />
              <h3 className="text-xl font-semibold">Coming Soon</h3>
            </div>

            {/* Original content with reduced opacity */}
            <div className="opacity-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Settings
                </CardTitle>
                <CardDescription>Control how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Allowance Received</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when you receive your allowance
                    </p>
                  </div>
                  <Switch disabled defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Chore Approvals</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when your chores are approved
                    </p>
                  </div>
                  <Switch disabled defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Gift Card Purchases</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about gift card purchases
                    </p>
                  </div>
                  <Switch disabled defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">New Chores</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when new chores are assigned to you
                    </p>
                  </div>
                  <Switch disabled defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Reminder Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get reminders about upcoming chore deadlines
                    </p>
                  </div>
                  <Switch disabled defaultChecked />
                </div>

                <Button variant="outline" disabled>
                  Save Notification Settings
                </Button>
              </CardContent>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
