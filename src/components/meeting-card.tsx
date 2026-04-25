'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Copy,
  ExternalLink,
  Users,
  Calendar,
  Clock,
  Lock,
  Globe,
  Play,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { MeetingResponse } from '@/types';
import { useUIStore } from '@/stores/ui-store';
import { format, isPast, isToday, parseISO } from 'date-fns';

interface MeetingCardProps {
  meeting: MeetingResponse;
  isHost?: boolean;
}

export function MeetingCard({ meeting, isHost }: MeetingCardProps) {
  const [copied, setCopied] = useState(false);
  const { navigate } = useUIStore();

  const statusColor = {
    scheduled: 'bg-blue-100 text-blue-700',
    active: 'bg-emerald-100 text-emerald-700',
    ended: 'bg-slate-100 text-slate-600',
    cancelled: 'bg-red-100 text-red-700',
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(meeting.joinLink);
      setCopied(true);
      toast.success('Meeting link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleViewDetails = () => {
    navigate('meeting-details');
    useUIStore.setState({ currentMeeting: meeting });
  };

  const handleStartMeeting = () => {
    useUIStore.setState({ currentMeeting: meeting });
    navigate('meeting-room');
  };

  const isScheduledPast =
    meeting.scheduledDate && isPast(parseISO(meeting.scheduledDate)) && meeting.status !== 'active';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0" onClick={handleViewDetails}>
              <h3 className="font-semibold text-slate-900 truncate text-base">
                {meeting.title}
              </h3>
              {meeting.description && (
                <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">
                  {meeting.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge
                variant="secondary"
                className={statusColor[meeting.status]}
              >
                {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 mb-4">
            <div className="flex items-center gap-1.5">
              {meeting.type === 'private' ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              <span className="capitalize">{meeting.type}</span>
            </div>
            {meeting.scheduledDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {isToday(parseISO(meeting.scheduledDate))
                    ? 'Today'
                    : format(parseISO(meeting.scheduledDate), 'MMM d, yyyy')}
                </span>
              </div>
            )}
            {meeting.startTime && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {format(parseISO(meeting.startTime), 'h:mm a')}
                  {meeting.endTime
                    ? ` – ${format(parseISO(meeting.endTime), 'h:mm a')}`
                    : ''}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{meeting._count?.participants || 0} joined</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-slate-600 flex-1"
              onClick={handleViewDetails}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Details
            </Button>
            {meeting.status === 'active' && (
              <Button
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleStartMeeting}
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Join
              </Button>
            )}
            {meeting.status === 'scheduled' && isHost && (
              <Button
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleStartMeeting}
              >
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Start
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-slate-600"
              onClick={handleCopyLink}
            >
              <Copy className={`w-3.5 h-3.5 ${copied ? 'text-emerald-500' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
