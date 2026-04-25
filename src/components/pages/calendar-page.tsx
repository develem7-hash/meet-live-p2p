'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Menu,
  Clock,
  Globe,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { useMeetingStore } from '@/stores/meeting-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

export function CalendarPage() {
  const { meetings, isLoading, fetchMeetings, setCurrentMeeting } = useMeetingStore();
  const { navigate } = useUIStore();
  const { toggleSidebar } = useUIStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays: Date[] = [];

  let day = calendarStart;
  while (day <= calendarEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const meetingsByDate = useMemo(() => {
    const map: Record<string, typeof meetings> = {};
    meetings.forEach((m) => {
      if (m.scheduledDate) {
        const dateKey = m.scheduledDate.split('T')[0];
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(m);
      }
    });
    return map;
  }, [meetings]);

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedMeetings = selectedDateKey ? meetingsByDate[selectedDateKey] || [] : [];

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleMeetingClick = (meetingId: string) => {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (meeting) {
      setCurrentMeeting(meeting);
      navigate('meeting-details');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="flex items-center gap-4 px-4 lg:px-8 py-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Calendar</h1>
            <p className="text-sm text-slate-500 mt-0.5">View and manage your scheduled meetings</p>
          </div>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => navigate('create-meeting')}
          >
            <Plus className="w-4 h-4 mr-2" /> New Meeting
          </Button>
        </div>
      </header>

      <div className="px-4 lg:px-8 py-6 max-w-6xl">
        {isLoading ? (
          <Skeleton className="h-[500px] rounded-xl" />
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            {/* Calendar Grid */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-slate-200 shadow-sm">
              {/* Month Nav */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-semibold text-slate-900">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-slate-100">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="py-3 text-center text-xs font-semibold text-slate-400 uppercase">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Cells */}
              <div className="grid grid-cols-7">
                {calendarDays.map((date, i) => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const dayMeetings = meetingsByDate[dateKey] || [];
                  const isCurrentMonth = isSameMonth(date, currentMonth);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);

                  return (
                    <button
                      key={i}
                      onClick={() => handleDayClick(date)}
                      className={cn(
                        'min-h-[80px] sm:min-h-[100px] p-2 border-b border-r border-slate-50 text-left transition-colors hover:bg-slate-50',
                        !isCurrentMonth && 'bg-slate-50/50',
                        isSelected && 'bg-emerald-50 ring-2 ring-emerald-500 ring-inset',
                        isToday(date) && !isSelected && 'bg-emerald-50/50'
                      )}
                    >
                      <span
                        className={cn(
                          'text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full',
                          isToday(date) && 'bg-emerald-500 text-white',
                          !isToday(date) && isCurrentMonth && 'text-slate-700',
                          !isToday(date) && !isCurrentMonth && 'text-slate-300'
                        )}
                      >
                        {format(date, 'd')}
                      </span>
                      {dayMeetings.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {dayMeetings.slice(0, 2).map((m) => (
                            <div
                              key={m.id}
                              className={cn(
                                'text-[10px] leading-tight px-1.5 py-0.5 rounded truncate',
                                m.type === 'private'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              )}
                              onClick={(e) => { e.stopPropagation(); handleMeetingClick(m.id); }}
                            >
                              {format(parseISO(m.startTime || m.scheduledDate!), 'h:mm')} {m.title}
                            </div>
                          ))}
                          {dayMeetings.length > 2 && (
                            <p className="text-[10px] text-slate-400 pl-1">+{dayMeetings.length - 2} more</p>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Selected Date Panel */}
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <Card className="border-slate-200">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900">
                      {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a date'}
                    </h3>
                    {selectedDate && isToday(selectedDate) && (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[11px]">Today</Badge>
                    )}
                  </div>

                  {selectedMeetings.length === 0 ? (
                    <div className="text-center py-6">
                      <CalendarDays className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">
                        {selectedDate ? 'No meetings scheduled' : 'Click a date to view meetings'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {selectedMeetings.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleMeetingClick(m.id)}
                          className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{m.title}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                <Clock className="w-3 h-3" />
                                {m.startTime && format(parseISO(m.startTime), 'h:mm a')}
                                {m.endTime && ` - ${format(parseISO(m.endTime), 'h:mm a')}`}
                              </div>
                            </div>
                            {m.type === 'private' ? (
                              <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            ) : (
                              <Globe className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-[10px] px-1.5 h-4 bg-slate-100">
                              {m.status}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="border-slate-200">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-slate-900 mb-3">This Month</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Scheduled</span>
                      <span className="font-medium text-slate-900">
                        {meetings.filter((m) => m.status === 'scheduled' && m.scheduledDate && isSameMonth(parseISO(m.scheduledDate), currentMonth)).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Completed</span>
                      <span className="font-medium text-slate-900">
                        {meetings.filter((m) => m.status === 'ended' && m.scheduledDate && isSameMonth(parseISO(m.scheduledDate), currentMonth)).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Total Hours</span>
                      <span className="font-medium text-slate-900">--</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
