'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { createChildAuthCode } from '@/server/childAuth';
import { getChildActiveSessions, logoutSession } from '@/server/userSessions';
import { Loader2, RefreshCw, Smartphone, Monitor, LogOut, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/authContext';
import Image from 'next/image';

interface ChildSignInContentProps {
  childId: string;
  childName: string;
}

interface ActiveSession {
  id: string;
  deviceInfo: string;
  ipAddress: string | null;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

export function ChildSignInContent({ childId, childName }: ChildSignInContentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authData, setAuthData] = useState<{
    code: string;
    qrCode: string;
    expiresAt: string;
  } | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [loggingOutSession, setLoggingOutSession] = useState<string | null>(null);

  const { user } = useAuth();

  const generateCode = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await createChildAuthCode(childId);
      if (result.status === 200) {
        // @ts-ignore
        setAuthData(result.data);
      } else {
        setError(result.message || 'Failed to generate authentication code');
      }
    } catch (err) {
      console.error('Error generating auth code:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const result = await getChildActiveSessions(childId);
      if (result.status === 200 && result.data) {
        //@ts-ignore
        setActiveSessions(result.data);
      } else {
        console.error('Failed to fetch sessions:', result.message);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleLogoutSession = async (sessionId: string) => {
    if (!user?.id) return;

    setLoggingOutSession(sessionId);
    try {
      const result = await logoutSession(sessionId, user.id);
      if (result.status === 200) {
        // Refresh sessions list
        await fetchActiveSessions();
      } else {
        console.error('Failed to logout session:', result.message);
      }
    } catch (err) {
      console.error('Error logging out session:', err);
    } finally {
      setLoggingOutSession(null);
    }
  };

  // Generate code and fetch sessions on component mount
  useEffect(() => {
    generateCode();
    fetchActiveSessions();
  }, [childId]);

  // Helper function to get device icon
  const getDeviceIcon = (deviceInfo: string) => {
    if (
      deviceInfo.toLowerCase().includes('iphone') ||
      deviceInfo.toLowerCase().includes('android') ||
      deviceInfo.toLowerCase().includes('mobile')
    ) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  // Helper function to format last active time
  const formatLastActive = (lastActive: string) => {
    const date = new Date(lastActive);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Format the expiration time
  const formatExpirationTime = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins <= 0) return 'Expired';
    return `Expires in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-6 py-4 max-h-[80vh] overflow-y-auto">
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Generating sign-in code...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={generateCode} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
        </div>
      ) : authData ? (
        <>
          <div className="flex flex-col items-center justify-center">
            <div className="border-2 border-dashed rounded-lg p-2 bg-white">
              {/* Display QR code image */}
              <div className="w-48 h-48 relative">
                <img
                  src={authData.qrCode}
                  alt="QR Code for child sign-in"
                  className="w-full h-full"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Scan this QR code on your child's device
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Or enter this code</p>
              <div className="text-3xl font-bold tracking-widest">
                {authData.code.match(/.{1,4}/g)?.join(' ')}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {authData.expiresAt && formatExpirationTime(authData.expiresAt)}
              </p>
            </div>
          </div>

          <div className="flex justify-center mt-4">
            <Button onClick={generateCode} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-3 w-3" /> Generate New Code
            </Button>
          </div>

          {/* Active Sessions Section */}
          <div className="border-t pt-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Active Devices</h3>
              <Button
                onClick={fetchActiveSessions}
                variant="ghost"
                size="sm"
                disabled={isLoadingSessions}
              >
                {isLoadingSessions ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>

            {isLoadingSessions ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : activeSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No active devices</p>
                <p className="text-sm">Your child hasn't signed in yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {activeSessions.map(session => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center space-x-3">
                      {getDeviceIcon(session.deviceInfo)}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{session.deviceInfo}</p>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatLastActive(session.lastActive)}</span>
                          {session.ipAddress && (
                            <>
                              <span>•</span>
                              <span>{session.ipAddress}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleLogoutSession(session.id)}
                      variant="ghost"
                      size="sm"
                      disabled={loggingOutSession === session.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {loggingOutSession === session.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
