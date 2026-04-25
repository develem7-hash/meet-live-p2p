import { nanoid } from 'nanoid';

export function generateMeetingCode(): string {
  return nanoid(12).toLowerCase();
}

export function generateJoinToken(): string {
  return nanoid(32);
}

export function generateJoinLink(meetingCode: string): string {
  // In production, this would use the actual domain
  return `${process.env.NEXT_PUBLIC_APP_URL || ''}/meeting/${meetingCode}`;
}

export function generateVerificationToken(): string {
  return nanoid(32);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function sanitizeInput(input: string): string {
  return input.replace(/[<>]/g, '').trim();
}

export function formatDateTime(date: Date, timezone: string = 'UTC'): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(date);
}

export function getAvailableTimezones(): Array<{ value: string; label: string }> {
  return [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  ];
}

export function rateLimitMap(): Map<string, { count: number; lastReset: number }> {
  return new Map();
}

export function checkRateLimit(
  map: Map<string, { count: number; lastReset: number }>,
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || now - entry.lastReset > windowMs) {
    map.set(key, { count: 1, lastReset: now });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}
