import { db } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import type { JWTPayload } from '@/types';
import { NextRequest } from 'next/server';
import { parse } from 'cookie';

export interface AuthContext {
  user: {
    id: string;
    email: string;
    name: string;
    isEmailVerified: boolean;
  };
}

export async function authenticateRequest(request: NextRequest): Promise<AuthContext | null> {
  try {
    const cookieHeader = request.headers.get('cookie');
    let token: string | null = null;

    if (cookieHeader) {
      const cookies = parse(cookieHeader);
      token = cookies.accessToken || null;
    }

    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) return null;

    const payload: JWTPayload | null = verifyAccessToken(token);
    if (!payload) return null;

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, isEmailVerified: true },
    });

    if (!user) return null;

    return { user };
  } catch {
    return null;
  }
}

export function createAuthResponse(accessToken: string, refreshToken: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    headers: {
      'Set-Cookie': [
        `accessToken=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=900${isProduction ? '; Secure' : ''}`,
        `refreshToken=${refreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${isProduction ? '; Secure' : ''}`,
      ].join(', '),
    },
  };
}
