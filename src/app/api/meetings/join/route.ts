import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { sanitizeInput } from '@/lib/helpers';
import type { ApiResponse } from '@/types';

// POST /api/meetings/join - Join a meeting by meetingCode
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    const body = await request.json();
    const { meetingCode, displayName, email, joinToken } = body as {
      meetingCode: string;
      displayName?: string;
      email?: string;
      joinToken?: string;
    };

    if (!meetingCode) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting code is required.' },
        { status: 400 }
      );
    }

    const meeting = await db.meeting.findUnique({
      where: { meetingCode },
      include: {
        accessRules: { select: { id: true, ruleType: true, ruleValue: true, isActive: true } },
      },
    });

    if (!meeting) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting not found.' },
        { status: 404 }
      );
    }

    const id = meeting.id;

    // Check meeting status
    if (!['active', 'scheduled'].includes(meeting.status)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'This meeting is not available to join.' },
        { status: 400 }
      );
    }

    const participantEmail = auth?.user?.email || email || '';
    const participantName = displayName || auth?.user?.name || 'Anonymous';

    if (!participantEmail) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email is required to join a meeting.' },
        { status: 400 }
      );
    }

    // Check if meeting is locked
    if (meeting.isLocked) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'This meeting is locked.' },
        { status: 403 }
      );
    }

    // For private meetings, validate access
    if (meeting.type === 'private') {
      // If a joinToken is provided, validate it
      if (meeting.joinToken && joinToken === meeting.joinToken) {
        // Token valid, allow join
      } else {
        // Check if email is in invites list
        const invite = await db.meetingInvite.findFirst({
          where: {
            meetingId: id,
            email: participantEmail.toLowerCase(),
            status: 'pending',
          },
        });

        if (!invite) {
          // Also check access rules
          const hasAccess = meeting.accessRules.some((rule) => {
            if (!rule.isActive) return false;
            if (rule.ruleType === 'email_whitelist') {
              const allowedEmails: string[] = JSON.parse(rule.ruleValue);
              return allowedEmails.some((e) => e.toLowerCase() === participantEmail.toLowerCase());
            }
            return false;
          });

          if (!hasAccess) {
            createAuditLog({
              userId: auth?.user?.id,
              meetingId: id,
              action: 'access_denied',
              details: { email: participantEmail, reason: 'not_invited' },
              ipAddress: clientIp,
              userAgent: request.headers.get('user-agent') || undefined,
            });

            return NextResponse.json<ApiResponse>(
              { success: false, error: 'You are not authorized to join this private meeting.' },
              { status: 403 }
            );
          }
        }
      }
    }

    // Check max participants
    const activeParticipants = await db.meetingParticipant.count({
      where: { meetingId: id, status: 'active' },
    });

    if (activeParticipants >= meeting.maxParticipants) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'This meeting has reached the maximum number of participants.' },
        { status: 400 }
      );
    }

    // Check if already joined
    const existingParticipant = await db.meetingParticipant.findFirst({
      where: {
        meetingId: id,
        email: participantEmail.toLowerCase(),
        status: { in: ['active', 'waiting'] },
      },
    });

    if (existingParticipant) {
      return NextResponse.json<ApiResponse>(
        {
          success: true,
          data: {
            meetingId: existingParticipant.meetingId,
            participantId: existingParticipant.id,
            userId: existingParticipant.userId,
            email: existingParticipant.email,
            displayName: existingParticipant.displayName,
            role: existingParticipant.role,
            status: existingParticipant.status,
            mediaStatus: JSON.parse(existingParticipant.mediaStatus),
            joinedAt: existingParticipant.joinedAt.toISOString(),
          },
          message: 'You are already in this meeting.',
        },
        { status: 200 }
      );
    }

    // Determine role
    const role = meeting.hostId === auth?.user?.id ? 'host' : 'participant';

    // Determine status (waiting room check)
    const participantStatus = meeting.waitingRoomEnabled && role !== 'host' ? 'waiting' : 'active';

    // Create participant record
    const participant = await db.meetingParticipant.create({
      data: {
        meetingId: id,
        userId: auth?.user?.id || null,
        email: participantEmail.toLowerCase(),
        displayName: sanitizeInput(participantName).substring(0, 100),
        role,
        status: participantStatus,
        mediaStatus: JSON.stringify({ audio: !meeting.muteOnEntry, video: true }),
      },
    });

    // Update invite status if applicable
    await db.meetingInvite.updateMany({
      where: { meetingId: id, email: participantEmail.toLowerCase(), status: 'pending' },
      data: { status: 'accepted', joinedAt: new Date() },
    });

    createAuditLog({
      userId: auth?.user?.id,
      meetingId: id,
      action: 'meeting_joined',
      details: { email: participantEmail, role, status: participantStatus },
      ipAddress: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          meetingId: participant.meetingId,
          participantId: participant.id,
          userId: participant.userId,
          email: participant.email,
          displayName: participant.displayName,
          role: participant.role,
          status: participant.status,
          mediaStatus: JSON.parse(participant.mediaStatus),
          joinedAt: participant.joinedAt.toISOString(),
        },
        message: participantStatus === 'waiting'
          ? 'You have joined the waiting room. The host will admit you shortly.'
          : 'Joined meeting successfully.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Join meeting error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
