import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import type { ApiResponse } from '@/types';

// POST /api/meetings/[id]/end - End a meeting (host only)
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
        { success: false, error: 'Only the meeting host can end this meeting.' },
        { status: 403 }
      );
    }

    if (meeting.status !== 'active') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only active meetings can be ended.' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Mark all active participants as left
    await db.meetingParticipant.updateMany({
      where: { meetingId: id, status: 'active' },
      data: { status: 'left', leftAt: now },
    });

    // Mark all waiting participants as left
    await db.meetingParticipant.updateMany({
      where: { meetingId: id, status: 'waiting' },
      data: { status: 'left', leftAt: now },
    });

    // Update meeting status
    const updatedMeeting = await db.meeting.update({
      where: { id },
      data: {
        status: 'ended',
        endTime: now,
      },
    });

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    createAuditLog({
      userId: auth.user.id,
      meetingId: id,
      action: 'meeting_ended',
      details: { title: meeting.title, duration: Math.round((now.getTime() - (meeting.startTime?.getTime() || now.getTime())) / 60000) },
      ipAddress: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: updatedMeeting.id,
        status: updatedMeeting.status,
        title: updatedMeeting.title,
        endedAt: now.toISOString(),
      },
      message: 'Meeting ended successfully.',
    });
  } catch (error) {
    console.error('End meeting error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
