import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import type { ApiResponse } from '@/types';

// POST /api/meetings/[id]/start - Start a meeting (host only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const meeting = await db.meeting.findUnique({ where: { id } });
    if (!meeting) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting not found.' },
        { status: 404 }
      );
    }

    if (meeting.hostId !== auth.user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the meeting host can start this meeting.' },
        { status: 403 }
      );
    }

    if (meeting.status === 'active') {
      return NextResponse.json<ApiResponse>(
        { success: true, message: 'Meeting is already active.' },
        { status: 200 }
      );
    }

    if (meeting.status === 'ended' || meeting.status === 'cancelled') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Cannot restart a meeting that has ended or been cancelled.' },
        { status: 400 }
      );
    }

    const updatedMeeting = await db.meeting.update({
      where: { id },
      data: { status: 'active' },
    });

    // Auto-join the host as a participant
    const existingHost = await db.meetingParticipant.findFirst({
      where: { meetingId: id, userId: auth.user.id, status: { in: ['active', 'waiting'] } },
    });

    if (!existingHost) {
      await db.meetingParticipant.create({
        data: {
          meetingId: id,
          userId: auth.user.id,
          email: auth.user.email,
          displayName: auth.user.name,
          role: 'host',
          status: 'active',
          mediaStatus: JSON.stringify({ audio: true, video: true }),
        },
      });
    }

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    createAuditLog({
      userId: auth.user.id,
      meetingId: id,
      action: 'meeting_started',
      details: { title: meeting.title },
      ipAddress: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: updatedMeeting.id,
        status: updatedMeeting.status,
        title: updatedMeeting.title,
        meetingCode: updatedMeeting.meetingCode,
        joinLink: updatedMeeting.joinLink,
      },
      message: 'Meeting started successfully.',
    });
  } catch (error) {
    console.error('Start meeting error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
