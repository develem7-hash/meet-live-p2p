import { db } from '@/lib/db';
import type { AuditAction } from '@/types';

export async function createAuditLog(params: {
  userId?: string;
  meetingId?: string;
  action: AuditAction;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        meetingId: params.meetingId,
        action: params.action,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error('Audit log creation failed:', error);
  }
}
