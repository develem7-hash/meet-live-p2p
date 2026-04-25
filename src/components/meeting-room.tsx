'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  Copy,
  Users,
  Lock,
  Unlock,
  MessageSquare,
  Settings,
  MoreVertical,
  Shield,
  Hand,
  Leave,
  Clock,
  ChevronLeft,
  MonitorSpeaker,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useMeetingStore } from '@/stores/meeting-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { ParticipantList } from '@/components/participant-list';
import { ConnectionQualityIndicator } from '@/components/connection-quality';
import { VideoPlayer } from '@/components/video-player';
import { WebRTCClient } from '@/lib/webrtc';
import { cn } from '@/lib/utils';

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function MeetingRoom() {
  const {
    currentMeeting,
    participants,
    connectionQuality,
    latency,
    meetingTimer,
    setMeetingTimer,
    setConnectionQuality,
    setLatency,
    fetchParticipants,
    muteParticipant,
    removeParticipant,
    leaveMeeting,
    endMeeting,
  } = useMeetingStore();
  const { user } = useAuthStore();
  const { navigate } = useUIStore();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  
  const [webrtc, setWebrtc] = useState<WebRTCClient | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map());
  
  const [chatMessages, setChatMessages] = useState<{ id: string, senderName: string, text: string, timestamp: string }[]>([]);
  const [chatInput, setChatInput] = useState('');

  const isHost = user?.id === currentMeeting?.hostId;

  // Fetch and poll participants
  useEffect(() => {
    if (currentMeeting) {
      fetchParticipants(currentMeeting.id);
      const interval = setInterval(() => {
        fetchParticipants(currentMeeting.id);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [currentMeeting, fetchParticipants]);

  // Initialize WebRTC
  useEffect(() => {
    const participantId = useMeetingStore.getState().currentParticipantId;
    if (currentMeeting && participantId && !webrtc) {
      const client = new WebRTCClient(currentMeeting.id, participantId);
      
      client.onRemoteStreamAdd = (pid, stream, type) => {
        if (type === 'screen') setRemoteScreenStreams(new Map(client.remoteScreenStreams));
        else setRemoteStreams(new Map(client.remoteStreams));
      };
      
      client.onRemoteStreamRemove = (pid, type) => {
        if (type === 'screen') setRemoteScreenStreams(new Map(client.remoteScreenStreams));
        else setRemoteStreams(new Map(client.remoteStreams));
      };

      client.onLocalScreenShareChange = (stream) => {
        setLocalScreenStream(stream);
        setIsScreenSharing(!!stream);
      };
      
      client.onChatMessage = (message) => {
        setChatMessages(prev => [...prev, message]);
        if (!isChatOpen) {
          toast.info(`New message from ${message.senderName}`);
        }
      };

      const init = async () => {
        // Try to capture camera/mic immediately so the user sees themselves
        try {
          await client.startLocalMedia();
          setLocalStream(client.localStream);
        } catch (err) {
          toast.error('Failed to access camera and microphone');
        }

        // Connect to PeerJS cloud
        try {
          await client.connect();
          setWebrtc(client);
        } catch (err) {
          toast.error('Failed to connect to media network');
          console.error(err);
        }
      };

      init();

      return () => {
        client.disconnect();
      };
    }
  }, [currentMeeting, webrtc]);

  // Mesh Network: Call new participants as they appear
  useEffect(() => {
    const myId = useMeetingStore.getState().currentParticipantId;
    if (webrtc && participants.length > 0 && myId) {
      participants.forEach(p => {
        if (p.id !== myId && !remoteStreams.has(p.id)) {
          // We found someone we aren't connected to yet!
          webrtc.callPeer(p.id);
        }
      });
    }
  }, [participants, webrtc, remoteStreams]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setMeetingTimer(meetingTimer + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingTimer, setMeetingTimer]);

  // Simulate connection quality changes
  useEffect(() => {
    const interval = setInterval(() => {
      const qualities: Array<'excellent' | 'good' | 'fair'> = ['excellent', 'good', 'fair'];
      setConnectionQuality(qualities[Math.floor(Math.random() * qualities.length)]);
      setLatency(Math.floor(Math.random() * 80) + 10);
    }, 5000);
    return () => clearInterval(interval);
  }, [setConnectionQuality, setLatency]);

  const handleCopyLink = async () => {
    if (currentMeeting?.joinLink) {
      try {
        await navigator.clipboard.writeText(currentMeeting.joinLink);
        toast.success('Meeting link copied!');
      } catch {
        toast.error('Failed to copy link');
      }
    }
  };

  const handleLeave = async () => {
    if (currentMeeting) {
      await leaveMeeting(currentMeeting.id);
      webrtc?.disconnect();
      toast.success('You left the meeting');
    }
    navigate('dashboard');
  };

  const handleEndMeeting = async () => {
    if (currentMeeting && isHost) {
      await endMeeting(currentMeeting.id);
      webrtc?.disconnect();
      toast.success('Meeting ended');
    }
    navigate('dashboard');
  };

  const toggleMute = () => {
    if (webrtc) {
      const muted = webrtc.toggleMute();
      setIsMuted(muted);
    }
  };

  const toggleVideo = () => {
    if (webrtc) {
      const videoOff = webrtc.toggleVideo();
      setIsVideoOff(videoOff);
    }
  };

  const toggleScreenShare = async () => {
    if (webrtc) {
      if (isScreenSharing) {
        webrtc.stopScreenShare();
      } else {
        await webrtc.startScreenShare();
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !webrtc) return;

    const text = chatInput.trim();
    setChatInput('');
    const myName = user?.name || 'Guest';

    // Optimistic UI update
    setChatMessages(prev => [...prev, {
      id: Math.random().toString(),
      senderName: 'You',
      text,
      timestamp: new Date().toISOString()
    }]);

    try {
      await webrtc.sendMessage(text, myName);
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  if (!currentMeeting) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <p className="text-lg">No active meeting</p>
          <Button
            variant="outline"
            className="mt-4 text-white border-slate-600"
            onClick={() => navigate('dashboard')}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <MonitorSpeaker className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold truncate max-w-[200px] sm:max-w-[400px]">
              {currentMeeting.title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              <span>{formatTimer(meetingTimer)}</span>
              <span className="text-slate-600">|</span>
              <ConnectionQualityIndicator
                quality={connectionQuality}
                latency={latency}
                className="text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-300 hover:text-white hover:bg-slate-700 h-8"
                  onClick={handleCopyLink}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy meeting link</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'hover:bg-slate-700 h-8',
                    isParticipantsOpen ? 'text-emerald-400 bg-slate-700' : 'text-slate-300 hover:text-white'
                  )}
                  onClick={() => {
                    setIsParticipantsOpen(!isParticipantsOpen);
                    setIsChatOpen(false);
                  }}
                >
                  <Users className="w-4 h-4" />
                  <Badge variant="secondary" className="ml-1.5 bg-slate-600 text-slate-200 text-[10px] px-1.5 h-4">
                    {participants.length}
                  </Badge>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Participants</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'hover:bg-slate-700 h-8',
                    isChatOpen ? 'text-emerald-400 bg-slate-700' : 'text-slate-300 hover:text-white'
                  )}
                  onClick={() => {
                    setIsChatOpen(!isChatOpen);
                    setIsParticipantsOpen(false);
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Chat</TooltipContent>
            </Tooltip>

            {isHost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-300 hover:text-white hover:bg-slate-700 h-8"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      toast.success(currentMeeting.isLocked ? 'Meeting unlocked' : 'Meeting locked')
                    }
                  >
                    {currentMeeting.isLocked ? (
                      <Unlock className="w-4 h-4 mr-2" />
                    ) : (
                      <Lock className="w-4 h-4 mr-2" />
                    )}
                    {currentMeeting.isLocked ? 'Unlock Meeting' : 'Lock Meeting'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info('Mute all not yet implemented')}>
                    <MicOff className="w-4 h-4 mr-2" />
                    Mute All Participants
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TooltipProvider>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center - Meeting area */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            {/* Stage View (Large Screen Share) */}
            {(localScreenStream || Array.from(remoteScreenStreams.values()).length > 0) ? (
              <div className="flex-1 flex flex-col min-h-0 gap-4">
                <div className="flex-1 bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl relative group">
                  {localScreenStream ? (
                    <>
                      <VideoPlayer stream={localScreenStream} isLocal className="w-full h-full object-contain" />
                      <div className="absolute top-4 right-4 bg-emerald-500/90 text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 backdrop-blur-sm shadow-lg">
                        <MonitorUp className="w-3.5 h-3.5" />
                        You are sharing your screen
                      </div>
                    </>
                  ) : (
                    Array.from(remoteScreenStreams.entries()).map(([pid, stream]) => {
                      const p = participants.find(part => part.id === pid);
                      return (
                        <div key={pid} className="w-full h-full relative">
                          <VideoPlayer stream={stream} className="w-full h-full object-contain" />
                          <div className="absolute top-4 right-4 bg-slate-900/80 text-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 backdrop-blur-sm shadow-lg border border-slate-700">
                            <MonitorUp className="w-3.5 h-3.5 text-emerald-400" />
                            {p?.displayName || 'Someone'}&apos;s Screen
                          </div>
                        </div>
                      );
                    }).slice(0, 1) // Only show one screen share on stage
                  )}
                </div>

                {/* Participant Ribbon (When Screen is Shared) */}
                <div className="h-32 flex-shrink-0">
                  <div className="h-full flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-2 items-center">
                    {/* Local Camera */}
                    {localStream && (
                      <div className="relative flex-shrink-0">
                        <div className="w-40 h-28 bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700 ring-2 ring-emerald-500/20 group hover:border-emerald-500 transition-all duration-300">
                          {!isVideoOff ? (
                            <VideoPlayer stream={localStream} isLocal className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800">
                              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold">
                                {user?.name?.charAt(0) || 'Y'}
                              </div>
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1">
                            You {isMuted && <MicOff className="w-2.5 h-2.5 text-red-400" />}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Remote Participants */}
                    {participants.filter(p => p.id !== useMeetingStore.getState().currentParticipantId).map((p) => (
                      <div key={p.id} className="relative flex-shrink-0">
                        <div className="w-40 h-28 bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-slate-500 transition-all duration-300 shadow-md">
                          {remoteStreams.get(p.id) ? (
                            <VideoPlayer stream={remoteStreams.get(p.id) || null} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800">
                              <Avatar className="w-10 h-10 ring-2 ring-slate-700">
                                <AvatarFallback className="bg-slate-700 text-slate-300">
                                  {p.displayName?.charAt(0)?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1">
                            {p.displayName}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Grid View (No Screen Share) */
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr gap-4 max-w-7xl">
                  {/* Local Stream */}
                  {localStream && (
                    <div className="relative group">
                      <div className="w-full h-full bg-slate-800 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl ring-2 ring-emerald-500/20 group-hover:border-emerald-500 transition-all duration-300 min-h-[200px]">
                        {!isVideoOff ? (
                          <VideoPlayer stream={localStream} isLocal className="w-full h-full object-cover scale-x-[-1]" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800">
                            <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-2xl font-bold text-slate-300 ring-4 ring-slate-600/50">
                              {user?.name?.charAt(0) || 'Y'}
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-xs text-white flex items-center gap-2 border border-white/10">
                          <span className="font-medium">You</span>
                          {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Remote Streams */}
                  {participants.filter(p => p.id !== useMeetingStore.getState().currentParticipantId).map((p) => (
                    <div key={p.id} className="relative group">
                      <div className="w-full h-full bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-lg hover:border-slate-500 transition-all duration-300 min-h-[200px]">
                        {remoteStreams.get(p.id) ? (
                          <VideoPlayer stream={remoteStreams.get(p.id) || null} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800">
                            <Avatar className="w-16 h-16 ring-4 ring-slate-700/50">
                              <AvatarFallback className="bg-slate-700 text-slate-300 text-xl font-bold uppercase">
                                {p.displayName?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        )}
                        <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-xs text-white flex items-center gap-2 border border-white/10">
                          <span className="font-medium">{p.displayName}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Empty state if only one person */}
                  {participants.length <= 1 && !localStream && (
                    <div className="col-span-full flex flex-col items-center justify-center text-center p-12">
                      <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-2xl border border-slate-700">
                        <MonitorSpeaker className="w-10 h-10 text-emerald-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2">{currentMeeting.title}</h3>
                      <p className="text-slate-400 max-w-sm">
                        Waiting for others to join... You can share the meeting link to invite participants.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom toolbar */}
          <div className="flex-shrink-0 bg-slate-800 border-t border-slate-700 px-6 py-4">
            <div className="flex items-center justify-center gap-3">
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  variant={isMuted ? 'destructive' : 'secondary'}
                  className={cn(
                    'w-14 h-14 rounded-full',
                    !isMuted && 'bg-slate-700 hover:bg-slate-600 text-white'
                  )}
                  onClick={toggleMute}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </Button>
              </motion.div>

              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  variant={isVideoOff ? 'destructive' : 'secondary'}
                  className={cn(
                    'w-14 h-14 rounded-full',
                    !isVideoOff && 'bg-slate-700 hover:bg-slate-600 text-white'
                  )}
                  onClick={toggleVideo}
                >
                  {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </Button>
              </motion.div>

              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  variant={isScreenSharing ? 'default' : 'secondary'}
                  className={cn(
                    'w-14 h-14 rounded-full',
                    !isScreenSharing && 'bg-slate-700 hover:bg-slate-600 text-white',
                    isScreenSharing && 'bg-emerald-600 hover:bg-emerald-700'
                  )}
                  onClick={toggleScreenShare}
                >
                  {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <MonitorUp className="w-6 h-6" />}
                </Button>
              </motion.div>

              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  size="lg"
                  variant={isHandRaised ? 'default' : 'secondary'}
                  className={cn(
                    'w-14 h-14 rounded-full',
                    !isHandRaised && 'bg-slate-700 hover:bg-slate-600 text-white',
                    isHandRaised && 'bg-amber-500 hover:bg-amber-600'
                  )}
                  onClick={() => setIsHandRaised(!isHandRaised)}
                >
                  <Hand className="w-6 h-6" />
                </Button>
              </motion.div>

              <div className="w-px h-8 bg-slate-600 mx-2" />

              {!isHost ? (
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button
                    size="lg"
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleLeave}
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </motion.div>
              ) : (
                <>
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="w-14 h-14 rounded-full bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleEndMeeting}
                    >
                      <PhoneOff className="w-6 h-6 rotate-[135deg]" />
                    </Button>
                  </motion.div>
                  <span className="text-[10px] text-slate-400">End for all</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Side panel */}
        {(isParticipantsOpen || isChatOpen) && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex-shrink-0 bg-slate-800 border-l border-slate-700 overflow-hidden"
          >
            {isParticipantsOpen && (
              <ParticipantList
                participants={participants}
                currentUserId={user?.id}
                isHost={isHost}
                onMuteParticipant={muteParticipant}
                onRemoveParticipant={removeParticipant}
              />
            )}
            {isChatOpen && (
              <div className="flex flex-col h-full bg-slate-800">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Chat</h3>
                  <Badge variant="secondary">{chatMessages.length}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                      No messages yet
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => (
                      <div key={idx} className={cn("flex flex-col max-w-[90%]", msg.senderName === 'You' ? 'ml-auto items-end' : 'mr-auto items-start')}>
                        <span className="text-[10px] text-slate-400 mb-1">{msg.senderName}</span>
                        <div className={cn("px-3 py-2 rounded-lg text-sm", msg.senderName === 'You' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200')}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-4 border-t border-slate-700">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="bg-slate-900 border-slate-700"
                    />
                    <Button type="submit" size="icon" disabled={!chatInput.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
