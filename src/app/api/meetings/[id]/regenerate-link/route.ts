import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { generateJoinToken, generateJoinLink } from '@/lib/helpers';
import { createAuditLog } from '@/lib/audit';
import type { ApiResponse } from '@/types';

// POST /api/meetings/[id]/regenerate-link - Regenerate meeting link (host only)
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
        { success: false, error: 'Only the meeting host can regenerate the meeting link.' },
        { status: 403 }
      );
    }

    // Regenerate the join token and meeting code
    const newMeetingCode = generateMeetingCode();
    const newJoinLink = generateJoinLink(newMeetingCode);
    const newJoinToken = generateJoinToken();

    const updatedMeeting = await db.meeting.update({
      where: { id },
      data: {
        meetingCode: newMeetingCode,
        joinLink: newJoinLink,
        joinToken: newJoinToken,
      },
    });

    // Revoke all pending invites (they will need new links)
    await db.meetingInvite.updateMany({
      where: { meetingId: id, status: 'pending' },
      data: { status: 'revoked' },
    });

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    createAuditLog({
      userId: auth.user.id,
      meetingId: id,
      action: 'link_regenerated',
      details: { oldCode: meeting.meetingCode, newCode: newMeetingCode },
      ipAddress: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: updatedMeeting.id,
        meetingCode: updatedMeeting.meetingCode,
        joinLink: updatedMeeting.joinLink,
        joinToken: updatedMeeting.joinToken,
      },
      message: 'Meeting link regenerated successfully. All previous invites have been revoked.',
    });
  } catch (error) {
    console.error('Regenerate link error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
