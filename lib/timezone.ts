/**
 * Singapore timezone utilities.
 *
 * Every date/time operation in the app must go through this module. Singapore
 * (Asia/Singapore) has been a fixed UTC+08:00 offset with no daylight saving
 * since 1982, which lets us do wall-clock arithmetic with a constant offset
 * instead of pulling in a timezone database.
 *
 * Storage convention: due dates are persisted as ISO 8601 strings carrying the
 * explicit `+08:00` offset (for example `2026-03-15T09:30:00+08:00`). The fixed
 * offset means these strings also sort lexicographically in chronological order.
 */

import type { RecurrencePattern } from './db';

export const SINGAPORE_TIMEZONE = 'Asia/Singapore';
export const SINGAPORE_OFFSET = '+08:00';

const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Minimum lead time enforced on user-supplied due dates. */
export const MIN_DUE_DATE_LEAD_MINUTES = 1;

export interface SingaporeParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
}

/**
 * Current instant. Use this instead of `new Date()` so time can be reasoned
 * about (and stubbed) consistently across the app.
 */
export function getSingaporeNow(): Date {
  return new Date();
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** Splits an instant into its Singapore wall-clock components. */
export function getSingaporeParts(date: Date): SingaporeParts {
  const shifted = new Date(date.getTime() + SINGAPORE_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/** Rebuilds an instant from Singapore wall-clock components. */
export function fromSingaporeParts(parts: SingaporeParts): Date {
  const utcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return new Date(utcMs - SINGAPORE_OFFSET_MS);
}

/** Number of days in a Singapore calendar month (1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Formats an instant as a storage-ready ISO 8601 string in Singapore time,
 * e.g. `2026-03-15T09:30:00+08:00`.
 */
export function formatSingaporeDateTime(date: Date): string {
  const p = getSingaporeParts(date);
  return (
    `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}` +
    `T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${SINGAPORE_OFFSET}`
  );
}

/** Formats an instant as a Singapore calendar date, e.g. `2026-03-15`. */
export function formatSingaporeDate(date: Date): string {
  const p = getSingaporeParts(date);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Formats an instant for `<input type="datetime-local">`, e.g. `2026-03-15T09:30`. */
export function formatSingaporeInputValue(date: Date): string {
  const p = getSingaporeParts(date);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Human-readable Singapore timestamp, e.g. `15 Mar 2026, 09:30`. */
export function formatSingaporeDisplay(date: Date): string {
  return new Intl.DateTimeFormat('en-SG', {
    timeZone: SINGAPORE_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Parses a stored or user-supplied date string.
 *
 * Strings without an explicit offset (such as `datetime-local` input values)
 * are interpreted as Singapore wall-clock time rather than the server's local
 * timezone. Returns `null` when the value is absent or unparseable.
 */
export function parseSingaporeDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (trimmed === '') return null;

  if (OFFSET_SUFFIX.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(trimmed);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const parts: SingaporeParts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour ?? '0'),
    minute: Number(minute ?? '0'),
    second: Number(second ?? '0'),
  };

  if (parts.month < 1 || parts.month > 12) return null;
  if (parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) return null;
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) return null;

  return fromSingaporeParts(parts);
}

/**
 * Normalises any accepted date input into the canonical storage format.
 * Returns `null` when the value is empty or invalid.
 */
export function toStorageDateTime(value: string | null | undefined): string | null {
  const parsed = parseSingaporeDateTime(value);
  return parsed ? formatSingaporeDateTime(parsed) : null;
}

/** True when the supplied value is a parseable date string. */
export function isValidDateTime(value: string | null | undefined): boolean {
  return parseSingaporeDateTime(value) !== null;
}

/**
 * Due dates must sit at least one minute in the future at creation time.
 * A one-second grace window absorbs latency between form render and submit.
 */
export function isFutureDueDate(
  value: string | null | undefined,
  now: Date = getSingaporeNow(),
): boolean {
  const parsed = parseSingaporeDateTime(value);
  if (!parsed) return false;

  const threshold = now.getTime() + MIN_DUE_DATE_LEAD_MINUTES * MINUTE_MS - 1000;
  return parsed.getTime() >= threshold;
}

/** True when a todo's due date has passed. */
export function isOverdue(dueDate: string | null, now: Date = getSingaporeNow()): boolean {
  const parsed = parseSingaporeDateTime(dueDate);
  return parsed !== null && parsed.getTime() < now.getTime();
}

/** True when two instants fall on the same Singapore calendar day. */
export function isSameSingaporeDay(a: Date, b: Date): boolean {
  return formatSingaporeDate(a) === formatSingaporeDate(b);
}

/**
 * Advances a due date by one recurrence interval.
 *
 * Overflow is clamped to the last valid day of the target month, so 31 Jan
 * repeated monthly becomes 28/29 Feb, and 29 Feb repeated yearly becomes
 * 28 Feb in a non-leap year. The time of day is always preserved.
 */
export function calculateNextDueDate(currentDueDate: string, pattern: RecurrencePattern): string {
  const current = parseSingaporeDateTime(currentDueDate);
  if (!current) {
    throw new Error(`Cannot calculate next due date from invalid value: ${currentDueDate}`);
  }

  const parts = getSingaporeParts(current);

  switch (pattern) {
    case 'daily':
      return formatSingaporeDateTime(new Date(current.getTime() + 24 * 60 * MINUTE_MS));

    case 'weekly':
      return formatSingaporeDateTime(new Date(current.getTime() + 7 * 24 * 60 * MINUTE_MS));

    case 'monthly': {
      const targetMonth = parts.month === 12 ? 1 : parts.month + 1;
      const targetYear = parts.month === 12 ? parts.year + 1 : parts.year;
      const day = Math.min(parts.day, daysInMonth(targetYear, targetMonth));
      return formatSingaporeDateTime(
        fromSingaporeParts({ ...parts, year: targetYear, month: targetMonth, day }),
      );
    }

    case 'yearly': {
      const targetYear = parts.year + 1;
      const day = Math.min(parts.day, daysInMonth(targetYear, parts.month));
      return formatSingaporeDateTime(fromSingaporeParts({ ...parts, year: targetYear, day }));
    }

    default: {
      const exhaustive: never = pattern;
      throw new Error(`Unsupported recurrence pattern: ${String(exhaustive)}`);
    }
  }
}

/** Instant at which a todo's reminder should fire, or `null` when not applicable. */
export function calculateReminderTime(
  dueDate: string | null,
  reminderMinutes: number | null,
): Date | null {
  if (reminderMinutes === null || reminderMinutes === undefined) return null;

  const due = parseSingaporeDateTime(dueDate);
  if (!due) return null;

  return new Date(due.getTime() - reminderMinutes * MINUTE_MS);
}

/** Shifts an instant by a number of minutes. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

/**
 * Relative description of a due date, e.g. `Due in 3 hours` or `2 days overdue`.
 */
export function describeDueDate(dueDate: string | null, now: Date = getSingaporeNow()): string {
  const due = parseSingaporeDateTime(dueDate);
  if (!due) return 'No due date';

  const diffMinutes = Math.round((due.getTime() - now.getTime()) / MINUTE_MS);
  const overdue = diffMinutes < 0;
  const magnitude = Math.abs(diffMinutes);

  const unit = (value: number, name: string) => `${value} ${name}${value === 1 ? '' : 's'}`;

  let phrase: string;
  if (magnitude < 60) {
    phrase = unit(magnitude, 'minute');
  } else if (magnitude < 60 * 24) {
    phrase = unit(Math.floor(magnitude / 60), 'hour');
  } else {
    phrase = unit(Math.floor(magnitude / (60 * 24)), 'day');
  }

  return overdue ? `${phrase} overdue` : `Due in ${phrase}`;
}
