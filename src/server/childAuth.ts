'use server';

import { db } from '@/lib/db';
import QRCode from 'qrcode';

/**
 * Generate a random 8-digit code for child authentication
 */
const generateAuthCode = (): string => {
  // Generate a random number between 10000000 and 99999999
  return Math.floor(10000000 + Math.random() * 90000000).toString();
};

/**
 * Create a temporary authentication code for a child
 */
export const createChildAuthCode = async (childId: string) => {
  try {
    if (!childId) {
      return { status: 400, message: 'Child ID is required' };
    }

    // Find the child user
    const child = await db.user.findUnique({
      where: { id: childId },
      include: {
        family: true,
      },
    });

    if (!child) {
      return { status: 404, message: 'Child not found' };
    }

    if (child.role !== 'KID') {
      return { status: 400, message: 'User is not a child' };
    }

    // Generate a random 8-digit code
    const authCode = generateAuthCode();

    // Create or update the auth code in the database
    const authRecord = await db.childAuthCode.upsert({
      where: { childId },
      update: {
        code: authCode,
        expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
      },
      create: {
        childId,
        code: authCode,
        expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
      },
    });

    // Generate QR code data
    const qrData = JSON.stringify({
      type: 'child_auth',
      childId,
      code: authCode,
      address: child.address,
    });

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrData);

    return {
      status: 200,
      data: {
        code: authCode,
        qrCode: qrCodeDataUrl,
        expiresAt: authRecord.expiresAt,
      },
    };
  } catch (error) {
    console.error('Error creating child auth code:', error);
    return { status: 500, message: 'Failed to create auth code' };
  }
};

/**
 * Validate a child authentication code
 */
export const validateChildAuthCode = async (code: string) => {
  try {
    if (!code) {
      return { status: 400, message: 'Auth code is required' };
    }

    // Find the auth code in the database
    const authRecord = await db.childAuthCode.findFirst({
      where: {
        code,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      include: {
        child: true,
      },
    });

    if (!authRecord) {
      return { status: 404, message: 'Invalid or expired auth code' };
    }

    // Return the child user data
    return {
      status: 200,
      data: {
        childId: authRecord.childId,
        child: authRecord.child,
      },
    };
  } catch (error) {
    console.error('Error validating child auth code:', error);
    return { status: 500, message: 'Failed to validate auth code' };
  }
};

/**
 * Validate a child authentication from QR code data
 */
export const validateChildAuthQR = async (qrData: string) => {
  try {
    // Parse the QR code data
    const data = JSON.parse(qrData);

    if (data.type !== 'child_auth' || !data.childId || !data.code) {
      return { status: 400, message: 'Invalid QR code data' };
    }

    // Validate the auth code
    return await validateChildAuthCode(data.code);
  } catch (error) {
    console.error('Error validating QR code:', error);
    return { status: 500, message: 'Failed to validate QR code' };
  }
};
