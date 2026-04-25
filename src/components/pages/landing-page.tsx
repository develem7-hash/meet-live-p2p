'use client';

import { motion } from 'framer-motion';
import {
  Video,
  Mic,
  Shield,
  Globe,
  Zap,
  Calendar,
  ArrowRight,
  Users,
  Clock,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';

const features = [
  {
    icon: Mic,
    title: 'Crystal Clear Audio',
    description:
      'Ultra-low latency audio powered by Opus codec with forward error correction and adaptive bitrate. Your voice comes through naturally, even on weak networks.',
  },
  {
    icon: Shield,
    title: 'Private by Design',
    description:
      'End-to-end encryption for private meetings. Invite-only access with email verification ensures only authorized participants can join your conversations.',
  },
  {
    icon: Zap,
    title: 'Works on Slow Internet',
    description:
      'Adaptive quality scaling automatically adjusts audio bitrate based on connection quality. Stay connected even on 2G networks with audio-first optimization.',
  },
  {
    icon: Calendar,
    title: 'Calendar Integration',
    description:
      'Schedule meetings with Google Calendar sync. Invitees receive email notifications with meeting links and automatic reminders before start time.',
  },
  {
    icon: Globe,
    title: 'Public & Private Links',
    description:
      'Generate public links anyone can join, or create private invite-only meetings with strict email verification and waiting room controls.',
  },
  {
    icon: Users,
    title: 'Host Controls',
    description:
      'Mute participants, manage waiting rooms, lock meetings, remove disruptive users, and monitor join/leave activity with full audit logging.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Create a Meeting',
    description: 'Set title, date, time, and choose public or private access type with invite controls.',
    icon: Calendar,
  },
  {
    step: '02',
    title: 'Share the Link',
    description: 'Copy the generated meeting link and share it with participants via email or messaging.',
    icon: Globe,
  },
  {
    step: '03',
    title: 'Start Talking',
    description: 'Join with crystal clear audio quality, automatic device setup, and real-time communication.',
    icon: Mic,
  },
];

export function LandingPage() {
  const { navigate, setJoinMeetingDialogOpen } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-8">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 text-sm font-medium">Audio-optimized meetings</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-white tracking-tight leading-[1.1]">
                Crystal Clear Meetings,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                  Every Time
                </span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Low-latency audio communication that works even on slow internet. Schedule instantly, share links securely, and focus on what matters — your conversation.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              {isAuthenticated ? (
                <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 h-12 text-base font-semibold" onClick={() => navigate('dashboard')}>
                  Go to Dashboard <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 h-12 text-base font-semibold" onClick={() => navigate('register')}>
                  Get Started Free <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              )}
              <Button size="lg" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white px-8 h-12 text-base font-semibold" onClick={() => setJoinMeetingDialogOpen(true)}>
                <Video className="w-5 h-5 mr-2" /> Join a Meeting
              </Button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">&lt;50ms</p>
                <p className="text-sm text-slate-400 mt-1">Audio Latency</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">32kbps</p>
                <p className="text-sm text-slate-400 mt-1">Min Bandwidth</p>
              </div>
              <div className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-white">99.9%</p>
                <p className="text-sm text-slate-400 mt-1">Uptime</p>
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      {/* How it Works */}
      <section className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Simple. Fast. Reliable.</h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">Get your meeting running in three easy steps, no complex setup required.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((item, i) => (
              <motion.div key={item.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
                <Card className="border-slate-200 hover:shadow-lg transition-shadow h-full">
                  <CardContent className="p-8">
                    <span className="text-5xl font-bold text-emerald-100">{item.step}</span>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-emerald-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                    </div>
                    <p className="mt-3 text-slate-600 leading-relaxed">{item.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Built for Real-World Meetings</h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">Every feature designed with production-grade reliability, security, and audio clarity in mind.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="border-slate-200 hover:border-emerald-200 hover:shadow-md transition-all h-full">
                  <CardContent className="p-6">
                    <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center mb-4">
                      <feature.icon className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Ready for Better Meetings?</h2>
          <p className="mt-4 text-lg text-slate-300">Start hosting crystal clear meetings today. No credit card required.</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isAuthenticated && (
              <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 h-12 text-base font-semibold" onClick={() => navigate('register')}>
                Create Free Account <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            )}
            <Button size="lg" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white px-8 h-12 text-base" onClick={() => setJoinMeetingDialogOpen(true)}>
              Join a Meeting
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500"><Video className="w-4 h-4 text-white" /></div>
              <span className="text-lg font-bold text-white">MeetLive</span>
            </div>
            <p className="text-sm text-slate-500">Production-ready meeting platform. Built with React, Node.js, and mediasoup.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
