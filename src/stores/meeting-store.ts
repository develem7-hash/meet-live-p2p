'use client';

import { create } from 'zustand';
import type {
  ApiResponse,
  CreateMeetingRequest,
  UpdateMeetingRequest,
  MeetingResponse,
  MeetingInviteResponse,
  MeetingParticipantResponse,
  MeetingStatus,
  ConnectionQuality,
} from '@/types';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'include',
    ...options,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || json.message || 'Request failed');
  }
  return json as T;
}

interface MeetingState {
  meetings: MeetingResponse[];
  currentMeeting: MeetingResponse | null;
  currentParticipantId: string | null;
  participants: MeetingParticipantResponse[];
  invites: MeetingInviteResponse[];
  isLoading: boolean;
  meetingTimer: number;
  connectionQuality: ConnectionQuality;
  latency: number;

  createMeeting: (data: CreateMeetingRequest) => Promise<MeetingResponse>;
  fetchMeetings: (status?: MeetingStatus) => Promise<void>;
  fetchMeeting: (id: string) => Promise<void>;
  updateMeeting: (id: string, data: UpdateMeetingRequest) => Promise<MeetingResponse>;
  deleteMeeting: (id: string) => Promise<void>;
  startMeeting: (id: string) => Promise<void>;
  endMeeting: (id: string) => Promise<void>;
  joinMeeting: (meetingCode: string, displayName?: string, email?: string) => Promise<{ meetingId: string; participantId: string }>;
  validateAccess: (meetingCode: string, email?: string) => Promise<{ allowed: boolean; requiresAuth: boolean }>;
  regenerateLink: (id: string) => Promise<{ joinLink: string; meetingCode: string }>;

  fetchParticipants: (meetingId: string) => Promise<void>;
  fetchInvites: (meetingId: string) => Promise<void>;
  addInvite: (meetingId: string, email: string, guestName?: string) => Promise<void>;
  removeInvite: (meetingId: string, inviteId: string) => Promise<void>;
  resendInvite: (meetingId: string, inviteId: string) => Promise<void>;
  muteParticipant: (meetingId: string, participantId: string) => Promise<void>;
  removeParticipant: (meetingId: string, participantId: string) => Promise<void>;
  leaveMeeting: (meetingId: string) => Promise<void>;

  setCurrentMeeting: (meeting: MeetingResponse | null) => void;
  setCurrentParticipantId: (id: string | null) => void;
  setMeetingTimer: (seconds: number) => void;
  setConnectionQuality: (quality: ConnectionQuality) => void;
  setLatency: (ms: number) => void;
  resetMeetingState: () => void;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  meetings: [],
  currentMeeting: null,
  currentParticipantId: null,
  participants: [],
  invites: [],
  isLoading: false,
  meetingTimer: 0,
  connectionQuality: 'excellent',
  latency: 0,

  createMeeting: async (data) => {
    set({ isLoading: true });
    try {
      const res = await apiFetch<ApiResponse<MeetingResponse>>('/api/meetings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const meeting = res.data!;
      set((state) => ({ meetings: [meeting, ...state.meetings] }));
      return meeting;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMeetings: async (status) => {
    set({ isLoading: true });
    try {
      const params = status ? `?status=${status}` : '';
      const res = await apiFetch<ApiResponse<MeetingResponse[]>>(
        `/api/meetings${params}`
      );
      set({ meetings: res.data || [] });
    } catch {
      set({ meetings: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMeeting: async (id) => {
    set({ isLoading: true });
    try {
      const res = await apiFetch<ApiResponse<MeetingResponse>>(
        `/api/meetings/${id}`
      );
      set({ currentMeeting: res.data! });
    } finally {
      set({ isLoading: false });
    }
  },

  updateMeeting: async (id, data) => {
    set({ isLoading: true });
    try {
      const res = await apiFetch<ApiResponse<MeetingResponse>>(
        `/api/meetings/${id}`,
        { method: 'PUT', body: JSON.stringify(data) }
      );
      const meeting = res.data!;
      set((state) => ({
        currentMeeting:
          state.currentMeeting?.id === id ? meeting : state.currentMeeting,
        meetings: state.meetings.map((m) => (m.id === id ? meeting : m)),
      }));
      return meeting;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteMeeting: async (id) => {
    set({ isLoading: true });
    try {
      await apiFetch(`/api/meetings/${id}`, { method: 'DELETE' });
      set((state) => ({
        meetings: state.meetings.filter((m) => m.id !== id),
        currentMeeting: state.currentMeeting?.id === id ? null : state.currentMeeting,
      }));
    } finally {
      set({ isLoading: false });
    }
  },

  startMeeting: async (id) => {
    await get().updateMeeting(id, { status: 'active' });
  },

  endMeeting: async (id) => {
    await get().updateMeeting(id, { status: 'ended' });
  },

  joinMeeting: async (meetingCode, displayName, email) => {
    const res = await apiFetch<ApiResponse<{ meetingId: string; participantId: string }>>(
      '/api/meetings/join',
      {
        method: 'POST',
        body: JSON.stringify({ meetingCode, displayName, email }),
      }
    );
    set({ currentParticipantId: res.data!.participantId });
    return res.data!;
  },

  validateAccess: async (meetingCode, email) => {
    const res = await apiFetch<ApiResponse<{ allowed: boolean; requiresAuth: boolean }>>(
      `/api/meetings/validate?code=${meetingCode}${email ? `&email=${email}` : ''}`
    );
    return res.data!;
  },

  regenerateLink: async (id) => {
    const res = await apiFetch<ApiResponse<{ joinLink: string; meetingCode: string }>>(
      `/api/meetings/${id}/regenerate-link`,
      { method: 'POST' }
    );
    return res.data!;
  },

  fetchParticipants: async (meetingId) => {
    const participantId = get().currentParticipantId;
    const res = await apiFetch<ApiResponse<MeetingParticipantResponse[]>>(
      `/api/meetings/${meetingId}/participants`,
      {
        headers: participantId ? { 'x-participant-id': participantId } : undefined,
      }
    );
    set({ participants: res.data || [] });
  },

  fetchInvites: async (meetingId) => {
    const res = await apiFetch<ApiResponse<MeetingInviteResponse[]>>(
      `/api/meetings/${meetingId}/invites`
    );
    set({ invites: res.data || [] });
  },

  addInvite: async (meetingId, email, guestName) => {
    const res = await apiFetch<ApiResponse<MeetingInviteResponse>>(
      `/api/meetings/${meetingId}/invites`,
      {
        method: 'POST',
        body: JSON.stringify({ email, guestName }),
      }
    );
    set((state) => ({ invites: [...state.invites, res.data!] }));
  },

  removeInvite: async (meetingId, inviteId) => {
    await apiFetch(`/api/meetings/${meetingId}/invites/${inviteId}`, {
      method: 'DELETE',
    });
    set((state) => ({
      invites: state.invites.filter((i) => i.id !== inviteId),
    }));
  },

  resendInvite: async (meetingId, inviteId) => {
    await apiFetch(`/api/meetings/${meetingId}/invites/${inviteId}/resend`, {
      method: 'POST',
    });
  },

  muteParticipant: async (meetingId, participantId) => {
    await apiFetch(`/api/meetings/${meetingId}/participants/${participantId}/mute`, {
      method: 'POST',
    });
  },

  removeParticipant: async (meetingId, participantId) => {
    await apiFetch(`/api/meetings/${meetingId}/participants/${participantId}`, {
      method: 'DELETE',
    });
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== participantId),
    }));
  },

  leaveMeeting: async (meetingId) => {
    await apiFetch(`/api/meetings/${meetingId}/leave`, { method: 'POST' });
  },

  setCurrentMeeting: (meeting) => set({ currentMeeting: meeting }),
  setCurrentParticipantId: (id) => set({ currentParticipantId: id }),
  setMeetingTimer: (seconds) => set({ meetingTimer: seconds }),
  setConnectionQuality: (quality) => set({ connectionQuality: quality }),
  setLatency: (ms) => set({ latency: ms }),
  resetMeetingState: () =>
    set({
      currentMeeting: null,
      currentParticipantId: null,
      participants: [],
      invites: [],
      meetingTimer: 0,
      connectionQuality: 'excellent',
      latency: 0,
    }),
}));
