import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from '@/lib/auth';
import { createAuthResponse } from '@/lib/api-auth';
import type { ApiResponse, JWTPayload } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    let refreshTokenValue: string | null = null;

    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce(
        (acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>
      );
      refreshTokenValue = cookies.refreshToken || null;
    }

    if (!refreshTokenValue) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No refresh token provided.' },
        { status: 401 }
      );
    }

    const payload = verifyRefreshToken(refreshTokenValue);
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid or expired refresh token.' },
        { status: 401 }
      );
    }

    const session = await db.userSession.findUnique({
      where: { refreshToken: refreshTokenValue },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Session expired. Please log in again.' },
        { status: 401 }
      );
    }

    await db.userSession.delete({
      where: { id: session.id },
    });

    const jwtPayload: JWTPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    const newAccessToken = generateAccessToken(jwtPayload);
    const newRefreshToken = generateRefreshToken(jwtPayload);

    const authResponse = createAuthResponse(newAccessToken, newRefreshToken);

    await db.userSession.create({
      data: {
        userId: payload.userId,
        refreshToken: newRefreshToken,
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
        message: 'Tokens refreshed successfully.',
      },
      { status: 200, headers: authResponse.headers }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
