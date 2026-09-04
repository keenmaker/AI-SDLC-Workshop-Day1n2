import { expect, test } from '@playwright/test';
import { dueDateInDays, registerUser } from './webauthn';

/**
 * Step 9 — Calendar view and export/import (features 09-10).
 *
 * The calendar renders Singapore-local months and marks public holidays; the
 * Playwright context is pinned to Asia/Singapore so "today" agrees with the
 * server. Export/import is asserted through the API, including the CSV and
 * JSON content types and the transactional import result.
 */

interface TodoResponse {
  id: number;
  title: string;
  due_date: string | null;
  priority: string;
  completed: boolean;
}

/** Current Singapore month, independent of the host clock. */
function singaporeMonth(): { year: number; month: number } {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

test.describe('Calendar view', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('renders the current Singapore month by default', async ({ page }) => {
    const { year, month } = singaporeMonth();
    const expected = new Intl.DateTimeFormat('en-SG', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Singapore',
    }).format(new Date(Date.UTC(year, month - 1, 1)));

    await page.goto('/calendar');

    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  });

  test('shows all seven weekday headers', async ({ page }) => {
    await page.goto('/calendar');

    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible();
    }
  });

  test('navigates to the previous month', async ({ page }) => {
    await page.goto('/calendar');
    await page.getByLabel('Previous month').click();

    await expect(page).toHaveURL(/\/calendar\?month=/);
  });

  test('navigates to the next month', async ({ page }) => {
    await page.goto('/calendar');
    await page.getByLabel('Next month').click();

    await expect(page).toHaveURL(/\/calendar\?month=/);
  });

  test('returns to the current month via Today', async ({ page }) => {
    const { year, month } = singaporeMonth();
    const expected = new Intl.DateTimeFormat('en-SG', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Singapore',
    }).format(new Date(Date.UTC(year, month - 1, 1)));

    await page.goto('/calendar');
    await page.getByLabel('Next month').click();
    await page.getByRole('button', { name: 'Today' }).click();

    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  });

  test('honours an explicit month in the query string', async ({ page }) => {
    await page.goto('/calendar?month=2026-03');

    await expect(page.getByText('March 2026', { exact: true })).toBeVisible();
  });

  test('falls back to the current month for a malformed query', async ({ page }) => {
    const { year, month } = singaporeMonth();
    const expected = new Intl.DateTimeFormat('en-SG', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Singapore',
    }).format(new Date(Date.UTC(year, month - 1, 1)));

    await page.goto('/calendar?month=not-a-month');

    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  });

  test('shows a todo on its due date', async ({ page }) => {
    const dueDate = dueDateInDays(2, 10);
    await page.request.post('/api/todos', {
      data: { title: 'Calendar entry', due_date: dueDate },
    });

    await page.goto('/calendar');

    await expect(page.getByText('Calendar entry').first()).toBeVisible();
  });

  test('opens the day modal when a date is clicked', async ({ page }) => {
    const dueDate = dueDateInDays(2, 10);
    await page.request.post('/api/todos', {
      data: { title: 'Modal entry', due_date: dueDate },
    });

    await page.goto('/calendar');
    await page.getByText('Modal entry').first().click();

    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('returns holidays for a requested month', async ({ page }) => {
    const response = await page.request.get('/api/holidays?year=2026&month=1');

    expect(response.ok()).toBe(true);
    const { holidays } = await response.json();
    expect(Array.isArray(holidays)).toBe(true);
  });

  test('requires authentication to view the calendar', async ({ page, context }) => {
    await context.clearCookies();

    await page.goto('/calendar');

    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Export', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('exports JSON with a versioned envelope', async ({ page }) => {
    await page.request.post('/api/todos', { data: { title: 'Exported todo' } });

    const response = await page.request.get('/api/todos/export?format=json');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');

    const body = await response.json();
    expect(body.version).toBe(1);
    expect(body.todos.map((todo: TodoResponse) => todo.title)).toContain('Exported todo');
  });

  test('names the JSON download after the Singapore date', async ({ page }) => {
    const response = await page.request.get('/api/todos/export?format=json');

    expect(response.headers()['content-disposition']).toMatch(
      /attachment; filename="todos-\d{4}-\d{2}-\d{2}\.json"/,
    );
  });

  test('exports CSV with the correct content type', async ({ page }) => {
    await page.request.post('/api/todos', { data: { title: 'CSV todo' } });

    const response = await page.request.get('/api/todos/export?format=csv');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('text/csv');
    expect(await response.text()).toContain('CSV todo');
  });

  test('defaults to JSON when no format is given', async ({ page }) => {
    const response = await page.request.get('/api/todos/export');

    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('rejects an unsupported format', async ({ page }) => {
    const response = await page.request.get('/api/todos/export?format=xml');

    expect(response.status()).toBe(400);
  });

  test('requires authentication to export', async ({ page, context }) => {
    await context.clearCookies();

    const response = await page.request.get('/api/todos/export');
    expect(response.status()).toBe(401);
  });

  test("never includes another user's todos", async ({ page, browser }) => {
    await page.request.post('/api/todos', { data: { title: 'Private export' } });

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await registerUser(otherPage);

    const body = await (await otherPage.request.get('/api/todos/export')).json();
    expect(body.todos.map((todo: TodoResponse) => todo.title)).not.toContain('Private export');

    await otherContext.close();
  });
});

test.describe('Import', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('imports todos and reports how many were created', async ({ page }) => {
    const response = await page.request.post('/api/todos/import', {
      data: {
        version: 1,
        todos: [
          { title: 'Imported one', priority: 'high' },
          { title: 'Imported two', priority: 'low' },
        ],
      },
    });

    expect(response.ok()).toBe(true);
    await expect(response.json()).resolves.toMatchObject({ success: true, imported: 2 });
  });

  test('makes imported todos visible in the list', async ({ page }) => {
    await page.request.post('/api/todos/import', {
      data: { version: 1, todos: [{ title: 'Visible import', priority: 'medium' }] },
    });

    const { todos }: { todos: TodoResponse[] } = await (await page.request.get('/api/todos')).json();
    expect(todos.map((todo) => todo.title)).toContain('Visible import');
  });

  test('rejects a payload that is not valid JSON', async ({ page }) => {
    const response = await page.request.post('/api/todos/import', {
      headers: { 'Content-Type': 'application/json' },
      data: 'this is not json',
    });

    expect(response.status()).toBe(400);
  });

  test('rejects a payload with the wrong shape', async ({ page }) => {
    const response = await page.request.post('/api/todos/import', {
      data: { version: 1, todos: [{ notATitle: true }] },
    });

    expect(response.status()).toBe(400);
  });

  test('imports nothing when the payload is invalid', async ({ page }) => {
    const before: { todos: TodoResponse[] } = await (await page.request.get('/api/todos')).json();

    await page.request.post('/api/todos/import', {
      data: { version: 1, todos: [{ title: 'Valid' }, { notATitle: true }] },
    });

    const after: { todos: TodoResponse[] } = await (await page.request.get('/api/todos')).json();
    expect(after.todos).toHaveLength(before.todos.length);
  });

  test('accepts an empty todo list', async ({ page }) => {
    const response = await page.request.post('/api/todos/import', {
      data: { version: 1, todos: [] },
    });

    await expect(response.json()).resolves.toMatchObject({ success: true, imported: 0 });
  });

  test('round-trips an export back through import', async ({ page }) => {
    await page.request.post('/api/todos', {
      data: { title: 'Round trip', priority: 'high', due_date: dueDateInDays(4) },
    });

    const exported = await (await page.request.get('/api/todos/export?format=json')).json();

    const otherContext = await page.context().browser()!.newContext();
    const otherPage = await otherContext.newPage();
    await registerUser(otherPage);

    const response = await otherPage.request.post('/api/todos/import', { data: exported });
    expect(response.ok()).toBe(true);

    const { todos }: { todos: TodoResponse[] } = await (
      await otherPage.request.get('/api/todos')
    ).json();
    expect(todos.map((todo) => todo.title)).toContain('Round trip');

    await otherContext.close();
  });

  test('requires authentication to import', async ({ page, context }) => {
    await context.clearCookies();

    const response = await page.request.post('/api/todos/import', {
      data: { version: 1, todos: [] },
    });
    expect(response.status()).toBe(401);
  });
});
