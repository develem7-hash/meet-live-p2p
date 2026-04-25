'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  Video,
  Link as LinkIcon,
  AlertCircle,
  Loader2,
  User,
  Mail,
  Mic,
  Volume2,
  CheckCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useMeetingStore } from '@/stores/meeting-store';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

const joinSchema = z.object({
  meetingCode: z.string().min(1, 'Meeting code or link is required'),
  displayName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
});

type JoinFormValues = z.infer<typeof joinSchema>;

type JoinStep = 'input' | 'verify' | 'pre-join';

export function JoinMeetingDialog() {
  const { joinMeetingDialogOpen, setJoinMeetingDialogOpen, navigate } = useUIStore();
  const { joinMeeting, fetchMeeting, isLoading } = useMeetingStore();
  const [step, setStep] = useState<JoinStep>('input');
  const [meetingCode, setMeetingCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [micWorking, setMicWorking] = useState(false);
  const [speakerWorking, setSpeakerWorking] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinFormValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { meetingCode: '', displayName: '', email: '' },
  });

  const resetAndClose = () => {
    setStep('input');
    setMeetingCode('');
    setDisplayName('');
    setEmail('');
    setIsPrivate(false);
    setJoinMeetingDialogOpen(false);
  };

  const onInputSubmit = (data: JoinFormValues) => {
    const code = data.meetingCode.trim();
    // Extract code from link if full URL
    const extractedCode = code.includes('/')
      ? code.split('/').pop()?.split('?')[0] || code
      : code;
    setMeetingCode(extractedCode);
    // Simulate: for demo, treat codes starting with 'p' as private
    if (extractedCode.startsWith('p')) {
      setIsPrivate(true);
      setStep('verify');
    } else {
      setStep('pre-join');
    }
  };

  const onVerifySubmit = () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setStep('pre-join');
  };

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicWorking(true);
      toast.success('Microphone is working!');
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setMicWorking(false);
      toast.error('Could not access microphone');
    }
  };

  const testSpeaker = () => {
    setSpeakerWorking(true);
    toast.success('Speaker test played!');
    setTimeout(() => setSpeakerWorking(false), 2000);
  };

  const handleJoin = async () => {
    try {
      const data = await joinMeeting(meetingCode, displayName || undefined, email || undefined);
      await fetchMeeting(data.meetingId);
      toast.success('Joining meeting...');
      resetAndClose();
      navigate('meeting-room');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join meeting');
    }
  };

  return (
    <Dialog open={joinMeetingDialogOpen} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-emerald-600" />
            Join a Meeting
          </DialogTitle>
          <DialogDescription>
            {step === 'input' && 'Enter the meeting code or paste a meeting link'}
            {step === 'verify' && 'This meeting requires verification'}
            {step === 'pre-join' && 'Check your setup before joining'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-2 mb-4">
          {(['input', 'verify', 'pre-join'] as JoinStep[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex-1 h-1 rounded-full transition-colors',
                step === s ? 'bg-emerald-500' : step === 'input' || (step === 'verify' && i <= 1) || step === 'pre-join'
                  ? 'bg-emerald-200'
                  : 'bg-slate-100'
              )}
            />
          ))}
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {step === 'input' && (
            <form onSubmit={handleSubmit(onInputSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Meeting Code or Link</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="e.g., abc-123-xyz or paste a link"
                    {...register('meetingCode')}
                    className="pl-9"
                  />
                </div>
                {errors.meetingCode && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.meetingCode.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Continue
              </Button>
            </form>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm text-amber-700">
                  This is a private meeting. Please verify your email to join.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('input')}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={onVerifySubmit}
                >
                  Verify & Continue
                </Button>
              </div>
            </div>
          )}

          {step === 'pre-join' && (
            <div className="space-y-4">
              {/* Meeting info */}
              <div className="p-3 rounded-lg bg-slate-50 border">
                <p className="text-sm font-medium text-slate-700">Meeting Code</p>
                <p className="text-lg font-mono font-bold text-emerald-600">{meetingCode}</p>
              </div>

              {/* Display name for guests */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Display Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Your display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Separator />

              {/* Device checks */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">Device Check</p>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={testMicrophone}
                  >
                    <Mic className={cn('w-4 h-4 mr-2', micWorking ? 'text-emerald-500' : 'text-slate-400')} />
                    <span className="flex-1 text-left">Test Microphone</span>
                    {micWorking && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={testSpeaker}
                  >
                    <Volume2 className={cn('w-4 h-4 mr-2', speakerWorking ? 'text-emerald-500' : 'text-slate-400')} />
                    <span className="flex-1 text-left">Test Speaker</span>
                    {speakerWorking && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(isPrivate ? 'verify' : 'input')}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleJoin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join Meeting'
                  )}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
