'use client';

import type { Holiday, Todo } from '@/lib/db';
import { formatMonthQuery, generateCalendarGrid } from '@/lib/calendar';
import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_VISIBLE_TODOS = 3;

interface CalendarGridProps {
  year: number;
  month: number;
  todos: Todo[];
  holidays: Holiday[];
  onSelectDay: (date: string) => void;
  onNavigate: (year: number, month: number) => void;
}

function priorityBadgeClass(priority: Todo['priority']): string {
  switch (priority) {
    case 'high':
      return 'bg-red-500/15 text-red-700 ring-1 ring-red-200 dark:bg-red-500/20 dark:text-red-200 dark:ring-red-500/40';
    case 'medium':
      return 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-500/40';
    case 'low':
      return 'bg-sky-500/15 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-500/40';
    default:
      return 'bg-slate-500/15 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-500/40';
  }
}

function cellClasses(day: ReturnType<typeof generateCalendarGrid>[number]): string {
  const baseClass =
    'group min-h-[116px] rounded-lg border p-1 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400';

  if (!day.isCurrentMonth) {
    return `${baseClass} border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-500`;
  }

  const weekendClass = day.isWeekend
    ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';

  const todayClass = day.isToday
    ? 'border-sky-500 bg-sky-50 shadow-inner dark:border-sky-400 dark:bg-sky-500/10'
    : weekendClass;

  const pastClass = day.isPast && !day.isToday ? 'opacity-70' : '';

  return `${baseClass} ${todayClass} ${pastClass}`;
}

export function CalendarGrid({ year, month, todos, holidays, onSelectDay, onNavigate }: CalendarGridProps) {
  const days = generateCalendarGrid(year, month);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate(year, month - 1)}
            className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onNavigate(year, month + 1)}
            className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {new Intl.DateTimeFormat('en-SG', { month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' }).format(
            new Date(Date.UTC(year, month - 1, 1)),
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            // Must be Singapore "today", not the host clock, or this jumps to
            // the wrong month for users west of UTC+08:00.
            const today = formatSingaporeDate(getSingaporeNow());
            onNavigate(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
          }}
          className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-600 dark:bg-sky-500/10 dark:text-sky-200 dark:hover:bg-sky-500/20"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {DAY_HEADERS.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const holiday = holidays.find((item) => item.date === day.date);
          const dayTodos = todos.filter((todo) => todo.due_date?.startsWith(day.date));
          const visibleTodos = dayTodos.slice(0, MAX_VISIBLE_TODOS);
          const overflow = dayTodos.length - visibleTodos.length;

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDay(day.date)}
              className={cellClasses(day)}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${day.isToday ? 'bg-sky-500 text-white' : 'text-inherit'}`}>
                  {day.date.slice(-2).replace(/^0/, '')}
                </span>
                {holiday && (
                  <span className="rounded bg-rose-100 px-1 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
                    {holiday.name}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {visibleTodos.map((todo) => (
                  <span
                    key={todo.id}
                    className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${priorityBadgeClass(todo.priority)}`}
                    title={todo.title}
                  >
                    {todo.title}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    +{overflow} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-red-500/20 ring-1 ring-red-400" /> High
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-amber-500/20 ring-1 ring-amber-400" /> Medium
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-sky-500/20 ring-1 ring-sky-400" /> Low
        </span>
      </div>

      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {formatMonthQuery(year, month)}
      </div>
    </div>
  );
}
