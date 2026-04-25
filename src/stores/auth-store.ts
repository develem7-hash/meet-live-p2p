'use client';

import { create } from 'zustand';
import type {
  ApiResponse,
  LoginRequest,
  RegisterRequest,
} from '@/types';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  timezone: string;
  isEmailVerified: boolean;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  updateProfile: (data: { name?: string; timezone?: string }) => Promise<void>;
  changePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
}

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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  login: async (data) => {
    set({ isLoading: true });
    try {
      const res = await apiFetch<ApiResponse<{ user: User }>>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      set({ user: res.data!.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const res = await apiFetch<ApiResponse<{ user: User }>>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      set({ user: res.data!.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors during logout
    } finally {
      set({ user: null, isAuthenticated: false });
    }
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const res = await apiFetch<ApiResponse<{ user: User }>>('/api/auth/me');
      set({ user: res.data!.user, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  updateProfile: async (data) => {
    const res = await apiFetch<ApiResponse<{ user: User }>>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    set({ user: res.data!.user });
  },

  changePassword: async (data) => {
    await apiFetch('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  forgotPassword: async (email) => {
    await apiFetch<ApiResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
}));
