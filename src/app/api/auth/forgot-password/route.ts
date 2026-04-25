import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePasswordResetToken } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { isValidEmail, checkRateLimit, rateLimitMap } from '@/lib/helpers';
import type { ApiResponse } from '@/types';

const rateLimits = rateLimitMap();

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(rateLimits, `forgot-password:${clientIp}`, 3, 15 * 60 * 1000)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email is required.' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid email format.' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return success for security (prevent email enumeration)
    if (user) {
      const resetToken = generatePasswordResetToken(user.id);
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });

      const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/reset-password?token=${resetToken}`;
      sendPasswordResetEmail(user.email, {
        name: user.name,
        resetLink,
      }).catch((err) => console.error('Password reset email failed to send:', err));
    }

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'If an account with that email exists, a password reset link has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
