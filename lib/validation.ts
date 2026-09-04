/**
 * Request validation shared by the todo routes.
 *
 * Returns plain result objects rather than throwing, so handlers can map
 * failures onto 400 responses without try/catch noise.
 */

import {
  PRIORITIES,
  RECURRENCE_PATTERNS,
  REMINDER_OPTIONS,
  type Priority,
  type RecurrencePattern,
} from './db';
import { getSingaporeNow, isFutureDueDate, isValidDateTime, toStorageDateTime } from './timezone';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const MAX_TITLE_LENGTH = 500;

export interface TodoPayload {
  title: string;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  completed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses a positive integer route param. */
export function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateTitle(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') return { ok: false, error: 'Title is required' };

  const title = raw.trim();
  if (title === '') return { ok: false, error: 'Title is required' };
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` };
  }

  return { ok: true, value: title };
}

function validatePriority(raw: unknown): ValidationResult<Priority> {
  if (raw === undefined || raw === null) return { ok: true, value: 'medium' };
  if (typeof raw === 'string' && PRIORITIES.includes(raw as Priority)) {
    return { ok: true, value: raw as Priority };
  }
  return { ok: false, error: `Priority must be one of: ${PRIORITIES.join(', ')}` };
}

function validateReminder(raw: unknown): ValidationResult<number | null> {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: null };

  const minutes = Number(raw);
  if (!REMINDER_OPTIONS.includes(minutes as (typeof REMINDER_OPTIONS)[number])) {
    return { ok: false, error: `Reminder must be one of: ${REMINDER_OPTIONS.join(', ')} minutes` };
  }

  return { ok: true, value: minutes };
}

/**
 * Validates a create/update payload.
 *
 * On update (`partial: true`) the existing todo supplies defaults, so callers
 * may send only the fields they are changing.
 *
 * Rules enforced here:
 * - title required, trimmed, non-empty
 * - due date must parse and, when newly set, be at least a minute ahead
 * - recurring todos require a due date and a valid pattern
 */
export function validateTodoPayload(
  body: unknown,
  options: { partial?: boolean; existing?: TodoPayload } = {},
): ValidationResult<TodoPayload> {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };

  const { partial = false, existing } = options;
  const has = (key: string) => body[key] !== undefined;

  // Title
  let title: string;
  if (has('title') || !partial) {
    const result = validateTitle(body.title);
    if (!result.ok) return result;
    title = result.value;
  } else {
    title = existing?.title ?? '';
  }

  // Priority
  let priority: Priority;
  if (has('priority')) {
    const result = validatePriority(body.priority);
    if (!result.ok) return result;
    priority = result.value;
  } else {
    priority = existing?.priority ?? 'medium';
  }

  // Due date
  let dueDate: string | null;
  if (has('due_date')) {
    const raw = body.due_date;

    if (raw === null || raw === '') {
      dueDate = null;
    } else if (typeof raw !== 'string' || !isValidDateTime(raw)) {
      return { ok: false, error: 'Due date is not a valid date/time' };
    } else {
      dueDate = toStorageDateTime(raw);

      // Only enforce the future constraint when the value actually changed, so
      // editing an unrelated field on an overdue todo does not fail.
      const changed = dueDate !== (existing?.due_date ?? null);
      if (changed && !isFutureDueDate(raw, getSingaporeNow())) {
        return { ok: false, error: 'Due date must be at least 1 minute in the future' };
      }
    }
  } else {
    dueDate = existing?.due_date ?? null;
  }

  // Recurrence
  const isRecurring = has('is_recurring')
    ? Boolean(body.is_recurring)
    : (existing?.is_recurring ?? false);

  let pattern: RecurrencePattern | null;
  if (has('recurrence_pattern')) {
    const raw = body.recurrence_pattern;
    if (raw === null || raw === '') {
      pattern = null;
    } else if (
      typeof raw === 'string' &&
      RECURRENCE_PATTERNS.includes(raw as RecurrencePattern)
    ) {
      pattern = raw as RecurrencePattern;
    } else {
      return {
        ok: false,
        error: `Recurrence pattern must be one of: ${RECURRENCE_PATTERNS.join(', ')}`,
      };
    }
  } else {
    pattern = existing?.recurrence_pattern ?? null;
  }

  if (isRecurring) {
    if (!pattern) return { ok: false, error: 'Recurring todos require a recurrence pattern' };
    if (!dueDate) return { ok: false, error: 'Recurring todos require a due date' };
  } else {
    pattern = null;
  }

  // Reminder
  let reminder: number | null;
  if (has('reminder_minutes')) {
    const result = validateReminder(body.reminder_minutes);
    if (!result.ok) return result;
    reminder = result.value;
  } else {
    reminder = existing?.reminder_minutes ?? null;
  }

  if (reminder !== null && !dueDate) {
    return { ok: false, error: 'Reminders require a due date' };
  }

  const completed = has('completed')
    ? Boolean(body.completed)
    : (existing?.completed ?? false);

  return {
    ok: true,
    value: {
      title,
      due_date: dueDate,
      priority,
      is_recurring: isRecurring,
      recurrence_pattern: pattern,
      reminder_minutes: reminder,
      completed,
    },
  };
}
