'use client';

/**
 * Main todo page.
 *
 * Intentionally monolithic per project convention: this single client
 * component owns todo state, the create/edit forms, and all three sections.
 * Later features (subtasks, tags, templates, filtering) extend this file
 * rather than splitting it apart.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PRIORITIES, type Priority } from '@/lib/todo-constants';
import type { Todo } from '@/lib/db';
import { sectionTodos } from '@/lib/sort';
import {
  describeDueDate,
  formatSingaporeDisplay,
  formatSingaporeInputValue,
  getSingaporeNow,
  parseSingaporeDateTime,
} from '@/lib/timezone';

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/**
 * Badge colours. Light and dark variants are both tuned for WCAG AA contrast
 * against their respective surfaces.
 */
const PRIORITY_BADGE: Record<Priority, string> = {
  high: 'bg-red-100 text-red-800 ring-red-600/30 dark:bg-red-950 dark:text-red-200',
  medium: 'bg-amber-100 text-amber-900 ring-amber-600/30 dark:bg-amber-950 dark:text-amber-100',
  low: 'bg-blue-100 text-blue-800 ring-blue-600/30 dark:bg-blue-950 dark:text-blue-200',
};

interface TodoFormState {
  title: string;
  priority: Priority;
  dueDate: string;
}

const EMPTY_FORM: TodoFormState = { title: '', priority: 'medium', dueDate: '' };

/** Earliest value the date picker should allow: one minute from now. */
function minDueDateValue(): string {
  return formatSingaporeInputValue(new Date(getSingaporeNow().getTime() + 60_000));
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      data-testid={`priority-badge-${priority}`}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${PRIORITY_BADGE[priority]}`}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

function DueDate({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;

  const parsed = parseSingaporeDateTime(dueDate);
  if (!parsed) return null;

  return (
    <span className="text-xs text-slate-600 dark:text-slate-400" title={dueDate}>
      {formatSingaporeDisplay(parsed)} · {describeDueDate(dueDate)}
    </span>
  );
}

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [form, setForm] = useState<TodoFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TodoFormState>(EMPTY_FORM);
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadTodos = useCallback(async () => {
    try {
      const response = await fetch('/api/todos');
      if (!response.ok) throw new Error('Failed to load todos');

      const data: { todos: Todo[] } = await response.json();
      setTodos(data.todos);
      setError(null);
    } catch {
      setError('Could not load todos. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch from an external system; setState only happens after the
    // request settles, so this does not cause a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTodos();
  }, [loadTodos]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();

    const title = form.title.trim();
    if (title === '') {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          priority: form.priority,
          due_date: form.dueDate === '' ? null : form.dueDate,
        }),
      });

      const data: { todo?: Todo; error?: string } = await response.json();

      if (!response.ok || !data.todo) {
        setError(data.error ?? 'Could not create todo');
        return;
      }

      setTodos((current) => [...current, data.todo as Todo]);
      setForm(EMPTY_FORM);
      setError(null);
    } catch {
      setError('Could not create todo');
    } finally {
      setSubmitting(false);
    }
  }

  /** Optimistic toggle; the previous state is restored if the request fails. */
  async function handleToggle(todo: Todo) {
    const previous = todos;
    setTodos((current) =>
      current.map((item) =>
        item.id === todo.id ? { ...item, completed: !item.completed } : item,
      ),
    );

    try {
      // Completing goes through /complete, which is the only path that spawns
      // the next occurrence of a recurring todo. PUT only flips the flag.
      const response = todo.completed
        ? await fetch(`/api/todos/${todo.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: false }),
          })
        : await fetch(`/api/todos/${todo.id}/complete`, { method: 'POST' });

      if (!response.ok) throw new Error('Update failed');

      // Recurring completion spawns a new instance server-side, so resync.
      if (todo.is_recurring) await loadTodos();
    } catch {
      setTodos(previous);
      setError('Could not update todo');
    }
  }

  /** Optimistic delete; no confirmation dialog by design. */
  async function handleDelete(todoId: number) {
    const previous = todos;
    setTodos((current) => current.filter((item) => item.id !== todoId));

    try {
      const response = await fetch(`/api/todos/${todoId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
    } catch {
      setTodos(previous);
      setError('Could not delete todo');
    }
  }

  function startEditing(todo: Todo) {
    const parsed = parseSingaporeDateTime(todo.due_date);
    setEditingId(todo.id);
    setEditForm({
      title: todo.title,
      priority: todo.priority,
      dueDate: parsed ? formatSingaporeInputValue(parsed) : '',
    });
  }

  async function handleUpdate(event: React.FormEvent, todoId: number) {
    event.preventDefault();

    const title = editForm.title.trim();
    if (title === '') {
      setError('Title is required');
      return;
    }

    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          priority: editForm.priority,
          due_date: editForm.dueDate === '' ? null : editForm.dueDate,
        }),
      });

      const data: { todo?: Todo; error?: string } = await response.json();

      if (!response.ok || !data.todo) {
        setError(data.error ?? 'Could not update todo');
        return;
      }

      const updated = data.todo;
      setTodos((current) => current.map((item) => (item.id === todoId ? updated : item)));
      setEditingId(null);
      setError(null);
    } catch {
      setError('Could not update todo');
    }
  }

  const visibleTodos = useMemo(
    () =>
      priorityFilter === 'all'
        ? todos
        : todos.filter((todo) => todo.priority === priorityFilter),
    [todos, priorityFilter],
  );

  const sections = useMemo(() => sectionTodos(visibleTodos), [visibleTodos]);

  function renderTodo(todo: Todo) {
    if (editingId === todo.id) {
      return (
        <li key={todo.id} className="rounded-lg border border-slate-300 p-3 dark:border-slate-700">
          <form onSubmit={(event) => handleUpdate(event, todo.id)} className="flex flex-wrap gap-2">
            <input
              aria-label="Edit title"
              className="flex-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
              value={editForm.title}
              onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
            />
            <select
              aria-label="Edit priority"
              className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
              value={editForm.priority}
              onChange={(event) =>
                setEditForm({ ...editForm, priority: event.target.value as Priority })
              }
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABEL[priority]}
                </option>
              ))}
            </select>
            <input
              aria-label="Edit due date"
              type="datetime-local"
              className="rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
              value={editForm.dueDate}
              onChange={(event) => setEditForm({ ...editForm, dueDate: event.target.value })}
            />
            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-600"
            >
              Cancel
            </button>
          </form>
        </li>
      );
    }

    return (
      <li
        key={todo.id}
        data-testid="todo-item"
        data-todo-id={todo.id}
        className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
      >
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => handleToggle(todo)}
          aria-label={`Mark "${todo.title}" as ${todo.completed ? 'incomplete' : 'complete'}`}
          className="h-4 w-4 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p
            data-testid="todo-title"
            className={`truncate font-medium ${todo.completed ? 'text-slate-400 line-through' : ''}`}
          >
            {todo.title}
          </p>
          <DueDate dueDate={todo.due_date} />
        </div>

        <PriorityBadge priority={todo.priority} />

        <button
          type="button"
          onClick={() => startEditing(todo)}
          className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => handleDelete(todo.id)}
          aria-label={`Delete "${todo.title}"`}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-300"
        >
          Delete
        </button>
      </li>
    );
  }

  function renderSection(id: string, title: string, items: Todo[], tone = '') {
    return (
      <section data-testid={`section-${id}`} className="mt-6">
        <h2 className={`mb-2 text-sm font-semibold uppercase tracking-wide ${tone}`}>
          {title} ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing here.</p>
        ) : (
          <ul className="flex flex-col gap-2">{items.map(renderTodo)}</ul>
        )}
      </section>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">Todos</h1>

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap gap-2">
        <input
          aria-label="Todo title"
          placeholder="What needs doing?"
          className="min-w-48 flex-1 rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <select
          aria-label="Priority"
          className="rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          value={form.priority}
          onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}
        >
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABEL[priority]}
            </option>
          ))}
        </select>
        <input
          aria-label="Due date"
          type="datetime-local"
          min={minDueDateValue()}
          className="rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          value={form.dueDate}
          onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      <div className="mt-4 flex items-center gap-2">
        <label htmlFor="priority-filter" className="text-sm text-slate-600 dark:text-slate-400">
          Filter by priority
        </label>
        <select
          id="priority-filter"
          className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as Priority | 'all')}
        >
          <option value="all">All</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABEL[priority]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          {renderSection('overdue', 'Overdue', sections.overdue, 'text-red-700 dark:text-red-300')}
          {renderSection('pending', 'Pending', sections.pending)}
          {renderSection('completed', 'Completed', sections.completed, 'text-slate-500')}
        </>
      )}
    </main>
  );
}
