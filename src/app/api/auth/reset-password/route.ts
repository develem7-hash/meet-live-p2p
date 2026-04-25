import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyEmailToken } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { checkRateLimit, rateLimitMap } from '@/lib/helpers';
import type { ApiResponse } from '@/types';

const rateLimits = rateLimitMap();

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(rateLimits, `reset-password:${clientIp}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Token and new password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const decoded = verifyEmailToken(token);
    if (!decoded || decoded.type !== 'password_reset') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid or expired reset token.' },
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

    if (!user.passwordResetToken || user.passwordResetToken !== token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid reset token.' },
        { status: 400 }
      );
    }

    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Reset token has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const newPasswordHash = await hashPassword(password);

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all sessions on password reset
    await db.userSession.deleteMany({
      where: { userId: user.id },
    });

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'Password has been reset successfully. Please log in with your new password.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
