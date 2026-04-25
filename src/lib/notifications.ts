import { db } from '@/lib/db';

export interface NotificationCreateParams {
  userId: string;
  type: 'meeting_invite' | 'meeting_reminder' | 'meeting_updated' | 'meeting_cancelled';
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export async function createNotification(params: NotificationCreateParams) {
  return db.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data ? JSON.stringify(params.data) : null,
    },
  });
}

export async function getNotifications(userId: string, unreadOnly: boolean = false) {
  return db.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function markNotificationRead(notificationId: string, userId: string) {
  return db.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function notifyMeetingInvites(meetingTitle: string, meetingCode: string, emails: string[], hostName: string) {
  // In production, this would look up users by email and create notifications
  // For now, this is a placeholder that can be connected to the full system
  console.log(`[Notification] Meeting invites sent for "${meetingTitle}" (${meetingCode}) by ${hostName}`);
  console.log(`[Notification] Invite count: ${emails.length}`);
}

export async function notifyMeetingUpdated(meetingId: string, title: string, updatedFields: string[]) {
  console.log(`[Notification] Meeting updated: "${title}" (${meetingId}). Changed: ${updatedFields.join(', ')}`);
}

export async function notifyMeetingCancelled(meetingId: string, title: string) {
  console.log(`[Notification] Meeting cancelled: "${title}" (${meetingId})`);
}

export async function notifyMeetingReminder(meetingId: string, title: string, scheduledDate: string) {
  console.log(`[Notification] Meeting reminder: "${title}" scheduled for ${scheduledDate}`);
}
