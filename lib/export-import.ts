import type { Priority, RecurrencePattern, Subtask, Tag, Todo } from '@/lib/db';
import { db, runInTransaction } from '@/lib/db';

export interface TodoExportItem {
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  created_at: string;
  subtasks: Array<Pick<Subtask, 'title' | 'completed' | 'position'>>;
  tags: Array<Pick<Tag, 'name' | 'color'>>;
}

export interface TodoExport {
  version: 1;
  exported_at: string;
  todos: TodoExportItem[];
}

export interface ImportResult {
  imported: number;
  tagsCreated: number;
  tagsReused: number;
}

export function toExportItem(todo: Todo): TodoExportItem {
  return {
    title: todo.title,
    completed: todo.completed,
    due_date: todo.due_date,
    priority: todo.priority,
    is_recurring: todo.is_recurring,
    recurrence_pattern: todo.recurrence_pattern,
    reminder_minutes: todo.reminder_minutes,
    created_at: todo.created_at,
    subtasks: (todo.subtasks ?? []).map(({ title, completed, position }) => ({
      title,
      completed,
      position,
    })),
    tags: (todo.tags ?? []).map(({ name, color }) => ({ name, color })),
  };
}

function csvValue(value: string | number | boolean | null): string {
  const text = value === null ? '' : String(value);
  return /[,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(todos: Todo[]): string {
  const header = 'ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder';
  const rows = todos.map((todo) =>
    [
      todo.id,
      todo.title,
      todo.completed,
      todo.due_date,
      todo.priority,
      todo.is_recurring,
      todo.recurrence_pattern,
      todo.reminder_minutes,
    ]
      .map(csvValue)
      .join(','),
  );
  return [header, ...rows].join('\r\n') + '\r\n';
}

export function importTodos(userId: number, items: TodoExportItem[]): ImportResult {
  let tagsCreated = 0;
  let tagsReused = 0;

  runInTransaction(() => {
    const insertTodo = db.prepare(
      `INSERT INTO todos
        (user_id, title, completed, due_date, priority, is_recurring,
         recurrence_pattern, reminder_minutes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertSubtask = db.prepare(
      'INSERT INTO subtasks (todo_id, title, completed, position) VALUES (?, ?, ?, ?)',
    );
    const findTag = db.prepare(
      'SELECT id FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE',
    );
    const insertTag = db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)');
    const linkTag = db.prepare(
      'INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)',
    );

    for (const item of items) {
      const todoResult = insertTodo.run(
        userId,
        item.title,
        item.completed ? 1 : 0,
        item.due_date,
        item.priority,
        item.is_recurring ? 1 : 0,
        item.recurrence_pattern,
        item.reminder_minutes,
        item.created_at,
      );
      const todoId = Number(todoResult.lastInsertRowid);

      item.subtasks.forEach((subtask, position) => {
        insertSubtask.run(todoId, subtask.title, subtask.completed ? 1 : 0, position);
      });

      for (const tag of item.tags) {
        const existing = findTag.get(userId, tag.name) as { id: number } | undefined;
        const tagId = existing
          ? (tagsReused++, existing.id)
          : (tagsCreated++, Number(insertTag.run(userId, tag.name, tag.color).lastInsertRowid));
        linkTag.run(todoId, tagId);
      }
    }
  });

  return { imported: items.length, tagsCreated, tagsReused };
}
