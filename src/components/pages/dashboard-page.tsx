'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  PlusCircle,
  Video,
  CalendarDays,
  Clock,
  Users,
  TrendingUp,
  ArrowRight,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MeetingCard } from '@/components/meeting-card';
import { useAuthStore } from '@/stores/auth-store';
import { useMeetingStore } from '@/stores/meeting-store';
import { useUIStore } from '@/stores/ui-store';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { meetings, isLoading, fetchMeetings } = useMeetingStore();
  const { navigate, setJoinMeetingDialogOpen, toggleSidebar } = useUIStore();

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const upcomingMeetings = meetings.filter(
    (m) => m.status === 'scheduled' && m.scheduledDate && !isPast(parseISO(m.scheduledDate))
  );
  const activeMeetings = meetings.filter((m) => m.status === 'active');
  const pastMeetings = meetings.filter(
    (m) => m.status === 'ended' || (m.scheduledDate && isPast(parseISO(m.scheduledDate)))
  );

  const todayMeetings = upcomingMeetings.filter(
    (m) => m.scheduledDate && isToday(parseISO(m.scheduledDate))
  );
  const tomorrowMeetings = upcomingMeetings.filter(
    (m) => m.scheduledDate && isTomorrow(parseISO(m.scheduledDate))
  );
  const laterMeetings = upcomingMeetings.filter(
    (m) => m.scheduledDate && !isToday(parseISO(m.scheduledDate)) && !isTomorrow(parseISO(m.scheduledDate))
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="flex items-center gap-4 px-4 lg:px-8 py-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setJoinMeetingDialogOpen(true)} className="hidden sm:flex">
              <Video className="w-4 h-4 mr-2" /> Join
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => navigate('create-meeting')}
            >
              <PlusCircle className="w-4 h-4 mr-2" /> New Meeting
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-8 py-6 max-w-6xl">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Upcoming', value: upcomingMeetings.length, icon: CalendarDays, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Active Now', value: activeMeetings.length, icon: Video, color: 'text-blue-600 bg-blue-50' },
            { label: 'Today', value: todayMeetings.length, icon: Clock, color: 'text-amber-600 bg-amber-50' },
            { label: 'Total Meetings', value: meetings.length, icon: TrendingUp, color: 'text-slate-600 bg-slate-100' },
          ].map((stat) => (
            <Card key={stat.label} className="border-slate-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions for Mobile */}
        <div className="flex gap-2 mb-6 sm:hidden">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => setJoinMeetingDialogOpen(true)}>
            <Video className="w-4 h-4 mr-2" /> Join
          </Button>
          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate('create-meeting')}>
            <PlusCircle className="w-4 h-4 mr-2" /> New
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 flex items-center justify-center">
              <CalendarDays className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No meetings yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm mx-auto">
              Create your first meeting and start connecting with crystal clear audio.
            </p>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate('create-meeting')}>
              <PlusCircle className="w-4 h-4 mr-2" /> Create Your First Meeting
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Active Meetings */}
            {activeMeetings.length > 0 && (
              <Section title="Active Now" count={activeMeetings.length}>
                <div className="grid sm:grid-cols-2 gap-4">
                  {activeMeetings.map((m) => (
                    <MeetingCard key={m.id} meeting={m} isHost={user?.id === m.hostId} />
                  ))}
                </div>
              </Section>
            )}

            {/* Today's Meetings */}
            {todayMeetings.length > 0 && (
              <Section title="Today" count={todayMeetings.length}>
                <div className="grid sm:grid-cols-2 gap-4">
                  {todayMeetings.map((m) => (
                    <MeetingCard key={m.id} meeting={m} isHost={user?.id === m.hostId} />
                  ))}
                </div>
              </Section>
            )}

            {/* Tomorrow */}
            {tomorrowMeetings.length > 0 && (
              <Section title="Tomorrow" count={tomorrowMeetings.length}>
                <div className="grid sm:grid-cols-2 gap-4">
                  {tomorrowMeetings.map((m) => (
                    <MeetingCard key={m.id} meeting={m} isHost={user?.id === m.hostId} />
                  ))}
                </div>
              </Section>
            )}

            {/* Later */}
            {laterMeetings.length > 0 && (
              <Section title="Coming Up" count={laterMeetings.length}>
                <div className="grid sm:grid-cols-2 gap-4">
                  {laterMeetings.map((m) => (
                    <MeetingCard key={m.id} meeting={m} isHost={user?.id === m.hostId} />
                  ))}
                </div>
              </Section>
            )}

            {/* Past */}
            {pastMeetings.length > 0 && (
              <Section title="Past Meetings" count={pastMeetings.length}>
                <div className="grid sm:grid-cols-2 gap-4">
                  {pastMeetings.slice(0, 4).map((m) => (
                    <MeetingCard key={m.id} meeting={m} isHost={user?.id === m.hostId} />
                  ))}
                </div>
                {pastMeetings.length > 4 && (
                  <div className="text-center mt-4">
                    <Button variant="ghost" className="text-slate-500" onClick={() => navigate('my-meetings')}>
                      View all past meetings <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="text-sm text-slate-400">({count})</span>
      </div>
      {children}
    </div>
  );
}

function isPast(date: Date): boolean {
  return date < new Date();
}
