/**
 * Todo ordering and sectioning.
 *
 * Pure functions with no I/O, shared by the API, the main page, the calendar,
 * and the tests — a single definition keeps orderings from drifting apart.
 */

import { PRIORITY_ORDER, type Todo } from './db';
import { getSingaporeNow, parseSingaporeDateTime } from './timezone';

export interface TodoSections {
  overdue: Todo[];
  pending: Todo[];
  completed: Todo[];
}

/** Sortable timestamp; todos without a due date sort last. */
function dueTime(todo: Todo): number {
  const parsed = parseSingaporeDateTime(todo.due_date);
  return parsed ? parsed.getTime() : Number.POSITIVE_INFINITY;
}

function createdTime(todo: Todo): number {
  const parsed = parseSingaporeDateTime(todo.created_at);
  return parsed ? parsed.getTime() : 0;
}

/**
 * Ordering: priority (high → low), then due date (earliest → latest),
 * then creation time (newest first) as a tiebreak.
 */
export function compareTodos(a: Todo, b: Todo): number {
  const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (byPriority !== 0) return byPriority;

  const aDue = dueTime(a);
  const bDue = dueTime(b);
  if (aDue !== bDue) return aDue - bDue;

  return createdTime(b) - createdTime(a);
}

/** Returns a new sorted array; the input is left untouched. */
export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort(compareTodos);
}

/**
 * Splits todos into Overdue / Pending / Completed.
 *
 * Completed is checked first, so a completed todo with a past due date is
 * never reported as overdue. Completed todos are ordered by most recently
 * touched rather than by priority.
 */
export function sectionTodos(todos: Todo[], now: Date = getSingaporeNow()): TodoSections {
  const nowMs = now.getTime();

  const overdue: Todo[] = [];
  const pending: Todo[] = [];
  const completed: Todo[] = [];

  for (const todo of todos) {
    if (todo.completed) {
      completed.push(todo);
      continue;
    }

    const due = parseSingaporeDateTime(todo.due_date);
    if (due && due.getTime() < nowMs) {
      overdue.push(todo);
    } else {
      pending.push(todo);
    }
  }

  return {
    overdue: overdue.sort(compareTodos),
    pending: pending.sort(compareTodos),
    completed: completed.sort(
      (a, b) =>
        Date.parse(b.updated_at ?? b.created_at) - Date.parse(a.updated_at ?? a.created_at),
    ),
  };
}
