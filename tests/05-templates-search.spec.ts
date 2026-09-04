import { expect, test, type Page } from '@playwright/test';
import { dueDateInDays, registerUser } from './webauthn';

/**
 * Step 9 — Templates and filtering (features 07-08).
 *
 * Templates are exercised through the API: creation, subtask JSON expansion,
 * and due-date offset calculation in Singapore time. Filtering is covered
 * through the priority control on app/page.tsx.
 *
 * Gap worth noting: lib/filters.ts implements search, tag, completion and
 * date-range filtering plus localStorage presets, but app/page.tsx does not
 * mount that UI yet. Those paths are asserted at the data level here and need
 * UI-level tests once the controls are wired up.
 */

interface TemplateResponse {
  id: number;
  name: string;
  title_template: string;
  priority: string;
  subtasks_json: string | null;
  due_date_offset_minutes: number | null;
}

interface TodoResponse {
  id: number;
  title: string;
  priority: string;
  due_date: string | null;
  completed: boolean;
  subtasks?: { title: string; position: number }[];
}

async function createTodo(
  page: Page,
  title: string,
  options: { priority?: string; dueDate?: string } = {},
) {
  await page.getByLabel('Todo title').fill(title);
  if (options.priority) {
    await page.getByLabel('Priority', { exact: true }).selectOption(options.priority);
  }
  if (options.dueDate) {
    await page.getByLabel('Due date', { exact: true }).fill(options.dueDate);
  }
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByTestId('todo-item').filter({ hasText: title })).toBeVisible();
}

test.describe('Templates', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('creates a template', async ({ page }) => {
    const response = await page.request.post('/api/templates', {
      data: { name: 'Standup', title_template: 'Daily standup', priority: 'medium' },
    });

    expect(response.status()).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      name: 'Standup',
      title_template: 'Daily standup',
    });
  });

  test('rejects a template with no name', async ({ page }) => {
    const response = await page.request.post('/api/templates', {
      data: { title_template: 'Nameless' },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects a recurring template with no offset or pattern', async ({ page }) => {
    const response = await page.request.post('/api/templates', {
      data: { name: 'Broken', title_template: 'Broken', is_recurring: true },
    });

    expect(response.status()).toBe(400);
  });

  test('lists the templates belonging to the user', async ({ page }) => {
    await page.request.post('/api/templates', {
      data: { name: 'Alpha template', title_template: 'Alpha' },
    });
    await page.request.post('/api/templates', {
      data: { name: 'Beta template', title_template: 'Beta' },
    });

    const templates: TemplateResponse[] = await (await page.request.get('/api/templates')).json();

    expect(templates.map((template) => template.name)).toEqual(
      expect.arrayContaining(['Alpha template', 'Beta template']),
    );
  });

  test('stores template subtasks as JSON with normalised positions', async ({ page }) => {
    const response = await page.request.post('/api/templates', {
      data: {
        name: 'Release checklist',
        title_template: 'Cut a release',
        subtasks: [{ title: 'Tag the commit' }, { title: 'Publish notes' }],
      },
    });
    const template: TemplateResponse = await response.json();

    const parsed = JSON.parse(template.subtasks_json ?? '[]');
    expect(parsed).toEqual([
      { title: 'Tag the commit', position: 0 },
      { title: 'Publish notes', position: 1 },
    ]);
  });

  test('creates a todo from a template', async ({ page }) => {
    const created = await page.request.post('/api/templates', {
      data: { name: 'Weekly report', title_template: 'Write weekly report', priority: 'high' },
    });
    const template: TemplateResponse = await created.json();

    const response = await page.request.post(`/api/templates/${template.id}/use`);

    expect(response.status()).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      title: 'Write weekly report',
      priority: 'high',
      completed: false,
    });
  });

  test('expands template subtasks onto the created todo', async ({ page }) => {
    const created = await page.request.post('/api/templates', {
      data: {
        name: 'Onboarding',
        title_template: 'Onboard a hire',
        subtasks: [{ title: 'Create account' }, { title: 'Send welcome pack' }],
      },
    });
    const template: TemplateResponse = await created.json();

    const response = await page.request.post(`/api/templates/${template.id}/use`);
    const todo: TodoResponse = await response.json();

    expect((todo.subtasks ?? []).map((subtask) => subtask.title)).toEqual([
      'Create account',
      'Send welcome pack',
    ]);
  });

  test('leaves the due date empty when the template has no offset', async ({ page }) => {
    const created = await page.request.post('/api/templates', {
      data: { name: 'No offset', title_template: 'Someday task' },
    });
    const template: TemplateResponse = await created.json();

    const todo: TodoResponse = await (
      await page.request.post(`/api/templates/${template.id}/use`)
    ).json();

    expect(todo.due_date).toBeNull();
  });

  test('derives a Singapore due date from the offset', async ({ page }) => {
    const created = await page.request.post('/api/templates', {
      data: {
        name: 'Tomorrow task',
        title_template: 'Due in a day',
        due_date_offset_minutes: 1440,
      },
    });
    const template: TemplateResponse = await created.json();

    const todo: TodoResponse = await (
      await page.request.post(`/api/templates/${template.id}/use`)
    ).json();

    expect(todo.due_date).not.toBeNull();
    // Storage format always carries the Singapore offset.
    expect(todo.due_date).toContain('+08:00');
  });

  test('using a template twice creates two independent todos', async ({ page }) => {
    const created = await page.request.post('/api/templates', {
      data: { name: 'Repeatable', title_template: 'Repeatable task' },
    });
    const template: TemplateResponse = await created.json();

    const first: TodoResponse = await (
      await page.request.post(`/api/templates/${template.id}/use`)
    ).json();
    const second: TodoResponse = await (
      await page.request.post(`/api/templates/${template.id}/use`)
    ).json();

    expect(first.id).not.toBe(second.id);
  });

  test('returns 404 for a template that does not exist', async ({ page }) => {
    const response = await page.request.post('/api/templates/999999/use');

    expect(response.status()).toBe(404);
  });

  test('deletes a template', async ({ page }) => {
    const created = await page.request.post('/api/templates', {
      data: { name: 'Disposable', title_template: 'Disposable' },
    });
    const template: TemplateResponse = await created.json();

    const response = await page.request.delete(`/api/templates/${template.id}`);
    expect(response.ok()).toBe(true);

    const after = await page.request.post(`/api/templates/${template.id}/use`);
    expect(after.status()).toBe(404);
  });

  test("does not expose another user's templates", async ({ page, browser }) => {
    await page.request.post('/api/templates', {
      data: { name: 'Private template', title_template: 'Private' },
    });

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await registerUser(otherPage);

    const templates: TemplateResponse[] = await (
      await otherPage.request.get('/api/templates')
    ).json();
    expect(templates.map((template) => template.name)).not.toContain('Private template');

    await otherContext.close();
  });

  test('requires authentication to list templates', async ({ page, context }) => {
    await context.clearCookies();

    const response = await page.request.get('/api/templates');
    expect(response.status()).toBe(401);
  });
});

test.describe('Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('shows every todo when the filter is set to all', async ({ page }) => {
    await createTodo(page, 'High item', { priority: 'high' });
    await createTodo(page, 'Low item', { priority: 'low' });

    await page.getByLabel('Filter by priority').selectOption('all');

    await expect(page.getByTestId('todo-item')).toHaveCount(2);
  });

  test('narrows the list to a single priority', async ({ page }) => {
    await createTodo(page, 'High item', { priority: 'high' });
    await createTodo(page, 'Medium item', { priority: 'medium' });
    await createTodo(page, 'Low item', { priority: 'low' });

    await page.getByLabel('Filter by priority').selectOption('medium');

    await expect(page.getByTestId('todo-item')).toHaveCount(1);
    await expect(page.getByTestId('todo-item')).toContainText('Medium item');
  });

  test('shows an empty state when nothing matches the filter', async ({ page }) => {
    await createTodo(page, 'Only low', { priority: 'low' });

    await page.getByLabel('Filter by priority').selectOption('high');

    await expect(page.getByTestId('todo-item')).toHaveCount(0);
    await expect(page.getByTestId('section-pending')).toContainText('Nothing here.');
  });

  test('restores the full list when the filter is cleared', async ({ page }) => {
    await createTodo(page, 'High item', { priority: 'high' });
    await createTodo(page, 'Low item', { priority: 'low' });

    await page.getByLabel('Filter by priority').selectOption('high');
    await expect(page.getByTestId('todo-item')).toHaveCount(1);

    await page.getByLabel('Filter by priority').selectOption('all');
    await expect(page.getByTestId('todo-item')).toHaveCount(2);
  });

  test('applies the filter across sections', async ({ page }) => {
    await createTodo(page, 'Active high', { priority: 'high' });
    await createTodo(page, 'Done high', { priority: 'high' });
    await createTodo(page, 'Active low', { priority: 'low' });

    await page.getByTestId('todo-item').filter({ hasText: 'Done high' }).getByRole('checkbox').check();
    await expect(page.getByTestId('section-completed')).toContainText('Done high');

    await page.getByLabel('Filter by priority').selectOption('high');

    await expect(page.getByTestId('section-pending')).toContainText('Active high');
    await expect(page.getByTestId('section-completed')).toContainText('Done high');
    await expect(page.getByTestId('section-pending')).not.toContainText('Active low');
  });

  test('keeps filtering correct after a new todo is added', async ({ page }) => {
    await createTodo(page, 'Existing high', { priority: 'high' });
    await page.getByLabel('Filter by priority').selectOption('high');

    await createTodo(page, 'Fresh high', { priority: 'high' });

    await expect(page.getByTestId('todo-item')).toHaveCount(2);
  });

  test('filters correctly alongside due dates', async ({ page }) => {
    await createTodo(page, 'Due soon high', { priority: 'high', dueDate: dueDateInDays(1) });
    await createTodo(page, 'Due later low', { priority: 'low', dueDate: dueDateInDays(9) });

    await page.getByLabel('Filter by priority').selectOption('high');

    await expect(page.getByTestId('todo-item')).toHaveCount(1);
    await expect(page.getByTestId('todo-item')).toContainText('Due soon high');
  });
});
