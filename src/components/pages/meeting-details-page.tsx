'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Copy,
  Calendar,
  Clock,
  Globe,
  Lock,
  Users,
  Settings,
  Play,
  Trash2,
  RefreshCw,
  Mail,
  Share2,
  Loader2,
  MapPin,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { InviteManagement } from '@/components/invite-management';
import { toast } from 'sonner';
import { useMeetingStore } from '@/stores/meeting-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { format, parseISO } from 'date-fns';
import type { MeetingResponse } from '@/types';

export function MeetingDetailsPage() {
  const {
    currentMeeting,
    isLoading,
    fetchMeeting,
    deleteMeeting,
    startMeeting,
    regenerateLink,
  } = useMeetingStore();
  const { user } = useAuthStore();
  const { navigate } = useUIStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Get meeting from UI store fallback
  const meeting = currentMeeting;

  const isHost = user?.id === meeting?.hostId;

  const handleCopyLink = async () => {
    if (meeting?.joinLink) {
      try {
        await navigator.clipboard.writeText(meeting.joinLink);
        setCopied(true);
        toast.success('Meeting link copied!');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Failed to copy link');
      }
    }
  };

  const handleStartMeeting = async () => {
    if (meeting) {
      try {
        await startMeeting(meeting.id);
        const data = await useMeetingStore.getState().joinMeeting(meeting.meetingCode);
        await fetchMeeting(data.meetingId);
        toast.success('Meeting started!');
        navigate('meeting-room');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start meeting');
      }
    }
  };

  const handleDelete = async () => {
    if (meeting) {
      setIsDeleting(true);
      try {
        await deleteMeeting(meeting.id);
        toast.success('Meeting deleted');
        setShowDeleteDialog(false);
        navigate('dashboard');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete meeting');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleRegenerate = async () => {
    if (meeting) {
      setIsRegenerating(true);
      try {
        const result = await regenerateLink(meeting.id);
        toast.success('Link regenerated!');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to regenerate link');
      } finally {
        setIsRegenerating(false);
      }
    }
  };

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-slate-500 mb-4">No meeting selected</p>
          <Button variant="outline" onClick={() => navigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="flex items-center gap-4 px-4 lg:px-8 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{meeting.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge
                variant="secondary"
                className={
                  meeting.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 text-[11px]'
                    : meeting.status === 'scheduled'
                    ? 'bg-blue-100 text-blue-700 text-[11px]'
                    : 'bg-slate-100 text-slate-600 text-[11px]'
                }
              >
                {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
              </Badge>
              <Badge
                variant="secondary"
                className={
                  meeting.type === 'private'
                    ? 'bg-amber-100 text-amber-700 text-[11px]'
                    : 'bg-emerald-100 text-emerald-700 text-[11px]'
                }
              >
                {meeting.type === 'private' ? <Lock className="w-3 h-3 mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                {meeting.type.charAt(0).toUpperCase() + meeting.type.slice(1)}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {meeting.status === 'scheduled' && isHost && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleStartMeeting}>
                <Play className="w-4 h-4 mr-1.5" /> Start
              </Button>
            )}
            {meeting.status === 'active' && (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate('meeting-room')}>
                <Play className="w-4 h-4 mr-1.5" /> Join
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-8 py-6 max-w-4xl">
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          {/* Main Content */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Meeting Info */}
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Meeting Details</h2>
                {meeting.description && (
                  <p className="text-sm text-slate-600 mb-4">{meeting.description}</p>
                )}
                <div className="space-y-3">
                  {meeting.hostName && (
                    <div className="flex items-center gap-3 text-sm">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 w-24">Host</span>
                      <span className="font-medium text-slate-700">{meeting.hostName}</span>
                    </div>
                  )}
                  {meeting.scheduledDate && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 w-24">Date</span>
                      <span className="font-medium text-slate-700">{format(parseISO(meeting.scheduledDate), 'MMMM d, yyyy')}</span>
                    </div>
                  )}
                  {meeting.startTime && (
                    <div className="flex items-center gap-3 text-sm">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-500 w-24">Time</span>
                      <span className="font-medium text-slate-700">
                        {format(parseISO(meeting.startTime), 'h:mm a')}
                        {meeting.endTime ? ` - ${format(parseISO(meeting.endTime), 'h:mm a')}` : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500 w-24">Timezone</span>
                    <span className="font-medium text-slate-700">{meeting.timezone}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500 w-24">Max People</span>
                    <span className="font-medium text-slate-700">{meeting.maxParticipants}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Settings */}
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Settings</h2>
                <div className="grid grid-cols-2 gap-3">
                  <SettingBadge label="Waiting Room" enabled={meeting.waitingRoomEnabled} />
                  <SettingBadge label="Mute on Entry" enabled={meeting.muteOnEntry} />
                  <SettingBadge label="Audio Only" enabled={meeting.audioOnlyAllowed} />
                  <SettingBadge label="Locked" enabled={meeting.isLocked} />
                </div>
              </CardContent>
            </Card>

            {/* Invites (for private meetings) */}
            {meeting.type === 'private' && isHost && meeting.id && (
              <InviteManagement meetingId={meeting.id} />
            )}
          </motion.div>

          {/* Sidebar */}
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            {/* Meeting Link */}
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Meeting Link</h3>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-3">
                  <p className="text-xs text-slate-500 break-all font-mono">{meeting.joinLink}</p>
                </div>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleCopyLink}>
                    <Copy className={`w-4 h-4 mr-2 ${copied ? 'text-emerald-500' : ''}`} />
                    {copied ? 'Copied!' : 'Copy Link'}
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Mail className="w-4 h-4 mr-2" /> Send by Email
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                  {isHost && (
                    <Button variant="outline" size="sm" className="w-full justify-start text-amber-600 hover:text-amber-700" onClick={handleRegenerate} disabled={isRegenerating}>
                      <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
                      Regenerate Link
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            {isHost && (
              <Card className="border-red-200">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-red-700 mb-2">Danger Zone</h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Once deleted, the meeting cannot be recovered.
                  </p>
                  <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowDeleteDialog(true)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Meeting
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Meeting</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{meeting.title}&rdquo;? This action cannot be undone. All participants will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-100">
      <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`ml-auto text-xs ${enabled ? 'text-emerald-600' : 'text-slate-400'}`}>
        {enabled ? 'On' : 'Off'}
      </span>
    </div>
  );
}
