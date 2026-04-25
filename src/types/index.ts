// ============================================
// MeetLive - Type Definitions
// ============================================

// Auth Types
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// Meeting Types
export type MeetingType = 'public' | 'private';
export type MeetingStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';
export type InviteStatus = 'pending' | 'accepted' | 'rejected' | 'revoked';
export type ParticipantRole = 'host' | 'participant' | 'co_host';
export type ParticipantStatus = 'waiting' | 'active' | 'left' | 'removed';

export interface CreateMeetingRequest {
  title: string;
  description?: string;
  type: MeetingType;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  waitingRoomEnabled?: boolean;
  muteOnEntry?: boolean;
  audioOnlyAllowed?: boolean;
  maxParticipants?: number;
  expiresAt?: string;
  recurringPattern?: string;
  recurringEndDate?: string;
  syncToCalendar?: boolean;
  inviteEmails?: string[];
}

export interface UpdateMeetingRequest {
  title?: string;
  description?: string;
  type?: MeetingType;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  waitingRoomEnabled?: boolean;
  muteOnEntry?: boolean;
  audioOnlyAllowed?: boolean;
  maxParticipants?: number;
  isLocked?: boolean;
  status?: MeetingStatus;
}

export interface MeetingResponse {
  id: string;
  title: string;
  description: string | null;
  hostId: string;
  hostName: string | null;
  type: MeetingType;
  meetingCode: string;
  joinLink: string;
  scheduledDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  waitingRoomEnabled: boolean;
  muteOnEntry: boolean;
  audioOnlyAllowed: boolean;
  isLocked: boolean;
  status: MeetingStatus;
  maxParticipants: number;
  expiresAt: string | null;
  recurringPattern: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    invites: number;
    participants: number;
  };
}

export interface JoinMeetingRequest {
  meetingCode: string;
  displayName?: string;
  email?: string;
  joinToken?: string;
}

export interface MeetingInviteResponse {
  id: string;
  meetingId: string;
  email: string;
  status: InviteStatus;
  guestName: string | null;
  joinedAt: string | null;
  invitedAt: string;
}

export interface MeetingParticipantResponse {
  id: string;
  meetingId: string;
  userId: string | null;
  email: string;
  displayName: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  mediaStatus: MediaStatus;
  joinedAt: string;
  leftAt: string | null;
}

export interface MediaStatus {
  audio: boolean;
  video: boolean;
}

// Calendar Types
export interface CalendarIntegration {
  id: string;
  userId: string;
  provider: 'google' | 'outlook';
  isEnabled: boolean;
  createdAt: string;
}

// Notification Types
export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  message: string;
  data: string | null;
  isRead: boolean;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Signaling Types (mediasoup)
export interface SignalingMessage {
  type: string;
  payload?: Record<string, unknown>;
}

export interface JoinRoomPayload {
  meetingId: string;
  userId?: string;
  displayName: string;
  email: string;
  role: ParticipantRole;
}

export interface MediaTransportPayload {
  dtlsParameters: Record<string, unknown>;
}

export interface ProducePayload {
  kind: 'audio' | 'video';
  rtpParameters: Record<string, unknown>;
}

export interface ConsumePayload {
  producerId: string;
  rtpCapabilities: Record<string, unknown>;
}

// Connection Quality
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';

// Audit Log Types
export type AuditAction =
  | 'user_registered'
  | 'user_login'
  | 'user_logout'
  | 'meeting_created'
  | 'meeting_updated'
  | 'meeting_cancelled'
  | 'meeting_started'
  | 'meeting_ended'
  | 'meeting_joined'
  | 'meeting_left'
  | 'participant_muted'
  | 'participant_unmuted'
  | 'participant_removed'
  | 'participant_approved'
  | 'meeting_locked'
  | 'meeting_unlocked'
  | 'link_regenerated'
  | 'access_denied';
