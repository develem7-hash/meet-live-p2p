import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { sendMeetingInvite } from '@/lib/email';
import type { ApiResponse } from '@/types';

// GET /api/meetings/[id]/invites - List invites for a meeting (host only)
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

    const meeting = await db.meeting.findUnique({ where: { id } });
    if (!meeting) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting not found.' },
        { status: 404 }
      );
    }

    if (meeting.hostId !== auth.user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the meeting host can view invites.' },
        { status: 403 }
      );
    }

    const invites = await db.meetingInvite.findMany({
      where: { meetingId: id },
      orderBy: { invitedAt: 'desc' },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: invites.map((inv) => ({
        id: inv.id,
        meetingId: inv.meetingId,
        email: inv.email,
        status: inv.status,
        guestName: inv.guestName,
        joinedAt: inv.joinedAt?.toISOString() || null,
        invitedAt: inv.invitedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('List invites error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// POST /api/meetings/[id]/invites - Add invites to a meeting (host only)
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
        { success: false, error: 'Only the meeting host can add invites.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { emails, guestNames } = body as { emails: string[]; guestNames?: Record<string, string> };

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'At least one email is required.' },
        { status: 400 }
      );
    }

    // Filter valid emails and deduplicate
    const validEmails = [...new Set(
      emails
        .filter((e: string) => typeof e === 'string' && e.includes('@'))
        .map((e: string) => e.toLowerCase())
    )];

    if (validEmails.length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No valid email addresses provided.' },
        { status: 400 }
      );
    }

    // Create invite records (skip existing)
    const existingInvites = await db.meetingInvite.findMany({
      where: { meetingId: id, email: { in: validEmails } },
      select: { email: true },
    });

    const existingEmails = new Set(existingInvites.map((inv) => inv.email));
    const newEmails = validEmails.filter((e) => !existingEmails.has(e));

    if (newEmails.length > 0) {
      await db.meetingInvite.createMany({
        data: newEmails.map((email) => ({
          meetingId: id,
          email,
          guestName: guestNames?.[email] || null,
        })),
      });

      // Update access rules for private meetings
      if (meeting.type === 'private') {
        const existingRule = await db.meetingAccessRule.findFirst({
          where: { meetingId: id, ruleType: 'email_whitelist', isActive: true },
        });

        if (existingRule) {
          const currentEmails: string[] = JSON.parse(existingRule.ruleValue);
          const updatedEmails = [...new Set([...currentEmails, ...newEmails])];
          await db.meetingAccessRule.update({
            where: { id: existingRule.id },
            data: { ruleValue: JSON.stringify(updatedEmails) },
          });
        } else {
          await db.meetingAccessRule.create({
            data: {
              meetingId: id,
              ruleType: 'email_whitelist',
              ruleValue: JSON.stringify(newEmails),
            },
          });
        }
      }

      // Send invite emails
      const emailPromises = newEmails.map((email) =>
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
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: `${newEmails.length} invite(s) sent. ${existingEmails.size} already invited.`,
        data: {
          newInvites: newEmails.length,
          alreadyInvited: existingEmails.size,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Add invites error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// DELETE /api/meetings/[id]/invites - Remove/revoke an invite (host only)
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

    const meeting = await db.meeting.findUnique({ where: { id } });
    if (!meeting) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Meeting not found.' },
        { status: 404 }
      );
    }

    if (meeting.hostId !== auth.user.id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Only the meeting host can remove invites.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { inviteId, email } = body as { inviteId?: string; email?: string };

    if (!inviteId && !email) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Either inviteId or email is required.' },
        { status: 400 }
      );
    }

    const whereClause = inviteId
      ? { id: inviteId, meetingId: id }
      : { email: email!.toLowerCase(), meetingId: id };

    const invite = await db.meetingInvite.findFirst({ where: whereClause });
    if (!invite) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invite not found.' },
        { status: 404 }
      );
    }

    await db.meetingInvite.update({
      where: { id: invite.id },
      data: { status: 'revoked' },
    });

    // Update access rules for private meetings
    if (meeting.type === 'private') {
      const existingRule = await db.meetingAccessRule.findFirst({
        where: { meetingId: id, ruleType: 'email_whitelist', isActive: true },
      });

      if (existingRule) {
        const currentEmails: string[] = JSON.parse(existingRule.ruleValue);
        const updatedEmails = currentEmails.filter((e) => e !== invite.email);
        await db.meetingAccessRule.update({
          where: { id: existingRule.id },
          data: { ruleValue: JSON.stringify(updatedEmails) },
        });
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Invite revoked successfully.',
    });
  } catch (error) {
    console.error('Remove invite error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
