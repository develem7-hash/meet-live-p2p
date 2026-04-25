'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Plus,
  X,
  Send,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { MeetingInviteResponse, InviteStatus } from '@/types';
import type { Dispatch, SetStateAction } from 'react';

interface InviteManagementProps {
  invites: MeetingInviteResponse[];
  onAddInvite: (email: string, guestName?: string) => Promise<void>;
  onRemoveInvite: (inviteId: string) => Promise<void>;
  onResendInvite: (inviteId: string) => Promise<void>;
}

const statusConfig: Record<
  InviteStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="w-3 h-3" />,
    className: 'bg-amber-100 text-amber-700',
  },
  accepted: {
    label: 'Accepted',
    icon: <CheckCircle className="w-3 h-3" />,
    className: 'bg-emerald-100 text-emerald-700',
  },
  rejected: {
    label: 'Rejected',
    icon: <XCircle className="w-3 h-3" />,
    className: 'bg-red-100 text-red-700',
  },
  revoked: {
    label: 'Revoked',
    icon: <XCircle className="w-3 h-3" />,
    className: 'bg-slate-100 text-slate-500',
  },
};

export function InviteManagement({
  invites,
  onAddInvite,
  onRemoveInvite,
  onResendInvite,
}: InviteManagementProps) {
  const [email, setEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleAdd = async () => {
    if (!isValidEmail(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setIsAdding(true);
    try {
      await onAddInvite(email.trim(), guestName.trim() || undefined);
      setEmail('');
      setGuestName('');
      setShowForm(false);
      toast.success('Invite sent!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (inviteId: string) => {
    try {
      await onRemoveInvite(inviteId);
      toast.success('Invite revoked');
    } catch {
      toast.error('Failed to revoke invite');
    }
  };

  const handleResend = async (inviteId: string) => {
    try {
      await onResendInvite(inviteId);
      toast.success('Invite resent!');
    } catch {
      toast.error('Failed to resend invite');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Invites ({invites.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage who has been invited
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Invite
        </Button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
              <div className="space-y-2">
                <Input
                  placeholder="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9"
                />
                <Input
                  placeholder="Guest name (optional)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleAdd}
                  disabled={isAdding}
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {isAdding ? 'Sending...' : 'Send Invite'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite list */}
      <ScrollArea className="max-h-64">
        {invites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400">
            <Mail className="w-8 h-8 mb-2" />
            <p className="text-sm">No invites sent yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {invites.map((invite) => {
                const status = statusConfig[invite.status];
                return (
                  <motion.div
                    key={invite.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {invite.email}
                      </p>
                      {invite.guestName && (
                        <p className="text-xs text-slate-400">{invite.guestName}</p>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={status.className}
                    >
                      {status.icon}
                      <span className="ml-1">{status.label}</span>
                    </Badge>
                    {(invite.status === 'pending' || invite.status === 'rejected') && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {invite.status === 'pending' && (
                            <DropdownMenuItem onClick={() => handleResend(invite.id)}>
                              <Send className="w-4 h-4 mr-2" />
                              Resend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleRemove(invite.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
