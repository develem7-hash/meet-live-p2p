import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { sanitizeInput } from '@/lib/helpers';
import type { ApiResponse } from '@/types';

// GET /api/user/profile - Get user profile
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        timezone: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            hostedMeetings: true,
            meetingParticipants: true,
            notifications: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'User not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        timezone: user.timezone,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        stats: user._count,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}

// PUT /api/user/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, timezone, avatar } = body as { name?: string; timezone?: string; avatar?: string };

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      const sanitizedName = sanitizeInput(name);
      if (sanitizedName.length < 1 || sanitizedName.length > 100) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Name must be between 1 and 100 characters.' },
          { status: 400 }
        );
      }
      updateData.name = sanitizedName;
    }

    if (timezone !== undefined) {
      const availableTimezones = [
        'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
        'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
        'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
        'Australia/Sydney', 'Pacific/Auckland',
      ];
      if (!availableTimezones.includes(timezone)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Invalid timezone.' },
          { status: 400 }
        );
      }
      updateData.timezone = timezone;
    }

    if (avatar !== undefined) {
      if (avatar !== null && typeof avatar === 'string' && avatar.length > 500) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Avatar URL is too long.' },
          { status: 400 }
        );
      }
      updateData.avatar = avatar;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'No valid fields to update.' },
        { status: 400 }
      );
    }

    const updatedUser = await db.user.update({
      where: { id: auth.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        timezone: true,
        isEmailVerified: true,
        updatedAt: true,
      },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatar: updatedUser.avatar,
        timezone: updatedUser.timezone,
        isEmailVerified: updatedUser.isEmailVerified,
        updatedAt: updatedUser.updatedAt.toISOString(),
      },
      message: 'Profile updated successfully.',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
