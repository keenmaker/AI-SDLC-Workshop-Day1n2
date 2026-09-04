import { expect, test } from '@playwright/test';
import { registerUser } from './webauthn';

/**
 * Step 9 — Subtasks and tags (features 05-06).
 *
 * The subtask and tag UI lives in components that app/page.tsx does not yet
 * mount, so behaviour is verified through the API. Progress percentages come
 * from calculateProgress in lib/db.ts and are surfaced on the parent todo.
 *
 * Note the differing response shapes: todo routes wrap their payload
 * (`{ todo }`, `{ subtask }`), while the tag routes return the tag directly.
 */

interface TodoResponse {
  id: number;
  title: string;
  subtasks?: { id: number; title: string; completed: boolean; position: number }[];
  progress?: number;
  tags?: { id: number; name: string; color: string }[];
}

interface SubtaskResponse {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
}

interface TagResponse {
  id: number;
  name: string;
  color: string;
}

async function createTodo(
  page: import('@playwright/test').Page,
  title: string,
): Promise<TodoResponse> {
  const response = await page.request.post('/api/todos', { data: { title } });
  const { todo } = await response.json();
  return todo;
}

async function addSubtask(
  page: import('@playwright/test').Page,
  todoId: number,
  title: string,
): Promise<SubtaskResponse> {
  const response = await page.request.post(`/api/todos/${todoId}/subtasks`, { data: { title } });
  const { subtask } = await response.json();
  return subtask;
}

test.describe('Subtasks', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('adds a subtask to a todo', async ({ page }) => {
    const todo = await createTodo(page, 'Plan trip');

    const response = await page.request.post(`/api/todos/${todo.id}/subtasks`, {
      data: { title: 'Book flights' },
    });

    expect(response.status()).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      subtask: { title: 'Book flights', completed: false, todo_id: todo.id },
    });
  });

  test('rejects an empty subtask title', async ({ page }) => {
    const todo = await createTodo(page, 'Plan trip');

    const response = await page.request.post(`/api/todos/${todo.id}/subtasks`, {
      data: { title: '   ' },
    });

    expect(response.status()).toBe(400);
  });

  test('returns 404 when adding a subtask to a missing todo', async ({ page }) => {
    const response = await page.request.post('/api/todos/999999/subtasks', {
      data: { title: 'Orphan' },
    });

    expect(response.status()).toBe(404);
  });

  test('keeps subtasks in insertion order', async ({ page }) => {
    const todo = await createTodo(page, 'Ordered work');
    await addSubtask(page, todo.id, 'First');
    await addSubtask(page, todo.id, 'Second');
    await addSubtask(page, todo.id, 'Third');

    const response = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: fetched }: { todo: TodoResponse } = await response.json();

    expect((fetched.subtasks ?? []).map((subtask) => subtask.title)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  test('reports zero progress when no subtask is done', async ({ page }) => {
    const todo = await createTodo(page, 'Nothing done');
    await addSubtask(page, todo.id, 'Step one');
    await addSubtask(page, todo.id, 'Step two');

    const response = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: fetched }: { todo: TodoResponse } = await response.json();

    expect(fetched.progress).toBe(0);
  });

  test('reports 50 percent when half the subtasks are done', async ({ page }) => {
    const todo = await createTodo(page, 'Half done');
    const first = await addSubtask(page, todo.id, 'Step one');
    await addSubtask(page, todo.id, 'Step two');

    await page.request.put(`/api/subtasks/${first.id}`, { data: { completed: true } });

    const response = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: fetched }: { todo: TodoResponse } = await response.json();

    expect(fetched.progress).toBe(50);
  });

  test('reports 100 percent when every subtask is done', async ({ page }) => {
    const todo = await createTodo(page, 'All done');
    const first = await addSubtask(page, todo.id, 'Step one');
    const second = await addSubtask(page, todo.id, 'Step two');

    await page.request.put(`/api/subtasks/${first.id}`, { data: { completed: true } });
    await page.request.put(`/api/subtasks/${second.id}`, { data: { completed: true } });

    const response = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: fetched }: { todo: TodoResponse } = await response.json();

    expect(fetched.progress).toBe(100);
  });

  test('rounds progress for counts that do not divide evenly', async ({ page }) => {
    const todo = await createTodo(page, 'Three steps');
    const first = await addSubtask(page, todo.id, 'One');
    await addSubtask(page, todo.id, 'Two');
    await addSubtask(page, todo.id, 'Three');

    await page.request.put(`/api/subtasks/${first.id}`, { data: { completed: true } });

    const response = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: fetched }: { todo: TodoResponse } = await response.json();

    expect(fetched.progress).toBe(33);
  });

  test('un-completing a subtask lowers the progress again', async ({ page }) => {
    const todo = await createTodo(page, 'Toggle back');
    const subtask = await addSubtask(page, todo.id, 'Only step');

    await page.request.put(`/api/subtasks/${subtask.id}`, { data: { completed: true } });
    await page.request.put(`/api/subtasks/${subtask.id}`, { data: { completed: false } });

    const response = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: fetched }: { todo: TodoResponse } = await response.json();

    expect(fetched.progress).toBe(0);
  });

  test('renames a subtask', async ({ page }) => {
    const todo = await createTodo(page, 'Rename parent');
    const subtask = await addSubtask(page, todo.id, 'Old name');

    const response = await page.request.put(`/api/subtasks/${subtask.id}`, {
      data: { title: 'New name' },
    });

    await expect(response.json()).resolves.toMatchObject({ title: 'New name' });
  });

  test('deletes a subtask', async ({ page }) => {
    const todo = await createTodo(page, 'Delete a step');
    const subtask = await addSubtask(page, todo.id, 'Doomed step');

    const response = await page.request.delete(`/api/subtasks/${subtask.id}`);
    expect(response.ok()).toBe(true);

    const fetched = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: after }: { todo: TodoResponse } = await fetched.json();
    expect(after.subtasks ?? []).toHaveLength(0);
  });

  test('deleting the parent todo removes its subtasks', async ({ page }) => {
    const todo = await createTodo(page, 'Cascade parent');
    const subtask = await addSubtask(page, todo.id, 'Cascade child');

    await page.request.delete(`/api/todos/${todo.id}`);

    const response = await page.request.put(`/api/subtasks/${subtask.id}`, {
      data: { completed: true },
    });
    expect(response.status()).toBe(404);
  });

  test("refuses to touch another user's subtask", async ({ page, browser }) => {
    const todo = await createTodo(page, 'Private parent');
    const subtask = await addSubtask(page, todo.id, 'Private step');

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await registerUser(otherPage);

    const response = await otherPage.request.put(`/api/subtasks/${subtask.id}`, {
      data: { completed: true },
    });
    expect(response.status()).toBe(404);

    await otherContext.close();
  });
});

test.describe('Tags', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page);
  });

  test('creates a tag with an explicit colour', async ({ page }) => {
    const response = await page.request.post('/api/tags', {
      data: { name: 'Work', color: '#3B82F6' },
    });

    expect(response.status()).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ name: 'Work', color: '#3B82F6' });
  });

  test('applies a default colour when none is given', async ({ page }) => {
    const response = await page.request.post('/api/tags', { data: { name: 'Personal' } });
    const tag: TagResponse = await response.json();

    expect(tag.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test('rejects an empty tag name', async ({ page }) => {
    const response = await page.request.post('/api/tags', { data: { name: '   ' } });

    expect(response.status()).toBe(400);
  });

  test('rejects a malformed hex colour', async ({ page }) => {
    const response = await page.request.post('/api/tags', {
      data: { name: 'Bad colour', color: 'not-a-colour' },
    });

    expect(response.status()).toBe(400);
  });

  test('rejects a duplicate tag name regardless of case', async ({ page }) => {
    await page.request.post('/api/tags', { data: { name: 'Urgent' } });

    const response = await page.request.post('/api/tags', { data: { name: 'urgent' } });

    expect(response.status()).toBe(409);
  });

  test('lists the tags belonging to the user', async ({ page }) => {
    await page.request.post('/api/tags', { data: { name: 'Alpha' } });
    await page.request.post('/api/tags', { data: { name: 'Beta' } });

    const response = await page.request.get('/api/tags');
    const tags: TagResponse[] = await response.json();

    expect(tags.map((tag) => tag.name)).toEqual(expect.arrayContaining(['Alpha', 'Beta']));
  });

  test('attaches a tag to a todo', async ({ page }) => {
    const todo = await createTodo(page, 'Tagged todo');
    const tagResponse = await page.request.post('/api/tags', { data: { name: 'Home' } });
    const tag: TagResponse = await tagResponse.json();

    const response = await page.request.post(`/api/todos/${todo.id}/tags`, {
      data: { tagId: tag.id },
    });
    expect(response.ok()).toBe(true);

    const fetched = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: after }: { todo: TodoResponse } = await fetched.json();
    expect((after.tags ?? []).map((item) => item.name)).toContain('Home');
  });

  test('detaches a tag from a todo without deleting the tag', async ({ page }) => {
    const todo = await createTodo(page, 'Detach me');
    const tagResponse = await page.request.post('/api/tags', { data: { name: 'Temporary' } });
    const tag: TagResponse = await tagResponse.json();

    await page.request.post(`/api/todos/${todo.id}/tags`, { data: { tagId: tag.id } });
    const response = await page.request.delete(`/api/todos/${todo.id}/tags`, {
      data: { tagId: tag.id },
    });
    expect(response.ok()).toBe(true);

    const fetched = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: after }: { todo: TodoResponse } = await fetched.json();
    expect(after.tags ?? []).toHaveLength(0);

    // The tag itself survives detachment.
    const tags: TagResponse[] = await (await page.request.get('/api/tags')).json();
    expect(tags.map((item) => item.name)).toContain('Temporary');
  });

  test('attaches several tags to one todo', async ({ page }) => {
    const todo = await createTodo(page, 'Many tags');

    for (const name of ['One', 'Two', 'Three']) {
      const created = await page.request.post('/api/tags', { data: { name } });
      const tag: TagResponse = await created.json();
      await page.request.post(`/api/todos/${todo.id}/tags`, { data: { tagId: tag.id } });
    }

    const fetched = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: after }: { todo: TodoResponse } = await fetched.json();
    expect(after.tags ?? []).toHaveLength(3);
  });

  test('requires a tag id when attaching', async ({ page }) => {
    const todo = await createTodo(page, 'Missing tag id');

    const response = await page.request.post(`/api/todos/${todo.id}/tags`, { data: {} });

    expect(response.status()).toBe(400);
  });

  test('returns 404 when attaching a tag that does not exist', async ({ page }) => {
    const todo = await createTodo(page, 'Ghost tag');

    const response = await page.request.post(`/api/todos/${todo.id}/tags`, {
      data: { tagId: 999999 },
    });

    expect(response.status()).toBe(404);
  });

  test('renames a tag', async ({ page }) => {
    const created = await page.request.post('/api/tags', { data: { name: 'Before' } });
    const tag: TagResponse = await created.json();

    const response = await page.request.put(`/api/tags/${tag.id}`, { data: { name: 'After' } });

    await expect(response.json()).resolves.toMatchObject({ name: 'After' });
  });

  test('deleting a tag removes it from its todos', async ({ page }) => {
    const todo = await createTodo(page, 'Loses a tag');
    const created = await page.request.post('/api/tags', { data: { name: 'Doomed' } });
    const tag: TagResponse = await created.json();
    await page.request.post(`/api/todos/${todo.id}/tags`, { data: { tagId: tag.id } });

    await page.request.delete(`/api/tags/${tag.id}`);

    const fetched = await page.request.get(`/api/todos/${todo.id}`);
    const { todo: after }: { todo: TodoResponse } = await fetched.json();
    expect(after.tags ?? []).toHaveLength(0);
  });

  test("does not expose another user's tags", async ({ page, browser }) => {
    await page.request.post('/api/tags', { data: { name: 'Confidential' } });

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await registerUser(otherPage);

    const tags: TagResponse[] = await (await otherPage.request.get('/api/tags')).json();
    expect(tags.map((tag) => tag.name)).not.toContain('Confidential');

    await otherContext.close();
  });
});
