import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { getNotifications } from '@/lib/notifications';
import type { ApiResponse } from '@/types';

// GET /api/user/notifications - Get notifications for user
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
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const notifications = await getNotifications(auth.user.id, unreadOnly);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
