'use server';

import { db } from '@/lib/db';
import { cookies } from 'next/headers';

/**
 * Get all active sessions for a child user
 */
export const getChildActiveSessions = async (childId: string) => {
  try {
    if (!childId) {
      return { status: 400, message: 'Child ID is required' };
    }

    const sessions = await db.userSession.findMany({
      where: {
        userId: childId,
        isActive: true,
      },
      orderBy: {
        lastActive: 'desc',
      },
    });

    return {
      status: 200,
      data: sessions.map(session => ({
        id: session.id,
        deviceInfo: session.deviceInfo || 'Unknown Device',
        ipAddress: session.ipAddress,
        lastActive: session.lastActive,
        createdAt: session.createdAt,
        isCurrent: false, // Will be determined on client side
      })),
    };
  } catch (error) {
    console.error('Error fetching child sessions:', error);
    return { status: 500, message: 'Failed to fetch sessions' };
  }
};

/**
 * Log out a specific session
 */
export const logoutSession = async (sessionId: string, parentId: string) => {
  try {
    if (!sessionId || !parentId) {
      return { status: 400, message: 'Session ID and Parent ID are required' };
    }

    // Verify that the parent has permission to log out this session
    const session = await db.userSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            family: true,
          },
        },
      },
    });

    if (!session) {
      return { status: 404, message: 'Session not found' };
    }

    // Check if the parent owns the family that the child belongs to
    if (session.user.family?.parentId !== parentId) {
      return { status: 403, message: 'Unauthorized to log out this session' };
    }

    // Deactivate the session
    await db.userSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    return { status: 200, message: 'Session logged out successfully' };
  } catch (error) {
    console.error('Error logging out session:', error);
    return { status: 500, message: 'Failed to log out session' };
  }
};

/**
 * Create or update a user session
 */
export const createOrUpdateSession = async (
  userId: string,
  sessionToken: string,
  deviceInfo?: string,
  ipAddress?: string
) => {
  try {
    // First, try to find existing session with this token
    const existingSession = await db.userSession.findUnique({
      where: { sessionToken },
    });

    if (existingSession) {
      // Update existing session
      await db.userSession.update({
        where: { id: existingSession.id },
        data: {
          lastActive: new Date(),
          isActive: true,
          deviceInfo,
          ipAddress,
        },
      });
    } else {
      // Create new session
      await db.userSession.create({
        data: {
          userId,
          sessionToken,
          deviceInfo,
          ipAddress,
          lastActive: new Date(),
          isActive: true,
        },
      });
    }

    return { status: 200, message: 'Session created/updated successfully' };
  } catch (error) {
    console.error('Error creating/updating session:', error);
    return { status: 500, message: 'Failed to create/update session' };
  }
};

/**
 * Validate if a user session is still active
 */
export const validateUserSession = async (userId: string, sessionToken: string) => {
  try {
    const session = await db.userSession.findFirst({
      where: {
        userId,
        sessionToken,
        isActive: true,
      },
    });

    return {
      isValid: !!session,
      session: session || null,
    };
  } catch (error) {
    console.error('Error validating session:', error);
    return {
      isValid: false,
      session: null,
    };
  }
};

/**
 * Invalidate all sessions for a user (used when parent logs out child)
 */
export const invalidateUserSessions = async (userId: string) => {
  try {
    await db.userSession.updateMany({
      where: {
        userId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return { status: 200, message: 'All sessions invalidated successfully' };
  } catch (error) {
    console.error('Error invalidating user sessions:', error);
    return { status: 500, message: 'Failed to invalidate sessions' };
  }
};

/**
 * Get device info from user agent
 */
export const getDeviceInfo = async (userAgent?: string): Promise<string> => {
  if (!userAgent) return 'Unknown Device';

  // Simple device detection
  if (userAgent.includes('iPhone')) {
    return 'iPhone';
  } else if (userAgent.includes('iPad')) {
    return 'iPad';
  } else if (userAgent.includes('Android')) {
    if (userAgent.includes('Mobile')) {
      return 'Android Phone';
    } else {
      return 'Android Tablet';
    }
  } else if (userAgent.includes('Windows')) {
    return 'Windows PC';
  } else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) {
    return 'Mac';
  } else if (userAgent.includes('Linux')) {
    return 'Linux PC';
  } else if (userAgent.includes('Mobile')) {
    return 'Mobile Device';
  }

  return 'Desktop Browser';
};