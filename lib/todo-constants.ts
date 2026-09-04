export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080; // 15m,30m,1h,2h,1d,2d,1w

export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'] as const;
export const RECURRENCE_PATTERNS: readonly RecurrencePattern[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;
export const REMINDER_OPTIONS: readonly ReminderMinutes[] = [15, 30, 60, 120, 1440, 2880, 10080] as const;

export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
