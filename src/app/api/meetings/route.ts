import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { createAuditLog } from '@/lib/audit';
import { generateMeetingCode, generateJoinLink, generateJoinToken, sanitizeInput } from '@/lib/helpers';
import { sendMeetingInvite, EmailTemplates } from '@/lib/email';
import { notifyMeetingInvites } from '@/lib/notifications';
import type { ApiResponse, PaginatedResponse, MeetingType, CreateMeetingRequest } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      OR: [
        { hostId: auth.user.id },
        { participants: { some: { userId: auth.user.id } } },
      ],
    };

    if (status && ['scheduled', 'active', 'ended', 'cancelled'].includes(status)) {
      where.status = status;
    }

    const [meetings, total] = await Promise.all([
      db.meeting.findMany({
        where,
        include: {
          host: { select: { id: true, name: true, avatar: true } },
          _count: {
            select: { invites: true, participants: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.meeting.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json<PaginatedResponse<unknown>>({
      success: true,
      data: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        hostId: m.hostId,
        hostName: m.host.name,
        hostAvatar: m.host.avatar,
        type: m.type,
        meetingCode: m.meetingCode,
        joinLink: m.joinLink,
        scheduledDate: m.scheduledDate?.toISOString() || null,
        startTime: m.startTime?.toISOString() || null,
        endTime: m.endTime?.toISOString() || null,
        timezone: m.timezone,
        waitingRoomEnabled: m.waitingRoomEnabled,
        muteOnEntry: m.muteOnEntry,
        audioOnlyAllowed: m.audioOnlyAllowed,
        isLocked: m.isLocked,
        status: m.status,
        maxParticipants: m.maxParticipants,
        expiresAt: m.expiresAt?.toISOString() || null,
        recurringPattern: m.recurringPattern,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        _count: m._count,
      })),
      pagination: { page, limit, total, totalPages },
    });
  } catch (error) {
    console.error('List meetings error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const body: CreateMeetingRequest = await request.json();
    const {
      title,
      description,
      type = 'public',
      scheduledDate,
      startTime,
      endTime,
      timezone = 'UTC',
      waitingRoomEnabled = false,
      muteOnEntry = false,
      audioOnlyAllowed = false,
      maxParticipants = 50,
      expiresAt,
      recurringPattern,
      recurringEndDate,
      syncToCalendar = false,
      inviteEmails = [],
    } = body;

    if (!title || sanitizeInput(title).length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting title is required.' },
        { status: 400 }
      );
    }

    if (!['public', 'private'].includes(type)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting type must be "public" or "private".' },
        { status: 400 }
      );
    }

    const meetingCode = generateMeetingCode();
    const joinLink = generateJoinLink(meetingCode);

    // Validate invite emails
    const validInviteEmails = inviteEmails.filter((email) => {
      return typeof email === 'string' && email.includes('@');
    });

    const meetingData: Record<string, unknown> = {
      title: sanitizeInput(title).substring(0, 200),
      description: description ? sanitizeInput(description).substring(0, 2000) : null,
      hostId: auth.user.id,
      hostName: auth.user.name,
      type: type as MeetingType,
      meetingCode,
      joinLink,
      timezone,
      waitingRoomEnabled,
      muteOnEntry,
      audioOnlyAllowed,
      maxParticipants: Math.min(500, Math.max(2, maxParticipants)),
      recurringPattern: recurringPattern || null,
    };

    if (type === 'private') {
      meetingData.joinToken = generateJoinToken();
    }

    if (scheduledDate) {
      meetingData.scheduledDate = new Date(scheduledDate);
    }
    if (startTime) {
      meetingData.startTime = new Date(startTime);
    }
    if (endTime) {
      meetingData.endTime = new Date(endTime);
    }
    if (expiresAt) {
      meetingData.expiresAt = new Date(expiresAt);
    }
    if (recurringEndDate) {
      meetingData.recurringEndDate = new Date(recurringEndDate);
    }

    const meeting = await db.meeting.create({
      data: meetingData as Parameters<typeof db.meeting.create>[0]['data'],
    });

    // Create invite records
    if (validInviteEmails.length > 0) {
      const uniqueEmails = [...new Set(validInviteEmails.map((e) => e.toLowerCase()))];
      await db.meetingInvite.createMany({
        data: uniqueEmails.map((email) => ({
          meetingId: meeting.id,
          email,
        })),
      });

      // Create access rule for private meetings
      if (type === 'private') {
        await db.meetingAccessRule.create({
          data: {
            meetingId: meeting.id,
            ruleType: 'email_whitelist',
            ruleValue: JSON.stringify(uniqueEmails),
          },
        });
      }

      // Send invite emails asynchronously
      const emailPromises = uniqueEmails.map((email) =>
        sendMeetingInvite(email, {
          meetingTitle: meeting.title,
          hostName: auth.user.name,
          date: meeting.scheduledDate ? meeting.scheduledDate.toLocaleDateString() : 'Instant',
          time: meeting.startTime ? meeting.startTime.toLocaleTimeString() : 'Now',
          timezone: meeting.timezone,
          joinLink: meeting.joinLink,
          meetingType: meeting.type,
        }).catch((err) => console.error(`Failed to send invite to ${email}:`, err))
      );
      await Promise.all(emailPromises);

      notifyMeetingInvites(meeting.title, meeting.meetingCode, uniqueEmails, auth.user.name).catch(() => {});
    }

    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    createAuditLog({
      userId: auth.user.id,
      meetingId: meeting.id,
      action: 'meeting_created',
      details: { title: meeting.title, type: meeting.type, inviteCount: validInviteEmails.length },
      ipAddress: clientIp,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          id: meeting.id,
          title: meeting.title,
          description: meeting.description,
          hostId: meeting.hostId,
          hostName: meeting.hostName,
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
          createdAt: meeting.createdAt.toISOString(),
          updatedAt: meeting.updatedAt.toISOString(),
        },
        message: 'Meeting created successfully.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create meeting error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
