'use client';

import type { Holiday, Todo } from '@/lib/db';

interface DayTodosModalProps {
  date: string;
  todos: Todo[];
  holiday: Holiday | null | undefined;
  onClose: () => void;
}

function priorityBadgeClass(priority: Todo['priority']) {
  switch (priority) {
    case 'high':
      return 'bg-red-500/15 text-red-700 ring-red-200 dark:bg-red-500/20 dark:text-red-200 dark:ring-red-500/40';
    case 'medium':
      return 'bg-amber-500/15 text-amber-700 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-500/40';
    case 'low':
      return 'bg-sky-500/15 text-sky-700 ring-sky-200 dark:bg-sky-500/20 dark:text-sky-200 dark:ring-sky-500/40';
    default:
      return 'bg-slate-500/15 text-slate-700 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-500/40';
  }
}

export function DayTodosModal({ date, todos, holiday, onClose }: DayTodosModalProps) {
  const formattedDate = new Intl.DateTimeFormat('en-SG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Singapore',
  }).format(new Date(`${date}T12:00:00+08:00`));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Selected day</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formattedDate}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        {holiday && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-700/40 dark:bg-rose-500/10 dark:text-rose-200">
            Holiday: {holiday.name}
          </div>
        )}

        {todos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
            No todos due on this date.
          </div>
        ) : (
          <ul className="space-y-3">
            {todos.map((todo) => (
              <li key={todo.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">{todo.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {todo.completed ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${priorityBadgeClass(todo.priority)}`}>
                    {todo.priority}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
