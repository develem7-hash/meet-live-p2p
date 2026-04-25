'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  User,
  Mail,
  Globe,
  CalendarDays,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle,
  Shield,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuthStore, type User } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  timezone: z.string(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Enter your current password'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

export function ProfilePage() {
  const { user, updateProfile, changePassword, isLoading } = useAuthStore();
  const { navigate } = useUIStore();
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', timezone: user?.timezone || 'UTC' },
  });

  const {
    register: regPass,
    handleSubmit: handlePassSubmit,
    reset: resetPass,
    formState: { errors: passErrors, isSubmitting: isPassSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onProfileSave = async (data: ProfileValues) => {
    try {
      await updateProfile(data);
      toast.success('Profile updated!');
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const onPasswordChange = async (data: PasswordValues) => {
    try {
      await changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed!');
      resetPass();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="flex items-center gap-4 px-4 lg:px-8 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Profile & Settings</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage your account and preferences</p>
          </div>
        </div>
      </header>

      <div className="px-4 lg:px-8 py-6 max-w-3xl">
        <div className="space-y-6">
          {/* Profile Card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xl font-bold">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">{user?.name}</h2>
                    <p className="text-sm text-slate-500">{user?.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {user?.isEmailVerified ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[11px]">
                          <CheckCircle className="w-3 h-3 mr-1" /> Verified
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 text-[11px]">
                          <AlertCircle className="w-3 h-3 mr-1" /> Unverified
                        </Badge>
                      )}
                      <span className="text-xs text-slate-400">
                        Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                  {!isEditing && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      Edit Profile
                    </Button>
                  )}
                </div>

                {isEditing ? (
                  <form onSubmit={handleSubmit(onProfileSave)} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Full Name</Label>
                        <Input defaultValue={user?.name || ''} {...register('name')} className="h-10" />
                        {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Timezone</Label>
                        <Select defaultValue={user?.timezone || 'UTC'} onValueChange={(v) => setValue('timezone', v)}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {timezones.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs text-slate-400 mb-0.5">Name</p>
                      <p className="font-medium text-slate-700">{user?.name}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs text-slate-400 mb-0.5">Email</p>
                      <p className="font-medium text-slate-700">{user?.email}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs text-slate-400 mb-0.5">Timezone</p>
                      <p className="font-medium text-slate-700">{user?.timezone || 'UTC'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-xs text-slate-400 mb-0.5">Account ID</p>
                      <p className="font-mono text-xs text-slate-500">{user?.id?.slice(0, 12)}...</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Change Password */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Change Password</h2>
                    <p className="text-xs text-slate-500">Update your account password</p>
                  </div>
                </div>
                <form onSubmit={handlePassSubmit(onPasswordChange)} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Current Password</Label>
                    <Input type="password" {...regPass('currentPassword')} className="h-10" />
                    {passErrors.currentPassword && <p className="text-xs text-red-500">{passErrors.currentPassword.message}</p>}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">New Password</Label>
                      <Input type="password" {...regPass('newPassword')} className="h-10" />
                      {passErrors.newPassword && <p className="text-xs text-red-500">{passErrors.newPassword.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Confirm New Password</Label>
                      <Input type="password" {...regPass('confirmPassword')} className="h-10" />
                      {passErrors.confirmPassword && <p className="text-xs text-red-500">{passErrors.confirmPassword.message}</p>}
                    </div>
                  </div>
                  <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isPassSubmitting}>
                    {isPassSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Change Password
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Calendar Integration */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Calendar Integration</h2>
                    <p className="text-xs text-slate-500">Connect your calendar for seamless scheduling</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-lg">
                        G
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">Google Calendar</p>
                        <p className="text-xs text-slate-400">Sync meetings to your Google Calendar</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-slate-100 opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-lg">
                        O
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">Outlook Calendar</p>
                        <p className="text-xs text-slate-400">Coming soon</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-500">Soon</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Palette className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Notification Preferences</h2>
                    <p className="text-xs text-slate-500">Choose what notifications you receive</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Meeting Invites', desc: 'When someone invites you to a meeting' },
                    { label: 'Meeting Reminders', desc: 'Reminders before scheduled meetings' },
                    { label: 'Meeting Updates', desc: 'When a meeting is updated or cancelled' },
                    { label: 'Email Notifications', desc: 'Receive email notifications for events' },
                  ].map((pref) => (
                    <div key={pref.label} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{pref.label}</p>
                        <p className="text-xs text-slate-400">{pref.desc}</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
