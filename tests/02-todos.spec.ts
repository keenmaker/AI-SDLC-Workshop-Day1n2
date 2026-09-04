import { expect, test, type Page } from '@playwright/test';
import { dueDateInDays, registerUser } from './webauthn';

/**
 * Step 9 — Core todo CRUD (features 01-02).
 *
 * Exercises the main page in app/page.tsx: create, read, update, toggle,
 * delete, plus the priority ordering and section placement that the list
 * depends on. API-level assertions cover the validation rules that the form
 * cannot reach.
 */

function todoItem(page: Page, title: string) {
  return page.getByTestId('todo-item').filter({ hasText: title });
}

async function createTodo(
  page: Page,
  title: string,
  options: { priority?: 'high' | 'medium' | 'low'; dueDate?: string } = {},
) {
  await page.getByLabel('Todo title').fill(title);

  if (options.priority) {
    await page.getByLabel('Priority', { exact: true }).selectOption(options.priority);
  }
  if (options.dueDate) {
    await page.getByLabel('Due date', { exact: true }).fill(options.dueDate);
  }

  await page.getByRole('button', { name: 'Add' }).click();
  await expect(todoItem(page, title)).toBeVisible();
}

test.describe('Todo CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('creates a todo and shows it under Pending', async ({ page }) => {
    await createTodo(page, 'Write the report');

    await expect(page.getByTestId('section-pending')).toContainText('Write the report');
    // Medium is the default when no priority is chosen.
    await expect(todoItem(page, 'Write the report').getByTestId('priority-badge-medium')).toBeVisible();
  });

  test('clears the form after a successful create', async ({ page }) => {
    await createTodo(page, 'Reset me');

    await expect(page.getByLabel('Todo title')).toHaveValue('');
  });

  test('creates a todo with a due date and high priority', async ({ page }) => {
    await createTodo(page, 'Ship release', { priority: 'high', dueDate: dueDateInDays(3) });

    await expect(todoItem(page, 'Ship release').getByTestId('priority-badge-high')).toBeVisible();
  });

  test('refuses to submit an empty title', async ({ page }) => {
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByRole('alert')).toContainText('Title is required');
    await expect(page.getByTestId('todo-item')).toHaveCount(0);
  });

  test('refuses a whitespace-only title', async ({ page }) => {
    await page.getByLabel('Todo title').fill('    ');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByTestId('todo-item')).toHaveCount(0);
  });

  test('creates several todos and lists them all', async ({ page }) => {
    await createTodo(page, 'First task');
    await createTodo(page, 'Second task');
    await createTodo(page, 'Third task');

    await expect(page.getByTestId('todo-item')).toHaveCount(3);
  });

  test('edits the title of an existing todo', async ({ page }) => {
    await createTodo(page, 'Draft agenda');

    await todoItem(page, 'Draft agenda').getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Edit title').fill('Final agenda');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(todoItem(page, 'Final agenda')).toBeVisible();
    await expect(todoItem(page, 'Draft agenda')).toHaveCount(0);
  });

  test('changes priority through the edit form', async ({ page }) => {
    await createTodo(page, 'Promote me', { priority: 'low' });

    await todoItem(page, 'Promote me').getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Edit priority').selectOption('high');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(todoItem(page, 'Promote me').getByTestId('priority-badge-high')).toBeVisible();
  });

  test('cancelling an edit leaves the todo untouched', async ({ page }) => {
    await createTodo(page, 'Keep me');

    await todoItem(page, 'Keep me').getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Edit title').fill('Changed');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(todoItem(page, 'Keep me')).toBeVisible();
    await expect(todoItem(page, 'Changed')).toHaveCount(0);
  });

  test('completing a todo moves it into the Completed section', async ({ page }) => {
    await createTodo(page, 'Buy milk');

    await todoItem(page, 'Buy milk').getByRole('checkbox').check();

    await expect(page.getByTestId('section-completed')).toContainText('Buy milk');
    await expect(page.getByTestId('section-pending')).not.toContainText('Buy milk');
  });

  test('un-completing returns the todo to Pending', async ({ page }) => {
    await createTodo(page, 'Call bank');

    await todoItem(page, 'Call bank').getByRole('checkbox').check();
    await expect(page.getByTestId('section-completed')).toContainText('Call bank');

    await todoItem(page, 'Call bank').getByRole('checkbox').uncheck();
    await expect(page.getByTestId('section-pending')).toContainText('Call bank');
  });

  test('deletes a todo immediately, without a confirmation prompt', async ({ page }) => {
    await createTodo(page, 'Temporary task');

    await todoItem(page, 'Temporary task').getByRole('button', { name: /^Delete/ }).click();

    await expect(todoItem(page, 'Temporary task')).toHaveCount(0);
  });

  test('deleting one todo leaves the others intact', async ({ page }) => {
    await createTodo(page, 'Keep this');
    await createTodo(page, 'Remove this');

    await todoItem(page, 'Remove this').getByRole('button', { name: /^Delete/ }).click();

    await expect(todoItem(page, 'Remove this')).toHaveCount(0);
    await expect(todoItem(page, 'Keep this')).toBeVisible();
  });

  test('persists todos across a reload', async ({ page }) => {
    await createTodo(page, 'Persistent task');

    await page.reload();

    await expect(todoItem(page, 'Persistent task')).toBeVisible();
  });

  test('orders pending todos high, then medium, then low', async ({ page }) => {
    await createTodo(page, 'Low job', { priority: 'low' });
    await createTodo(page, 'Medium job', { priority: 'medium' });
    await createTodo(page, 'High job', { priority: 'high' });

    const titles = await page.getByTestId('section-pending').getByTestId('todo-title').allInnerTexts();
    expect(titles).toEqual(['High job', 'Medium job', 'Low job']);
  });

  test('breaks ties on equal priority by the earlier due date', async ({ page }) => {
    await createTodo(page, 'Later', { priority: 'high', dueDate: dueDateInDays(6) });
    await createTodo(page, 'Sooner', { priority: 'high', dueDate: dueDateInDays(2) });

    const titles = await page.getByTestId('section-pending').getByTestId('todo-title').allInnerTexts();
    expect(titles).toEqual(['Sooner', 'Later']);
  });

  test('filters the visible list by priority', async ({ page }) => {
    await createTodo(page, 'Urgent thing', { priority: 'high' });
    await createTodo(page, 'Casual thing', { priority: 'low' });

    await page.getByLabel('Filter by priority').selectOption('high');
    await expect(todoItem(page, 'Urgent thing')).toBeVisible();
    await expect(todoItem(page, 'Casual thing')).toHaveCount(0);

    await page.getByLabel('Filter by priority').selectOption('all');
    await expect(todoItem(page, 'Casual thing')).toBeVisible();
  });
});

/**
 * Contract-level checks. These validation rules are enforced server-side and
 * are awkward to trigger through the form, so they are asserted directly.
 */
test.describe('Todo API contract', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('returns 201 and the created todo', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'Via API', priority: 'high' },
    });

    expect(response.status()).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      todo: { title: 'Via API', priority: 'high', completed: false },
    });
  });

  test('rejects a title longer than 500 characters', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'x'.repeat(501) },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects an unknown priority', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'Bad priority', priority: 'urgent' },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects a due date in the past', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'Backdated', due_date: dueDateInDays(-2) },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects a recurring todo with no pattern', async ({ page }) => {
    const response = await page.request.post('/api/todos', {
      data: { title: 'Recurring', is_recurring: true, due_date: dueDateInDays(1) },
    });

    expect(response.status()).toBe(400);
  });

  test('returns 404 for a todo belonging to nobody', async ({ page }) => {
    const response = await page.request.get('/api/todos/999999');

    expect(response.status()).toBe(404);
  });

  test('returns 400 for a non-numeric id', async ({ page }) => {
    const response = await page.request.get('/api/todos/not-a-number');

    expect(response.status()).toBe(400);
  });

  test('updates only the fields that are sent', async ({ page }) => {
    const created = await page.request.post('/api/todos', {
      data: { title: 'Partial update', priority: 'low' },
    });
    const { todo } = await created.json();

    const updated = await page.request.put(`/api/todos/${todo.id}`, {
      data: { completed: true },
    });

    await expect(updated.json()).resolves.toMatchObject({
      todo: { title: 'Partial update', priority: 'low', completed: true },
    });
  });

  test('deletes and then reports the todo as gone', async ({ page }) => {
    const created = await page.request.post('/api/todos', { data: { title: 'Doomed' } });
    const { todo } = await created.json();

    const deleted = await page.request.delete(`/api/todos/${todo.id}`);
    expect(deleted.ok()).toBe(true);

    const missing = await page.request.get(`/api/todos/${todo.id}`);
    expect(missing.status()).toBe(404);
  });
});
