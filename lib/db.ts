/**
 * Database layer — single source of truth for the schema, shared types, and all
 * CRUD operations.
 *
 * better-sqlite3 is synchronous, so nothing here returns a promise. Every
 * statement is prepared and parameterised. All user-scoped reads and writes take
 * a `userId` so callers cannot accidentally cross tenant boundaries.
 */

import path from 'node:path';
import Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
export const REMINDER_OPTIONS: readonly ReminderMinutes[] = [
  15, 30, 60, 120, 1440, 2880, 10080,
] as const;

/** Sort weight for priority ordering: high first, low last. */
export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const DEFAULT_TAG_COLOR = '#3B82F6';

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface Authenticator {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: Buffer;
  counter: number;
  created_at: string;
}

export interface Session {
  userId: number;
  username: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  due_date: string | null;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
  subtasks?: Subtask[];
  tags?: Tag[];
}

export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  due_date_offset_minutes: number | null;
  subtasks_json: string | null;
  created_at: string;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

/** Shape stored inside `templates.subtasks_json`. */
export interface TemplateSubtask {
  title: string;
  position: number;
}

export interface CreateTodoInput {
  title: string;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  completed?: boolean;
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
  due_date?: string | null;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  last_notification_sent?: string | null;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  category?: string | null;
  title_template: string;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  due_date_offset_minutes?: number | null;
  subtasks?: TemplateSubtask[] | null;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  category?: string | null;
  title_template?: string;
  priority?: Priority;
  is_recurring?: boolean;
  recurrence_pattern?: RecurrencePattern | null;
  reminder_minutes?: number | null;
  due_date_offset_minutes?: number | null;
  subtasks?: TemplateSubtask[] | null;
}

// ---------------------------------------------------------------------------
// Connection & schema
// ---------------------------------------------------------------------------

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(process.cwd(), 'todos.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS authenticators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  credential_public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  reminder_minutes INTEGER,
  last_notification_sent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '${DEFAULT_TAG_COLOR}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  title_template TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_pattern TEXT,
  reminder_minutes INTEGER,
  due_date_offset_minutes INTEGER,
  subtasks_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
`;

function createConnection(): Database.Database {
  const connection = new Database(DB_PATH);

  // ON DELETE CASCADE is a no-op in SQLite unless foreign keys are enabled.
  connection.pragma('foreign_keys = ON');
  connection.pragma('journal_mode = WAL');
  connection.exec(SCHEMA);

  return connection;
}

/**
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * SQLite handle on every reload and eventually lock the file.
 */
const globalForDb = globalThis as unknown as { __todoAppDb?: Database.Database };

export const db: Database.Database = globalForDb.__todoAppDb ?? createConnection();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__todoAppDb = db;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

interface TodoRow {
  id: number;
  user_id: number;
  title: string;
  completed: number;
  due_date: string | null;
  priority: string;
  is_recurring: number;
  recurrence_pattern: string | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
}

interface SubtaskRow {
  id: number;
  todo_id: number;
  title: string;
  completed: number;
  position: number;
  created_at: string;
}

interface TemplateRow {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  category: string | null;
  title_template: string;
  priority: string;
  is_recurring: number;
  recurrence_pattern: string | null;
  reminder_minutes: number | null;
  due_date_offset_minutes: number | null;
  subtasks_json: string | null;
  created_at: string;
}

function toTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    completed: row.completed === 1,
    due_date: row.due_date,
    priority: row.priority as Priority,
    is_recurring: row.is_recurring === 1,
    recurrence_pattern: row.recurrence_pattern as RecurrencePattern | null,
    reminder_minutes: row.reminder_minutes ?? null,
    last_notification_sent: row.last_notification_sent ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  };
}

function toSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    todo_id: row.todo_id,
    title: row.title,
    completed: row.completed === 1,
    position: row.position,
    created_at: row.created_at,
  };
}

function toTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description ?? null,
    category: row.category ?? null,
    title_template: row.title_template,
    priority: row.priority as Priority,
    is_recurring: row.is_recurring === 1,
    recurrence_pattern: row.recurrence_pattern as RecurrencePattern | null,
    reminder_minutes: row.reminder_minutes ?? null,
    due_date_offset_minutes: row.due_date_offset_minutes ?? null,
    subtasks_json: row.subtasks_json ?? null,
    created_at: row.created_at,
  };
}

const toBit = (value: boolean | undefined, fallback = false): number =>
  (value ?? fallback) ? 1 : 0;

// ---------------------------------------------------------------------------
// Users & authenticators
// ---------------------------------------------------------------------------

export const userDB = {
  findById(id: number): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
    return row ?? null;
  },

  findByUsername(username: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
      | User
      | undefined;
    return row ?? null;
  },

  create(username: string): User {
    const result = db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    const created = userDB.findById(Number(result.lastInsertRowid));
    if (!created) throw new Error('Failed to create user');
    return created;
  },
};

export const authenticatorDB = {
  findByCredentialId(credentialId: string): Authenticator | null {
    const row = db
      .prepare('SELECT * FROM authenticators WHERE credential_id = ?')
      .get(credentialId) as Authenticator | undefined;
    return row ?? null;
  },

  listByUser(userId: number): Authenticator[] {
    return db
      .prepare('SELECT * FROM authenticators WHERE user_id = ? ORDER BY id')
      .all(userId) as Authenticator[];
  },

  create(input: {
    user_id: number;
    credential_id: string;
    credential_public_key: Buffer;
    counter?: number;
  }): Authenticator {
    const result = db
      .prepare(
        `INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        input.user_id,
        input.credential_id,
        input.credential_public_key,
        input.counter ?? 0,
      );

    const created = db
      .prepare('SELECT * FROM authenticators WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as Authenticator | undefined;

    if (!created) throw new Error('Failed to create authenticator');
    return created;
  },

  updateCounter(credentialId: string, counter: number): void {
    db.prepare('UPDATE authenticators SET counter = ? WHERE credential_id = ?').run(
      counter ?? 0,
      credentialId,
    );
  },
};

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const tagDB = {
  listByUser(userId: number): Tag[] {
    return db
      .prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE')
      .all(userId) as Tag[];
  },

  findById(id: number, userId: number): Tag | null {
    const row = db.prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?').get(id, userId) as
      | Tag
      | undefined;
    return row ?? null;
  },

  /** Case-insensitive lookup, used for import conflict resolution. */
  findByName(userId: number, name: string): Tag | null {
    const row = db
      .prepare('SELECT * FROM tags WHERE user_id = ? AND name = ? COLLATE NOCASE')
      .get(userId, name) as Tag | undefined;
    return row ?? null;
  },

  create(userId: number, input: CreateTagInput): Tag {
    const result = db
      .prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)')
      .run(userId, input.name, input.color ?? DEFAULT_TAG_COLOR);

    const created = tagDB.findById(Number(result.lastInsertRowid), userId);
    if (!created) throw new Error('Failed to create tag');
    return created;
  },

  /** Reuses an existing tag when the name already exists (case-insensitive). */
  findOrCreate(userId: number, name: string, color?: string): Tag {
    return tagDB.findByName(userId, name) ?? tagDB.create(userId, { name, color });
  },

  update(id: number, userId: number, input: UpdateTagInput): Tag | null {
    const existing = tagDB.findById(id, userId);
    if (!existing) return null;

    db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ? AND user_id = ?').run(
      input.name ?? existing.name,
      input.color ?? existing.color,
      id,
      userId,
    );

    return tagDB.findById(id, userId);
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  },

  listByTodo(todoId: number): Tag[] {
    return db
      .prepare(
        `SELECT t.* FROM tags t
         JOIN todo_tags tt ON tt.tag_id = t.id
         WHERE tt.todo_id = ?
         ORDER BY t.name COLLATE NOCASE`,
      )
      .all(todoId) as Tag[];
  },

  /** Idempotent: attaching an already-attached tag is a no-op. */
  attach(todoId: number, tagId: number): void {
    db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(
      todoId,
      tagId,
    );
  },

  /** Idempotent: detaching an unattached tag is a no-op. */
  detach(todoId: number, tagId: number): void {
    db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
  },

  setForTodo(todoId: number, tagIds: number[]): void {
    const replace = db.transaction((ids: number[]) => {
      db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId);
      const insert = db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)');
      for (const tagId of ids) insert.run(todoId, tagId);
    });

    replace(tagIds);
  },
};

// ---------------------------------------------------------------------------
// Subtasks
// ---------------------------------------------------------------------------

export const subtaskDB = {
  listByTodo(todoId: number): Subtask[] {
    const rows = db
      .prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position, id')
      .all(todoId) as SubtaskRow[];
    return rows.map(toSubtask);
  },

  findById(id: number): Subtask | null {
    const row = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as SubtaskRow | undefined;
    return row ? toSubtask(row) : null;
  },

  /** Resolves the owning user, so routes can authorise subtask mutations. */
  findOwnerUserId(subtaskId: number): number | null {
    const row = db
      .prepare(
        `SELECT t.user_id AS user_id FROM subtasks s
         JOIN todos t ON t.id = s.todo_id
         WHERE s.id = ?`,
      )
      .get(subtaskId) as { user_id: number } | undefined;
    return row?.user_id ?? null;
  },

  /** Appends at `max(position) + 1`; deletions never renumber siblings. */
  create(todoId: number, title: string, position?: number): Subtask {
    const nextPosition =
      position ??
      ((
        db.prepare('SELECT COALESCE(MAX(position), -1) AS max FROM subtasks WHERE todo_id = ?').get(
          todoId,
        ) as { max: number }
      ).max +
        1);

    const result = db
      .prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)')
      .run(todoId, title, nextPosition);

    const created = subtaskDB.findById(Number(result.lastInsertRowid));
    if (!created) throw new Error('Failed to create subtask');
    return created;
  },

  update(id: number, input: { title?: string; completed?: boolean }): Subtask | null {
    const existing = subtaskDB.findById(id);
    if (!existing) return null;

    db.prepare('UPDATE subtasks SET title = ?, completed = ? WHERE id = ?').run(
      input.title ?? existing.title,
      toBit(input.completed, existing.completed),
      id,
    );

    return subtaskDB.findById(id);
  },

  delete(id: number): boolean {
    return db.prepare('DELETE FROM subtasks WHERE id = ?').run(id).changes > 0;
  },
};

/** Progress percentage for a subtask list. Returns 0 when there are none. */
export function calculateProgress(subtasks: Subtask[]): number {
  if (subtasks.length === 0) return 0;
  const completed = subtasks.filter((subtask) => subtask.completed).length;
  return Math.round((completed / subtasks.length) * 100);
}

// ---------------------------------------------------------------------------
// Todos
// ---------------------------------------------------------------------------

export const todoDB = {
  /** Returns todos with subtasks and tags attached. */
  listByUser(userId: number): Todo[] {
    const rows = db
      .prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC, id DESC')
      .all(userId) as TodoRow[];

    return rows.map((row) => {
      const todo = toTodo(row);
      todo.subtasks = subtaskDB.listByTodo(todo.id);
      todo.tags = tagDB.listByTodo(todo.id);
      return todo;
    });
  },

  findById(id: number, userId: number): Todo | null {
    const row = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, userId) as
      | TodoRow
      | undefined;
    if (!row) return null;

    const todo = toTodo(row);
    todo.subtasks = subtaskDB.listByTodo(todo.id);
    todo.tags = tagDB.listByTodo(todo.id);
    return todo;
  },

  create(userId: number, input: CreateTodoInput): Todo {
    const result = db
      .prepare(
        `INSERT INTO todos
           (user_id, title, completed, due_date, priority, is_recurring,
            recurrence_pattern, reminder_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        input.title,
        toBit(input.completed),
        input.due_date ?? null,
        input.priority ?? 'medium',
        toBit(input.is_recurring),
        input.recurrence_pattern ?? null,
        input.reminder_minutes ?? null,
      );

    const created = todoDB.findById(Number(result.lastInsertRowid), userId);
    if (!created) throw new Error('Failed to create todo');
    return created;
  },

  update(id: number, userId: number, input: UpdateTodoInput): Todo | null {
    const existing = todoDB.findById(id, userId);
    if (!existing) return null;

    db.prepare(
      `UPDATE todos SET
         title = ?, completed = ?, due_date = ?, priority = ?,
         is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ?,
         last_notification_sent = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    ).run(
      input.title ?? existing.title,
      toBit(input.completed, existing.completed),
      input.due_date !== undefined ? input.due_date : existing.due_date,
      input.priority ?? existing.priority,
      toBit(input.is_recurring, existing.is_recurring),
      input.recurrence_pattern !== undefined
        ? input.recurrence_pattern
        : existing.recurrence_pattern,
      input.reminder_minutes !== undefined ? input.reminder_minutes : existing.reminder_minutes,
      input.last_notification_sent !== undefined
        ? input.last_notification_sent
        : existing.last_notification_sent,
      id,
      userId,
    );

    return todoDB.findById(id, userId);
  },

  /** Cascades to subtasks and tag associations via foreign keys. */
  delete(id: number, userId: number): boolean {
    return db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },

  /** Candidates for reminder delivery: incomplete, with a due date and reminder set. */
  listPendingReminders(userId: number): Todo[] {
    const rows = db
      .prepare(
        `SELECT * FROM todos
         WHERE user_id = ?
           AND completed = 0
           AND due_date IS NOT NULL
           AND reminder_minutes IS NOT NULL
         ORDER BY due_date`,
      )
      .all(userId) as TodoRow[];

    return rows.map(toTodo);
  },

  markNotified(id: number, userId: number, timestamp: string): void {
    db.prepare('UPDATE todos SET last_notification_sent = ? WHERE id = ? AND user_id = ?').run(
      timestamp,
      id,
      userId,
    );
  },
};

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** Parses `subtasks_json` defensively — malformed JSON yields an empty list. */
export function parseTemplateSubtasks(subtasksJson: string | null): TemplateSubtask[] {
  if (!subtasksJson) return [];

  try {
    const parsed: unknown = JSON.parse(subtasksJson);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is TemplateSubtask =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as TemplateSubtask).title === 'string',
      )
      .map((item, index) => ({
        title: item.title,
        position: typeof item.position === 'number' ? item.position : index,
      }));
  } catch {
    return [];
  }
}

function serializeTemplateSubtasks(subtasks: TemplateSubtask[] | null | undefined): string | null {
  if (!subtasks || subtasks.length === 0) return null;
  return JSON.stringify(
    subtasks.map((subtask, index) => ({
      title: subtask.title,
      position: subtask.position ?? index,
    })),
  );
}

export const templateDB = {
  listByUser(userId: number): Template[] {
    const rows = db
      .prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY name COLLATE NOCASE')
      .all(userId) as TemplateRow[];
    return rows.map(toTemplate);
  },

  findById(id: number, userId: number): Template | null {
    const row = db
      .prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?')
      .get(id, userId) as TemplateRow | undefined;
    return row ? toTemplate(row) : null;
  },

  create(userId: number, input: CreateTemplateInput): Template {
    const result = db
      .prepare(
        `INSERT INTO templates
           (user_id, name, description, category, title_template, priority,
            is_recurring, recurrence_pattern, reminder_minutes,
            due_date_offset_minutes, subtasks_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        input.name,
        input.description ?? null,
        input.category ?? null,
        input.title_template,
        input.priority ?? 'medium',
        toBit(input.is_recurring),
        input.recurrence_pattern ?? null,
        input.reminder_minutes ?? null,
        input.due_date_offset_minutes ?? null,
        serializeTemplateSubtasks(input.subtasks),
      );

    const created = templateDB.findById(Number(result.lastInsertRowid), userId);
    if (!created) throw new Error('Failed to create template');
    return created;
  },

  update(id: number, userId: number, input: UpdateTemplateInput): Template | null {
    const existing = templateDB.findById(id, userId);
    if (!existing) return null;

    db.prepare(
      `UPDATE templates SET
         name = ?, description = ?, category = ?, title_template = ?, priority = ?,
         is_recurring = ?, recurrence_pattern = ?, reminder_minutes = ?,
         due_date_offset_minutes = ?, subtasks_json = ?
       WHERE id = ? AND user_id = ?`,
    ).run(
      input.name ?? existing.name,
      input.description !== undefined ? input.description : existing.description,
      input.category !== undefined ? input.category : existing.category,
      input.title_template ?? existing.title_template,
      input.priority ?? existing.priority,
      toBit(input.is_recurring, existing.is_recurring),
      input.recurrence_pattern !== undefined
        ? input.recurrence_pattern
        : existing.recurrence_pattern,
      input.reminder_minutes !== undefined ? input.reminder_minutes : existing.reminder_minutes,
      input.due_date_offset_minutes !== undefined
        ? input.due_date_offset_minutes
        : existing.due_date_offset_minutes,
      input.subtasks !== undefined
        ? serializeTemplateSubtasks(input.subtasks)
        : existing.subtasks_json,
      id,
      userId,
    );

    return templateDB.findById(id, userId);
  },

  /** Deleting a template never affects todos already created from it. */
  delete(id: number, userId: number): boolean {
    return (
      db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(id, userId).changes > 0
    );
  },
};

// ---------------------------------------------------------------------------
// Holidays
// ---------------------------------------------------------------------------

export const holidayDB = {
  /** Holidays are global rather than user-scoped. */
  list(): Holiday[] {
    return db.prepare('SELECT id, date, name FROM holidays ORDER BY date').all() as Holiday[];
  },

  listByMonth(year: number, month: number): Holiday[] {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return db
      .prepare('SELECT id, date, name FROM holidays WHERE date LIKE ? ORDER BY date')
      .all(`${prefix}%`) as Holiday[];
  },

  upsert(date: string, name: string): void {
    db.prepare(
      `INSERT INTO holidays (date, name) VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET name = excluded.name`,
    ).run(date, name);
  },
};

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/** Runs `work` inside a single SQLite transaction (used by import). */
export function runInTransaction<T>(work: () => T): T {
  return db.transaction(work)();
}
