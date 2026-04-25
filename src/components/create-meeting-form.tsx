'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  Plus,
  X,
  Loader2,
  CalendarIcon,
  Globe,
  Lock,
  Mic,
  MicOff,
  VideoOff,
  Users,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useMeetingStore } from '@/stores/meeting-store';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const createMeetingSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(['public', 'private']),
  scheduledDate: z.date().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timezone: z.string().default('UTC'),
  waitingRoomEnabled: z.boolean().default(false),
  muteOnEntry: z.boolean().default(false),
  audioOnlyAllowed: z.boolean().default(false),
  syncToCalendar: z.boolean().default(false),
});

type CreateMeetingFormValues = z.infer<typeof createMeetingSchema>;

const commonTimezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Berlin', label: 'Central European (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

interface CreateMeetingFormProps {
  onSuccess?: (meetingId: string) => void;
}

export function CreateMeetingForm({ onSuccess }: CreateMeetingFormProps) {
  const { createMeeting, isLoading, setCurrentMeeting } = useMeetingStore();
  const { navigate } = useUIStore();
  const [inviteEmails, setInviteEmails] = useState<string[]>(new Array<string>());
  const [inviteInput, setInviteInput] = useState('');
  const [meetingType, setMeetingType] = useState<'public' | 'private'>('public');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateMeetingFormValues>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'public',
      timezone: 'UTC',
      waitingRoomEnabled: false,
      muteOnEntry: false,
      audioOnlyAllowed: false,
      syncToCalendar: false,
    },
  });

  const scheduledDate = watch('scheduledDate');
  const waitingRoomEnabled = watch('waitingRoomEnabled');
  const muteOnEntry = watch('muteOnEntry');
  const audioOnlyAllowed = watch('audioOnlyAllowed');
  const syncToCalendar = watch('syncToCalendar');

  const addInviteEmail = () => {
    const email = inviteInput.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (inviteEmails.includes(email)) {
      toast.error('Email already added');
      return;
    }
    setInviteEmails([...inviteEmails, email]);
    setInviteInput('');
  };

  const removeInviteEmail = (email: string) => {
    setInviteEmails(inviteEmails.filter((e) => e !== email));
  };

  const onSubmit = async (data: CreateMeetingFormValues) => {
    try {
      const meeting = await createMeeting({
        title: data.title,
        description: data.description,
        type: meetingType,
        scheduledDate: data.scheduledDate?.toISOString(),
        startTime: data.startTime ? `${data.scheduledDate ? data.scheduledDate.toISOString().split('T')[0] : ''}T${data.startTime}` : undefined,
        endTime: data.endTime ? `${data.scheduledDate ? data.scheduledDate.toISOString().split('T')[0] : ''}T${data.endTime}` : undefined,
        timezone: data.timezone,
        waitingRoomEnabled: data.waitingRoomEnabled,
        muteOnEntry: data.muteOnEntry,
        audioOnlyAllowed: data.audioOnlyAllowed,
        syncToCalendar: data.syncToCalendar,
        inviteEmails: inviteEmails.length > 0 ? inviteEmails : undefined,
      });
      toast.success('Meeting created successfully!');
      onSuccess?.(meeting.id);
      useMeetingStore.getState().setCurrentMeeting(meeting);
      navigate('meeting-details');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create meeting');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Title & Description */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-medium">
            Meeting Title *
          </Label>
          <Input
            id="title"
            placeholder="e.g., Weekly Team Standup"
            {...register('title')}
            className="h-10"
          />
          {errors.title && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errors.title.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Add a description for your meeting..."
            {...register('description')}
            className="min-h-[80px] resize-none"
          />
        </div>
      </div>

      <Separator />

      {/* Meeting Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Meeting Type</Label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setMeetingType('public')}
            className={cn(
              'flex items-center gap-2 flex-1 p-3 rounded-lg border-2 transition-all',
              meetingType === 'public'
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <Globe className={cn('w-5 h-5', meetingType === 'public' ? 'text-emerald-600' : 'text-slate-400')} />
            <div className="text-left">
              <p className={cn('text-sm font-medium', meetingType === 'public' ? 'text-emerald-700' : 'text-slate-700')}>Public</p>
              <p className="text-xs text-slate-400">Anyone with the link can join</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMeetingType('private')}
            className={cn(
              'flex items-center gap-2 flex-1 p-3 rounded-lg border-2 transition-all',
              meetingType === 'private'
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <Lock className={cn('w-5 h-5', meetingType === 'private' ? 'text-emerald-600' : 'text-slate-400')} />
            <div className="text-left">
              <p className={cn('text-sm font-medium', meetingType === 'private' ? 'text-emerald-700' : 'text-slate-700')}>Private</p>
              <p className="text-xs text-slate-400">Only invited users can join</p>
            </div>
          </button>
        </div>
      </div>

      <Separator />

      {/* Date & Time */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Schedule</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal h-10',
                    !scheduledDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, 'MMM d, yyyy') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={(date) => setValue('scheduledDate', date)}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Timezone</Label>
            <Select
              defaultValue="UTC"
              onValueChange={(value) => setValue('timezone', value)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {commonTimezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Time */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">Start Time</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="time"
                {...register('startTime')}
                className="pl-9 h-10"
              />
            </div>
          </div>

          {/* End Time */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">End Time</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="time"
                {...register('endTime')}
                className="pl-9 h-10"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Settings */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Settings</Label>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">Waiting Room</p>
                <p className="text-xs text-slate-400">Participants wait for approval</p>
              </div>
            </div>
            <Switch
              checked={waitingRoomEnabled}
              onCheckedChange={(checked) => setValue('waitingRoomEnabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              <MicOff className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">Mute on Entry</p>
                <p className="text-xs text-slate-400">Participants join muted</p>
              </div>
            </div>
            <Switch
              checked={muteOnEntry}
              onCheckedChange={(checked) => setValue('muteOnEntry', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              <VideoOff className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">Audio Only</p>
                <p className="text-xs text-slate-400">Disable video for all</p>
              </div>
            </div>
            <Switch
              checked={audioOnlyAllowed}
              onCheckedChange={(checked) => setValue('audioOnlyAllowed', checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Invite Emails */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Invite Participants</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Enter email address"
            type="email"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInviteEmail())}
            className="h-9"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInviteEmail}
            className="flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {inviteEmails.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {inviteEmails.map((email) => (
              <Badge key={email} variant="secondary" className="gap-1.5 py-1 px-2.5">
                {email}
                <button
                  type="button"
                  onClick={() => removeInviteEmail(email)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Sync to Calendar */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-700">Sync to Calendar</p>
            <p className="text-xs text-slate-400">Add to Google Calendar</p>
          </div>
        </div>
        <Switch
          checked={syncToCalendar}
          onCheckedChange={(checked) => setValue('syncToCalendar', checked)}
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating Meeting...
          </>
        ) : (
          'Create Meeting'
        )}
      </Button>
    </form>
  );
}
