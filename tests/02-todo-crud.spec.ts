import { expect, test } from '@playwright/test';
import { TodoHelpers, dueDateInDays } from './helpers';

/**
 * Feature 01 — Todo CRUD operations.
 *
 * Requires a signed-in session, which depends on the WebAuthn login UI
 * (feature 11). The suite is skipped until that lands.
 */
test.describe('Todo CRUD', () => {
  test.skip(true, 'Requires the WebAuthn login page from feature 11.');

  let helpers: TodoHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoHelpers(page);
    await helpers.signIn();
  });

  test('creates a todo with the default priority', async ({ page }) => {
    await helpers.createTodo('Write the report');

    await expect(helpers.todoByTitle('Write the report')).toBeVisible();
    await expect(page.getByTestId('section-pending')).toContainText('Write the report');
  });

  test('rejects an empty title', async ({ page }) => {
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByRole('alert')).toContainText('Title is required');
    await expect(page.getByTestId('todo-item')).toHaveCount(0);
  });

  test('rejects a title over 200 characters', async ({ page }) => {
    await page.getByLabel('Todo title').fill('x'.repeat(201));
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('creates a todo with a due date and priority', async () => {
    await helpers.createTodo('Ship release', {
      priority: 'high',
      dueDate: dueDateInDays(3),
    });

    const todo = helpers.todoByTitle('Ship release');
    await expect(todo.getByTestId('priority-badge-high')).toBeVisible();
  });

  test('edits a todo title and priority', async () => {
    await helpers.createTodo('Draft agenda', { priority: 'low' });
    await helpers.editTodo('Draft agenda', { title: 'Final agenda', priority: 'high' });

    await expect(helpers.todoByTitle('Final agenda')).toBeVisible();
    await expect(helpers.todoByTitle('Draft agenda')).toHaveCount(0);
    await expect(
      helpers.todoByTitle('Final agenda').getByTestId('priority-badge-high'),
    ).toBeVisible();
  });

  test('toggles completion and moves the todo to Completed', async () => {
    await helpers.createTodo('Buy milk');
    await helpers.toggleTodo('Buy milk');

    await expect(helpers.section('completed')).toContainText('Buy milk');
    await expect(helpers.section('pending')).not.toContainText('Buy milk');
  });

  test('un-completes a todo back into Pending', async () => {
    await helpers.createTodo('Call bank');
    await helpers.toggleTodo('Call bank');
    await expect(helpers.section('completed')).toContainText('Call bank');

    await helpers.toggleTodo('Call bank');
    await expect(helpers.section('pending')).toContainText('Call bank');
  });

  test('deletes a todo immediately without confirmation', async () => {
    await helpers.createTodo('Temporary task');
    await helpers.deleteTodo('Temporary task');
  });

  test('persists todos across a page reload', async ({ page }) => {
    await helpers.createTodo('Persistent task');
    await page.reload();

    await expect(helpers.todoByTitle('Persistent task')).toBeVisible();
  });
});
