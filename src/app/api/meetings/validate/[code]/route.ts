import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import type { ApiResponse } from '@/types';

// POST /api/meetings/validate/[code] - Validate if a user can join a meeting by code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || code.length < 1) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting code is required.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { email } = body as { email?: string };
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    const meeting = await db.meeting.findUnique({
      where: { meetingCode: code },
      include: {
        host: { select: { id: true, name: true, avatar: true } },
        accessRules: { select: { id: true, ruleType: true, ruleValue: true, isActive: true } },
      },
    });

    if (!meeting) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting not found.' },
        { status: 404 }
      );
    }

    // Check meeting status
    if (!['active', 'scheduled'].includes(meeting.status)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `This meeting has been ${meeting.status}.`,
        data: {
          meetingExists: true,
          status: meeting.status,
          title: meeting.title,
        },
      });
    }

    // Check if meeting is locked
    if (meeting.isLocked) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'This meeting is currently locked.',
        data: {
          meetingExists: true,
          status: meeting.status,
          title: meeting.title,
          isLocked: true,
        },
      });
    }

    let accessGranted = false;
    let accessReason = '';
    let requiresEmail = false;

    if (meeting.type === 'public') {
      accessGranted = true;
      accessReason = 'Public meeting - open access';
    } else {
      // Private meeting - check if email is in invited list
      if (!email) {
        requiresEmail = true;
        accessGranted = false;
        accessReason = 'Email required for private meeting access verification';
      } else {
        // Check invites
        const invite = await db.meetingInvite.findFirst({
          where: {
            meetingId: meeting.id,
            email: email.toLowerCase(),
            status: 'pending',
          },
        });

        if (invite) {
          accessGranted = true;
          accessReason = 'Invited to private meeting';
        } else {
          // Check access rules
          const hasAccess = meeting.accessRules.some((rule) => {
            if (!rule.isActive) return false;
            if (rule.ruleType === 'email_whitelist') {
              const allowedEmails: string[] = JSON.parse(rule.ruleValue);
              return allowedEmails.some((e) => e.toLowerCase() === email.toLowerCase());
            }
            return false;
          });

          if (hasAccess) {
            accessGranted = true;
            accessReason = 'Access granted via whitelist rule';
          } else {
            accessGranted = false;
            accessReason = 'Not authorized to join this private meeting';

            createAuditLog({
              meetingId: meeting.id,
              action: 'access_denied',
              details: { email, reason: 'not_in_invite_list', code },
              ipAddress: clientIp,
              userAgent: request.headers.get('user-agent') || undefined,
            });
          }
        }
      }
    }

    // Get participant count
    const activeParticipants = await db.meetingParticipant.count({
      where: { meetingId: meeting.id, status: 'active' },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        canJoin: accessGranted,
        reason: accessReason,
        requiresEmail,
        meeting: {
          id: meeting.id,
          title: meeting.title,
          description: meeting.description,
          type: meeting.type,
          status: meeting.status,
          hostName: meeting.host.name,
          hostAvatar: meeting.host.avatar,
          scheduledDate: meeting.scheduledDate?.toISOString() || null,
          startTime: meeting.startTime?.toISOString() || null,
          endTime: meeting.endTime?.toISOString() || null,
          timezone: meeting.timezone,
          waitingRoomEnabled: meeting.waitingRoomEnabled,
          muteOnEntry: meeting.muteOnEntry,
          audioOnlyAllowed: meeting.audioOnlyAllowed,
          maxParticipants: meeting.maxParticipants,
          activeParticipants,
          isFull: activeParticipants >= meeting.maxParticipants,
          joinLink: meeting.joinLink,
        },
      },
    });
  } catch (error) {
    console.error('Validate access error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
