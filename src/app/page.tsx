'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { useMeetingStore } from '@/stores/meeting-store';
import { AppSidebar } from '@/components/app-sidebar';
import { JoinMeetingDialog } from '@/components/join-meeting-dialog';
import { NotificationBell } from '@/components/notification-bell';
import { MeetingRoom } from '@/components/meeting-room';

import { LandingPage } from '@/components/pages/landing-page';
import { LoginPage } from '@/components/pages/login-page';
import { RegisterPage } from '@/components/pages/register-page';
import { ForgotPasswordPage } from '@/components/pages/forgot-password-page';
import { DashboardPage } from '@/components/pages/dashboard-page';
import { CreateMeetingPage } from '@/components/pages/create-meeting-page';
import { MeetingDetailsPage } from '@/components/pages/meeting-details-page';
import { MyMeetingsPage } from '@/components/pages/my-meetings-page';
import { CalendarPage } from '@/components/pages/calendar-page';
import { ProfilePage } from '@/components/pages/profile-page';

function PageRouter() {
  const { currentRoute, navigate } = useUIStore();
  const { isAuthenticated, isInitialized, fetchMe } = useAuthStore();

  // Fetch user on mount
  useEffect(() => {
    if (!isInitialized) {
      fetchMe();
    }
  }, [isInitialized, fetchMe]);

  // Redirect unauthenticated users trying to access protected routes
  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      const protectedRoutes = ['dashboard', 'create-meeting', 'my-meetings', 'calendar', 'profile', 'meeting-details', 'meeting-room'];
      if (protectedRoutes.includes(currentRoute)) {
        navigate('login');
      }
    }
  }, [isInitialized, isAuthenticated, currentRoute, navigate]);

  // Show loading while checking auth
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Loading MeetLive...</p>
        </div>
      </div>
    );
  }

  // Meeting room is full-screen, no sidebar
  if (currentRoute === 'meeting-room') {
    return <MeetingRoom />;
  }

  // Public routes (no sidebar)
  const publicRoutes = ['', 'login', 'register', 'forgot-password'];

  if (publicRoutes.includes(currentRoute)) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={currentRoute}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {currentRoute === '' && <LandingPage />}
          {currentRoute === 'login' && <LoginPage />}
          {currentRoute === 'register' && <RegisterPage />}
          {currentRoute === 'forgot-password' && <ForgotPasswordPage />}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Protected routes (with sidebar)
  return (
    <div className="min-h-screen bg-slate-50">
      <AppSidebar />
      {/* Main content area offset for sidebar */}
      <div className="lg:pl-64">
        {/* Top bar for mobile with notifications */}
        <div className="lg:hidden fixed top-0 right-0 z-20 p-2">
          <NotificationBell />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentRoute}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {currentRoute === 'dashboard' && <DashboardPage />}
            {currentRoute === 'create-meeting' && <CreateMeetingPage />}
            {currentRoute === 'meeting-details' && <MeetingDetailsPage />}
            {currentRoute === 'my-meetings' && <MyMeetingsPage />}
            {currentRoute === 'calendar' && <CalendarPage />}
            {currentRoute === 'profile' && <ProfilePage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <PageRouter />
      <JoinMeetingDialog />
    </>
  );
}
