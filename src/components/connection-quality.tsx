'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnectionQuality } from '@/types';

interface ConnectionQualityProps {
  quality: ConnectionQuality;
  latency?: number;
  className?: string;
}

const qualityConfig: Record<
  ConnectionQuality,
  { bars: number; color: string; label: string }
> = {
  excellent: { bars: 4, color: 'bg-emerald-500', label: 'Excellent' },
  good: { bars: 3, color: 'bg-emerald-400', label: 'Good' },
  fair: { bars: 2, color: 'bg-amber-500', label: 'Fair' },
  poor: { bars: 1, color: 'bg-red-500', label: 'Poor' },
  disconnected: { bars: 0, color: 'bg-slate-400', label: 'Disconnected' },
};

export function ConnectionQualityIndicator({
  quality,
  latency,
  className,
}: ConnectionQualityProps) {
  const config = qualityConfig[quality];

  if (quality === 'disconnected') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <WifiOff className="w-4 h-4 text-red-500" />
        <span className="text-xs text-red-500 font-medium">Disconnected</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Wifi className={cn('w-4 h-4', quality === 'poor' ? 'text-red-500' : quality === 'fair' ? 'text-amber-500' : 'text-emerald-500')} />
      <div className="flex items-end gap-0.5">
        {[1, 2, 3, 4].map((bar) => (
          <div
            key={bar}
            className={cn(
              'w-1 rounded-full transition-all duration-300',
              bar <= config.bars ? config.color : 'bg-slate-200',
              bar === 1 ? 'h-2' : bar === 2 ? 'h-3' : bar === 3 ? 'h-4' : 'h-5'
            )}
          />
        ))}
      </div>
      <span className="text-xs text-slate-500 hidden sm:inline">{config.label}</span>
      {latency !== undefined && (
        <span className="text-xs text-slate-400 hidden sm:inline">
          {latency}ms
        </span>
      )}
    </div>
  );
}
