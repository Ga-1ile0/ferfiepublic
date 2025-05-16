'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Wallet, User, Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/authContext';
import { useState } from 'react';
import { updateUserName } from '@/server/user';
import { toast } from 'react-toastify';

export function ParentSettings() {
  const { user, logout } = useAuth();
  const [name, setName] = useState('');

  const handleNameSave = async () => {
    if (!user?.id || name) return;

    try {
      const updateName = await updateUserName(user?.id || '', name);
      if (updateName.status === 200) {
        toast('Name Updated Successfully');
      }
    } catch (error) {
      console.log(error);
    }
  };
  return (
    <div className="space-y-6 pb-20">
      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-2 ">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 w-full justify-between">
                <User className="h-5 w-5" />
                Account Information{' '}
                <LogOut onClick={logout} className="text-red-800 hover:cursor-pointer" />
              </CardTitle>
              <CardDescription>Manage your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  defaultValue={user?.name}
                  onChange={e => {
                    setName(e.target.value);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wallet">Family Address</Label>
                <div className="flex gap-2">
                  <Input id="wallet" defaultValue={user?.familyAddress} readOnly />
                  <Button variant="outline">Copy</Button>
                </div>
              </div>

              <Button onClick={handleNameSave}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 pt-4">
          <Card>
            <div className="absolute inset-0 bg-background/10 backdrop-blur-[1px] rounded-xl flex flex-col items-center justify-center z-10">
              <Clock className="h-16 w-16 text-muted-foreground mb-2" />
              <h3 className="text-xl font-semibold">Coming Soon</h3>
            </div>
            <div className="opacity-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Control when and how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Allowance Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive reminders about upcoming allowance payments
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Chore Submissions</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when a child submits a completed chore
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Gift Card Purchases</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when a child purchases a gift card
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Token Trades</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when a child trades tokens
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email-notifications">Email for Notifications</Label>
                  <Input id="email-notifications" type="email" defaultValue="parent@example.com" />
                </div>

                <Button>Save Preferences</Button>
              </CardContent>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
