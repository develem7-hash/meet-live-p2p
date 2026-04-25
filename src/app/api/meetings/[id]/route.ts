import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { notifyMeetingUpdated, notifyMeetingCancelled } from '@/lib/notifications';
import { sendMeetingCancellationEmail } from '@/lib/email';
import { sanitizeInput } from '@/lib/helpers';
import type { ApiResponse, UpdateMeetingRequest } from '@/types';

// GET /api/meetings/[id]
export async function GET(
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

    const meeting = await db.meeting.findUnique({
      where: { id },
      include: {
        host: { select: { id: true, name: true, avatar: true } },
        _count: {
          select: { invites: true, participants: true },
        },
        accessRules: {
          select: { id: true, ruleType: true, ruleValue: true, isActive: true },
        },
      },
    });

    if (!meeting) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting not found.' },
        { status: 404 }
      );
    }

    // Check access: host, invited participant, or public
    const isHost = meeting.hostId === auth.user.id;
    const isParticipant = meeting.type === 'public' || isHost;

    if (!isHost && !isParticipant) {
      const hasInvite = await db.meetingInvite.findFirst({
        where: { meetingId: id, email: auth.user.email, status: 'pending' },
      });
      if (!hasInvite) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Access denied.' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: meeting.id,
        title: meeting.title,
        description: meeting.description,
        hostId: meeting.hostId,
        hostName: meeting.host.name,
        hostAvatar: meeting.host.avatar,
        type: meeting.type,
        meetingCode: meeting.meetingCode,
        joinLink: meeting.joinLink,
        joinToken: meeting.joinToken || null,
        scheduledDate: meeting.scheduledDate?.toISOString() || null,
        startTime: meeting.startTime?.toISOString() || null,
        endTime: meeting.endTime?.toISOString() || null,
        timezone: meeting.timezone,
        waitingRoomEnabled: meeting.waitingRoomEnabled,
        muteOnEntry: meeting.muteOnEntry,
        audioOnlyAllowed: meeting.audioOnlyAllowed,
        isLocked: meeting.isLocked,
        status: meeting.status,
        maxParticipants: meeting.maxParticipants,
        expiresAt: meeting.expiresAt?.toISOString() || null,
        recurringPattern: meeting.recurringPattern,
        googleCalendarEventId: meeting.googleCalendarEventId,
        accessRules: meeting.accessRules,
        createdAt: meeting.createdAt.toISOString(),
        updatedAt: meeting.updatedAt.toISOString(),
        _count: meeting._count,
      },
    });
  } catch (error) {
    console.error('Get meeting error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// PUT /api/meetings/[id]
export async function PUT(
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
        { success: false, error: 'Only the meeting host can update this meeting.' },
        { status: 403 }
      );
    }

    const body: UpdateMeetingRequest = await request.json();
    const updateData: Record<string, unknown> = {};

    const allowedFields: (keyof UpdateMeetingRequest)[] = [
      'title', 'description', 'type', 'scheduledDate', 'startTime', 'endTime',
      'timezone', 'waitingRoomEnabled', 'muteOnEntry', 'audioOnlyAllowed',
      'maxParticipants', 'isLocked', 'status',
    ];

    const updatedFields: string[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'title' && body[field]) {
          updateData[field] = sanitizeInput(body[field] as string).substring(0, 200);
        } else if (field === 'description') {
          updateData[field] = body[field] ? sanitizeInput(body[field] as string).substring(0, 2000) : null;
        } else if (field === 'maxParticipants') {
          updateData[field] = Math.min(500, Math.max(2, body[field] as number));
        } else {
          updateData[field] = body[field];
        }
        updatedFields.push(field);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No valid fields to update.' },
        { status: 400 }
      );
    }

    const updatedMeeting = await db.meeting.update({
      where: { id },
      data: updateData,
    });

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    createAuditLog({
      userId: auth.user.id,
      meetingId: meeting.id,
      action: 'meeting_updated',
      details: { updatedFields },
      ipAddress: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    notifyMeetingUpdated(meeting.id, meeting.title, updatedFields).catch(() => {});

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: updatedMeeting.id,
        title: updatedMeeting.title,
        description: updatedMeeting.description,
        type: updatedMeeting.type,
        meetingCode: updatedMeeting.meetingCode,
        joinLink: updatedMeeting.joinLink,
        scheduledDate: updatedMeeting.scheduledDate?.toISOString() || null,
        startTime: updatedMeeting.startTime?.toISOString() || null,
        endTime: updatedMeeting.endTime?.toISOString() || null,
        timezone: updatedMeeting.timezone,
        waitingRoomEnabled: updatedMeeting.waitingRoomEnabled,
        muteOnEntry: updatedMeeting.muteOnEntry,
        audioOnlyAllowed: updatedMeeting.audioOnlyAllowed,
        isLocked: updatedMeeting.isLocked,
        status: updatedMeeting.status,
        maxParticipants: updatedMeeting.maxParticipants,
        updatedAt: updatedMeeting.updatedAt.toISOString(),
      },
      message: 'Meeting updated successfully.',
    });
  } catch (error) {
    console.error('Update meeting error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// DELETE /api/meetings/[id]
export async function DELETE(
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

    const meeting = await db.meeting.findUnique({
      where: { id },
      include: { invites: { select: { email: true } } },
    });

    if (!meeting) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting not found.' },
        { status: 404 }
      );
    }

    if (meeting.hostId !== auth.user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the meeting host can delete this meeting.' },
        { status: 403 }
      );
    }

    // Cancel active participants
    await db.meetingParticipant.updateMany({
      where: { meetingId: id, status: 'active' },
      data: { status: 'removed', leftAt: new Date() },
    });

    // Revoke all invites
    await db.meetingInvite.updateMany({
      where: { meetingId: id },
      data: { status: 'revoked' },
    });

    // Mark meeting as cancelled
    const cancelledMeeting = await db.meeting.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    // Send cancellation emails
    const emailPromises = meeting.invites.map((invite) =>
      sendMeetingCancellationEmail(invite.email, {
        meetingTitle: meeting.title,
        hostName: auth.user.name,
        scheduledDate: meeting.scheduledDate
          ? meeting.scheduledDate.toLocaleDateString()
          : 'Unscheduled',
      }).catch((err) => console.error(`Failed to send cancellation to ${invite.email}:`, err))
    );
    await Promise.all(emailPromises);

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    createAuditLog({
      userId: auth.user.id,
      meetingId: id,
      action: 'meeting_cancelled',
      details: { title: meeting.title },
      ipAddress: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    notifyMeetingCancelled(id, meeting.title).catch(() => {});

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Meeting cancelled successfully.',
      data: { id: cancelledMeeting.id, status: cancelledMeeting.status },
    });
  } catch (error) {
    console.error('Delete meeting error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
