'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorSpeaker,
  User,
  Wifi,
  WifiOff,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ConnectionQualityIndicator } from '@/components/connection-quality';
import { useMeetingStore } from '@/stores/meeting-store';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import type { ConnectionQuality } from '@/types';

export function PreJoinScreen() {
  const { currentMeeting, connectionQuality, setConnectionQuality, joinMeeting } =
    useMeetingStore();
  const { navigate } = useUIStore();

  const [displayName, setDisplayName] = useState('');
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  // Toggle mic
  const toggleMic = useCallback(async () => {
    if (micEnabled) {
      micStream?.getTracks().forEach((t) => t.stop());
      setMicStream(null);
      setMicEnabled(false);
      setMicLevel(0);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStream(stream);
        setMicEnabled(true);

        // Simulate audio level
        const interval = setInterval(() => {
          setMicLevel(Math.random() * 60 + 20);
        }, 200);
        return () => clearInterval(interval);
      } catch {
        setMicEnabled(false);
      }
    }
  }, [micEnabled, micStream]);

  const toggleCamera = useCallback(async () => {
    if (cameraEnabled) {
      setCameraEnabled(false);
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraEnabled(true);
      } catch {
        setCameraEnabled(false);
      }
    }
  }, [cameraEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      micStream?.getTracks().forEach((t) => t.stop());
    };
  }, [micStream]);

  const handleJoin = async () => {
    if (!currentMeeting) return;
    setIsConnecting(true);
    try {
      await joinMeeting(currentMeeting.meetingCode, displayName || undefined);
      navigate('meeting-room');
    } catch (err) {
      setIsConnecting(false);
    }
  };

  const handleCancel = () => {
    micStream?.getTracks().forEach((t) => t.stop());
    navigate('dashboard');
  };

  if (!currentMeeting) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <p>No meeting selected</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Preview area */}
          <div className="relative aspect-video bg-slate-900 flex items-center justify-center">
            {cameraEnabled ? (
              <div className="text-center">
                <Video className="w-16 h-16 text-emerald-400 mx-auto" />
                <p className="text-sm text-emerald-400 mt-2">Camera preview</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center mx-auto mb-3">
                  <User className="w-12 h-12 text-slate-400" />
                </div>
                <p className="text-sm text-slate-400">Camera is off</p>
              </div>
            )}

            {/* Mic level indicator */}
            {micEnabled && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-slate-900/80 backdrop-blur rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-400" />
                    <div className="flex-1">
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-emerald-500 rounded-full"
                          animate={{ width: `${micLevel}%` }}
                          transition={{ duration: 0.15 }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{Math.round(micLevel)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Meeting info */}
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">{currentMeeting.title}</h2>
            <p className="text-sm text-slate-400 mt-1">
              Hosted by {currentMeeting.hostName || 'Unknown'}
            </p>
          </div>

          {/* Controls */}
          <div className="px-6 py-5 space-y-4">
            {/* Display name */}
            <div className="space-y-2">
              <Label className="text-sm text-slate-300">Display Name</Label>
              <Input
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Device toggles */}
            <div className="flex items-center gap-3">
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  variant={micEnabled ? 'default' : 'outline'}
                  size="lg"
                  className={cn(
                    'w-12 h-12 rounded-full',
                    micEnabled
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-600'
                  )}
                  onClick={toggleMic}
                >
                  {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  variant={cameraEnabled ? 'default' : 'outline'}
                  size="lg"
                  className={cn(
                    'w-12 h-12 rounded-full',
                    cameraEnabled
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-600'
                  )}
                  onClick={toggleCamera}
                >
                  {cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
              </motion.div>

              <div className="flex-1" />
              <ConnectionQualityIndicator quality={connectionQuality} className="text-white" />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                onClick={handleJoin}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Join Now'
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
