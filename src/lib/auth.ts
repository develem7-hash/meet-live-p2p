import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'meetlive-dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'meetlive-refresh-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '15m';
const JWT_REFRESH_EXPIRES_IN = '7d';

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function generateRefreshToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function generateEmailVerificationToken(userId: string): string {
  return jwt.sign({ userId, type: 'email_verification' }, JWT_SECRET, { expiresIn: '24h' });
}

export function generatePasswordResetToken(userId: string): string {
  return jwt.sign({ userId, type: 'password_reset' }, JWT_SECRET, { expiresIn: '1h' });
}

export function verifyEmailToken(token: string): { userId: string; type: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; type: string };
  } catch {
    return null;
  }
}
