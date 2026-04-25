import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyRefreshToken } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit';
import type { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie');
    let refreshToken: string | null = null;

    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce(
        (acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>
      );
      refreshToken = cookies.refreshToken || null;
    }

    if (refreshToken) {
      const payload = verifyRefreshToken(refreshToken);
      if (payload) {
        await db.userSession.deleteMany({
          where: { refreshToken },
        });

        const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        createAuditLog({
          userId: payload.userId,
          action: 'user_logout',
          ipAddress: clientIp,
          userAgent: request.headers.get('user-agent') || undefined,
        });
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'Logged out successfully.' },
      {
        status: 200,
        headers: {
          'Set-Cookie': [
            `accessToken=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`,
            `refreshToken=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? '; Secure' : ''}`,
          ].join(', '),
        },
      }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
