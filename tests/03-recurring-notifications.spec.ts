import { expect, test } from '@playwright/test';
import { dueDateInDays, registerUser } from './webauthn';

/**
 * Step 9 — Recurring todos and reminder notifications (features 03-04).
 *
 * Recurrence and reminder timing are enforced server-side against Singapore
 * time, and the recurring UI is not yet part of app/page.tsx, so these are
 * driven through the API. Completion goes via POST /api/todos/[id]/complete,
 * which is the only path that spawns the next occurrence.
 */

interface TodoResponse {
  id: number;
  title: string;
  due_date: string | null;
  priority: string;
  completed: boolean;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  reminder_minutes: number | null;
}

test.describe('Recurring todos', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('creates the next occurrence when a recurring todo is completed', async ({ page }) => {
    const created = await page.request.post('/api/todos', {
      data: {
        title: 'Daily standup',
        due_date: dueDateInDays(1, 9),
        is_recurring: true,
        recurrence_pattern: 'daily',
      },
    });
    const { todo }: { todo: TodoResponse } = await created.json();

    const response = await page.request.post(`/api/todos/${todo.id}/complete`);
    expect(response.ok()).toBe(true);

    const { data } = await response.json();
    expect(data.completed.completed).toBe(true);
    expect(data.nextTodo).not.toBeNull();
    expect(data.nextTodo.title).toBe('Daily standup');
    expect(data.nextTodo.completed).toBe(false);
    expect(data.nextTodo.is_recurring).toBe(true);
  });

  test('advances a daily todo by exactly one day', async ({ page }) => {
    const dueDate = dueDateInDays(1, 9);
    const created = await page.request.post('/api/todos', {
      data: {
        title: 'Daily habit',
        due_date: dueDate,
        is_recurring: true,
        recurrence_pattern: 'daily',
      },
    });
    const { todo }: { todo: TodoResponse } = await created.json();

    const response = await page.request.post(`/api/todos/${todo.id}/complete`);
    const { data } = await response.json();

    // Stored values keep the +08:00 offset, so comparing the date portion is safe.
    const original = (todo.due_date ?? '').slice(0, 10);
    const next = (data.nextTodo.due_date as string).slice(0, 10);
    const dayApart =
      (Date.parse(`${next}T00:00:00Z`) - Date.parse(`${original}T00:00:00Z`)) / 86_400_000;

    expect(dayApart).toBe(1);
  });

  test('carries priority and reminder onto the next occurrence', async ({ page }) => {
    const created = await page.request.post('/api/todos', {
      data: {
        title: 'Weekly review',
        due_date: dueDateInDays(2, 10),
        priority: 'high',
        reminder_minutes: 60,
        is_recurring: true,
        recurrence_pattern: 'weekly',
      },
    });
    const { todo }: { todo: TodoResponse } = await created.json();

    const response = await page.request.post(`/api/todos/${todo.id}/complete`);
    const { data } = await response.json();

    expect(data.nextTodo.priority).toBe('high');
    expect(data.nextTodo.reminder_minutes).toBe(60);
    expect(data.nextTodo.recurrence_pattern).toBe('weekly');
  });

  test('keeps both the completed todo and its successor in the list', async ({ page }) => {
    const created = await page.request.post('/api/todos', {
      data: {
        title: 'Monthly report',
        due_date: dueDateInDays(3, 14),
        is_recurring: true,
        recurrence_pattern: 'monthly',
      },
    });
    const { todo }: { todo: TodoResponse } = await created.json();

    await page.request.post(`/api/todos/${todo.id}/complete`);

    const list = await page.request.get('/api/todos');
    const { todos }: { todos: TodoResponse[] } = await list.json();
    const matching = todos.filter((item) => item.title === 'Monthly report');

    expect(matching).toHaveLength(2);
    expect(matching.filter((item) => item.completed)).toHaveLength(1);
    expect(matching.filter((item) => !item.completed)).toHaveLength(1);
  });

  test('does not spawn a successor for a non-recurring todo', async ({ page }) => {
    const created = await page.request.post('/api/todos', {
      data: { title: 'One off', due_date: dueDateInDays(1) },
    });
    const { todo }: { todo: TodoResponse } = await created.json();

    const response = await page.request.post(`/api/todos/${todo.id}/complete`);
    const { data } = await response.json();

    expect(data.completed.completed).toBe(true);
    expect(data.nextTodo).toBeNull();
  });

  test('rejects a recurring todo without a due date', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'No due date', is_recurring: true, recurrence_pattern: 'daily' },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects an unknown recurrence pattern', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: {
        title: 'Bad pattern',
        due_date: dueDateInDays(1),
        is_recurring: true,
        recurrence_pattern: 'fortnightly',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('requires authentication to complete a todo', async ({ page, context }) => {
    const created = await page.request.post('/api/todos', {
      data: { title: 'Protected', due_date: dueDateInDays(1) },
    });
    const { todo }: { todo: TodoResponse } = await created.json();

    await context.clearCookies();

    const response = await page.request.post(`/api/todos/${todo.id}/complete`);
    expect(response.status()).toBe(401);
  });

  test('returns 404 when completing someone else\'s todo', async ({ page, browser }) => {
    const created = await page.request.post('/api/todos', {
      data: { title: 'Mine only', due_date: dueDateInDays(1) },
    });
    const { todo }: { todo: TodoResponse } = await created.json();

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await registerUser(otherPage);

    const response = await otherPage.request.post(`/api/todos/${todo.id}/complete`);
    expect(response.status()).toBe(404);

    await otherContext.close();
  });
});

test.describe('Reminder notifications', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('returns an empty list when nothing is due', async ({ page }) => {
    const response = await page.request.get('/api/notifications/check');

    expect(response.ok()).toBe(true);
    await expect(response.json()).resolves.toMatchObject({ success: true, data: [] });
  });

  test('does not surface a todo whose reminder window has not opened', async ({ page }) => {
    await page.request.post('/api/todos', {
      data: {
        title: 'Far future',
        due_date: dueDateInDays(20, 9),
        reminder_minutes: 15,
      },
    });

    const response = await page.request.get('/api/notifications/check');
    const { data }: { data: TodoResponse[] } = await response.json();

    expect(data.map((todo) => todo.title)).not.toContain('Far future');
  });

  test('surfaces a todo once its reminder window has opened', async ({ page }) => {
    // A reminder a week ahead of a due date two days out is already open.
    await page.request.post('/api/todos', {
      data: {
        title: 'Reminder is live',
        due_date: dueDateInDays(2, 9),
        reminder_minutes: 10_080,
      },
    });

    const response = await page.request.get('/api/notifications/check');
    const { data }: { data: TodoResponse[] } = await response.json();

    expect(data.map((todo) => todo.title)).toContain('Reminder is live');
  });

  test('ignores todos that have no reminder set', async ({ page }) => {
    await page.request.post('/api/todos', {
      data: { title: 'No reminder', due_date: dueDateInDays(1, 9) },
    });

    const response = await page.request.get('/api/notifications/check');
    const { data }: { data: TodoResponse[] } = await response.json();

    expect(data.map((todo) => todo.title)).not.toContain('No reminder');
  });

  test('rejects a reminder offset that is not an allowed option', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'Odd reminder', due_date: dueDateInDays(1), reminder_minutes: 7 },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects a reminder without a due date', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'Dangling reminder', reminder_minutes: 60 },
    });

    expect(response.status()).toBe(400);
  });

  test('requires authentication to poll for notifications', async ({ page, context }) => {
    await context.clearCookies();

    const response = await page.request.get('/api/notifications/check');
    expect(response.status()).toBe(401);
  });

  test('only reports reminders belonging to the requesting user', async ({ page, browser }) => {
    await page.request.post('/api/todos', {
      data: {
        title: 'First user reminder',
        due_date: dueDateInDays(2, 9),
        reminder_minutes: 10_080,
      },
    });

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await registerUser(otherPage);

    const response = await otherPage.request.get('/api/notifications/check');
    const { data }: { data: TodoResponse[] } = await response.json();
    expect(data.map((todo) => todo.title)).not.toContain('First user reminder');

    await otherContext.close();
  });
});
