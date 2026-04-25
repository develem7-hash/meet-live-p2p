'use client';

import { create } from 'zustand';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface UIState {
  currentRoute: string;
  previousRoute: string;
  sidebarOpen: boolean;
  notifications: Notification[];
  joinMeetingDialogOpen: boolean;

  navigate: (route: string) => void;
  goBack: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setJoinMeetingDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentRoute: '',
  previousRoute: '',
  sidebarOpen: false,
  notifications: [],
  joinMeetingDialogOpen: false,

  navigate: (route) =>
    set((state) => ({
      previousRoute: state.currentRoute,
      currentRoute: route,
      sidebarOpen: false,
    })),

  goBack: () =>
    set((state) => ({
      currentRoute: state.previousRoute,
      previousRoute: '',
    })),

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setNotifications: (notifications) => set({ notifications }),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    })),

  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    })),

  setJoinMeetingDialogOpen: (open) => set({ joinMeetingDialogOpen: open }),
}));
