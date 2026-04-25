'use client';

import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Crown,
  Shield,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MeetingParticipantResponse } from '@/types';
import { cn } from '@/lib/utils';

interface ParticipantListProps {
  participants: MeetingParticipantResponse[];
  currentUserId?: string;
  isHost?: boolean;
  onMuteParticipant?: (participantId: string) => void;
  onRemoveParticipant?: (participantId: string) => void;
}

const roleBadge: Record<string, { label: string; className: string }> = {
  host: { label: 'Host', className: 'bg-amber-100 text-amber-700' },
  co_host: { label: 'Co-host', className: 'bg-purple-100 text-purple-700' },
  participant: { label: '', className: '' },
};

export function ParticipantList({
  participants,
  currentUserId,
  isHost,
  onMuteParticipant,
  onRemoveParticipant,
}: ParticipantListProps) {
  const activeParticipants = participants.filter(
    (p) => p.status === 'active'
  );
  const waitingParticipants = participants.filter(
    (p) => p.status === 'waiting'
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-slate-900">
          Participants ({activeParticipants.length})
        </h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Active participants */}
          {activeParticipants.map((participant) => (
            <ParticipantItem
              key={participant.id}
              participant={participant}
              isCurrentUser={participant.userId === currentUserId}
              isHost={isHost}
              onMute={onMuteParticipant}
              onRemove={onRemoveParticipant}
            />
          ))}

          {/* Waiting participants */}
          {waitingParticipants.length > 0 && (
            <>
              <div className="px-4 py-2 mt-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  In Waiting Room ({waitingParticipants.length})
                </p>
              </div>
              {waitingParticipants.map((participant) => (
                <ParticipantItem
                  key={participant.id}
                  participant={participant}
                  isCurrentUser={participant.userId === currentUserId}
                  isHost={isHost}
                  onMute={onMuteParticipant}
                  onRemove={onRemoveParticipant}
                />
              ))}
            </>
          )}

          {participants.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <p className="text-sm">No participants yet</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ParticipantItem({
  participant,
  isCurrentUser,
  isHost,
  onMute,
  onRemove,
}: {
  participant: MeetingParticipantResponse;
  isCurrentUser: boolean;
  isHost?: boolean;
  onMute?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  let mediaStatus: { audio: boolean; video: boolean } = { audio: true, video: false };
  try {
    mediaStatus =
      typeof participant.mediaStatus === 'string'
        ? JSON.parse(participant.mediaStatus)
        : participant.mediaStatus;
  } catch {
    // use default
  }

  const canModerate = isHost && !isCurrentUser && participant.role !== 'host';
  const role = roleBadge[participant.role];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
    >
      <Avatar className="w-8 h-8">
        <AvatarImage src={undefined} />
        <AvatarFallback
          className={cn(
            'text-xs font-medium',
            isCurrentUser ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          )}
        >
          {participant.displayName?.charAt(0)?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'text-sm truncate',
              isCurrentUser ? 'font-medium text-slate-900' : 'text-slate-700'
            )}
          >
            {participant.displayName}
            {isCurrentUser && (
              <span className="text-slate-400 font-normal"> (You)</span>
            )}
          </p>
          {role.label && <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4', role.className)}>{role.label}</Badge>}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {mediaStatus.audio ? (
          <Mic className="w-3.5 h-3.5 text-slate-400" />
        ) : (
          <MicOff className="w-3.5 h-3.5 text-red-400" />
        )}

        {canModerate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {onMute && (
                <DropdownMenuItem
                  onClick={() => onMute(participant.id)}
                >
                  <MicOff className="w-4 h-4 mr-2" />
                  Mute
                </DropdownMenuItem>
              )}
              {onRemove && (
                <DropdownMenuItem
                  onClick={() => onRemove(participant.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </motion.div>
  );
}
