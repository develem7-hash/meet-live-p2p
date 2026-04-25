import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/notifications';
import type { ApiResponse } from '@/types';

// POST /api/user/notifications/read - Mark notification as read
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationId, markAll } = body as { notificationId?: string; markAll?: boolean };

    if (markAll) {
      await markAllNotificationsRead(auth.user.id);
      return NextResponse.json<ApiResponse>({
        success: true,
        message: 'All notifications marked as read.',
      });
    }

    if (!notificationId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'notificationId is required.' },
        { status: 400 }
      );
    }

    const result = await markNotificationRead(notificationId, auth.user.id);

    if (result.count === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Notification not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Notification marked as read.',
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
