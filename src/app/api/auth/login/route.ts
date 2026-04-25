import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { createAuthResponse } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { isValidEmail, checkRateLimit, rateLimitMap } from '@/lib/helpers';
import type { ApiResponse, JWTPayload } from '@/types';

const rateLimits = rateLimitMap();

export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(rateLimits, `login:${clientIp}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email and password are required.' },
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
    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

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

    createAuditLog({
      userId: user.id,
      action: 'user_login',
      details: { email: user.email },
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
          avatar: user.avatar,
          createdAt: user.createdAt.toISOString(),
        },
        message: 'Login successful.',
      },
      { status: 200, headers: authResponse.headers }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
