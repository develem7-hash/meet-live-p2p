import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { generateAccessToken, generateRefreshToken, generateEmailVerificationToken } from '@/lib/auth';
import { createAuthResponse } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { sendVerificationEmail } from '@/lib/email';
import { isValidEmail, sanitizeInput, checkRateLimit, rateLimitMap } from '@/lib/helpers';
import type { ApiResponse, JWTPayload } from '@/types';

const rateLimits = rateLimitMap();

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(rateLimits, `register:${clientIp}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email, password, and name are required.' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid email format.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const sanitizedName = sanitizeInput(name);
    if (sanitizedName.length < 1 || sanitizedName.length > 100) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Name must be between 1 and 100 characters.' },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: sanitizedName,
      },
    });

    const jwtPayload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: 'user',
    };

    const accessToken = generateAccessToken(jwtPayload);
    const refreshToken = generateRefreshToken(jwtPayload);

    const authResponse = createAuthResponse(accessToken, refreshToken);

    await db.userSession.create({
      data: {
        userId: user.id,
        refreshToken,
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: clientIp,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const verificationToken = generateEmailVerificationToken(user.id);
    await db.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: verificationToken },
    });

    const verificationLink = `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/auth/verify-email?token=${verificationToken}`;
    sendVerificationEmail(user.email, {
      name: user.name,
      verificationLink,
    }).catch((err) => console.error('Verification email failed to send:', err));

    createAuditLog({
      userId: user.id,
      action: 'user_registered',
      details: { email: user.email, name: user.name },
      ipAddress: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          isEmailVerified: user.isEmailVerified,
          timezone: user.timezone,
          createdAt: user.createdAt.toISOString(),
        },
        message: 'Registration successful. Please verify your email.',
      },
      { status: 201, headers: authResponse.headers }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
