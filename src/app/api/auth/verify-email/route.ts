import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyEmailToken } from '@/lib/auth';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Verification token is required.' },
        { status: 400 }
      );
    }

    const decoded = verifyEmailToken(token);
    if (!decoded || decoded.type !== 'email_verification') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid or expired verification token.' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found.' },
        { status: 404 }
      );
    }

    if (user.isEmailVerified) {
      return NextResponse.json<ApiResponse>(
        { success: true, message: 'Email is already verified.' },
        { status: 200 }
      );
    }

    if (user.emailVerificationToken !== token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid verification token.' },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
      },
    });

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'Email verified successfully.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
