'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Video, CalendarDays, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MeetingCard } from '@/components/meeting-card';
import { useMeetingStore } from '@/stores/meeting-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import type { MeetingStatus } from '@/types';

const tabs = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'ended', label: 'Ended' },
];

export function MyMeetingsPage() {
  const { meetings, isLoading, fetchMeetings } = useMeetingStore();
  const { user } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const filteredMeetings = meetings.filter((m) => {
    const matchesTab = activeTab === 'all' || m.status === activeTab;
    const matchesSearch =
      !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="flex items-center gap-4 px-4 lg:px-8 py-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Meetings</h1>
            <p className="text-sm text-slate-500 mt-0.5">{meetings.length} total meetings</p>
          </div>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => useUIStore.getState().navigate('create-meeting')}
          >
            <CalendarDays className="w-4 h-4 mr-2" /> New Meeting
          </Button>
        </div>
      </header>

      <div className="px-4 lg:px-8 py-6 max-w-6xl">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-10">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-sm px-4">
                  {tab.label}
                  <Badge variant="secondary" className="ml-1.5 bg-slate-100 text-slate-600 text-[10px] px-1.5 h-4">
                    {tab.value === 'all'
                      ? meetings.length
                      : meetings.filter((m) => m.status === tab.value).length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Meeting List */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : filteredMeetings.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Video className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              {searchQuery ? 'No matching meetings' : 'No meetings found'}
            </h3>
            <p className="text-sm text-slate-500">
              {searchQuery
                ? 'Try a different search term'
                : 'Create a new meeting to get started'}
            </p>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {filteredMeetings.map((meeting, i) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <MeetingCard meeting={meeting} isHost={user?.id === meeting.hostId} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
