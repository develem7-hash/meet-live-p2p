'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Video, Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const { forgotPassword, isLoading } = useAuthStore();
  const { navigate } = useUIStore();
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotFormValues) => {
    try {
      await forgotPassword(data.email);
      setSentEmail(data.email);
      setEmailSent(true);
      toast.success('Password reset email sent!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500 mb-4">
            <Video className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="text-slate-500 mt-1">We&apos;ll send you a reset link to your email</p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6">
            {emailSent ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Check your email</h3>
                <p className="text-sm text-slate-500 mb-1">
                  We sent a password reset link to:
                </p>
                <p className="text-sm font-medium text-slate-700 mb-6">{sentEmail}</p>
                <p className="text-xs text-slate-400 mb-6">
                  Didn&apos;t receive the email? Check your spam folder or try again.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => navigate('login')}>
                    Back to Login
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setEmailSent(false)}
                  >
                    Try Again
                  </Button>
                </div>
              </motion.div>
            ) : (
              <>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email" className="text-sm font-medium">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input id="reset-email" type="email" placeholder="your@email.com" {...register('email')} className="pl-9 h-11" />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                  <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium" disabled={isLoading}>
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>
                </form>
                <div className="mt-6 text-center">
                  <button className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700" onClick={() => navigate('login')}>
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
