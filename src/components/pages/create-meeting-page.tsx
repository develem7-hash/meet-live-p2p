'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateMeetingForm } from '@/components/create-meeting-form';
import { useUIStore } from '@/stores/ui-store';
import { useMeetingStore } from '@/stores/meeting-store';
import { useAuthStore } from '@/stores/auth-store';

export function CreateMeetingPage() {
  const { navigate } = useUIStore();
  const { setCurrentMeeting } = useMeetingStore();
  const { user } = useAuthStore();

  const handleSuccess = (meetingId: string) => {
    navigate('meeting-details');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="flex items-center gap-4 px-4 lg:px-8 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">Create New Meeting</h1>
            <p className="text-sm text-slate-500 mt-0.5">Set up your meeting details and invite participants</p>
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-8 py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <CreateMeetingForm onSuccess={handleSuccess} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
