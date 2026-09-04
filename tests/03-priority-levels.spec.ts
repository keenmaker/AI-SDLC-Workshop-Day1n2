import { expect, test } from '@playwright/test';
import { TodoHelpers, dueDateInDays } from './helpers';

/**
 * Feature 02 — Priority levels, badges, sorting and sectioning.
 */
test.describe('Priority levels', () => {
  test.skip(true, 'Requires the WebAuthn login page from feature 11.');

  let helpers: TodoHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TodoHelpers(page);
    await helpers.signIn();
  });

  test('renders a distinct badge for each priority', async () => {
    await helpers.createTodo('High task', { priority: 'high' });
    await helpers.createTodo('Medium task', { priority: 'medium' });
    await helpers.createTodo('Low task', { priority: 'low' });

    await expect(helpers.todoByTitle('High task').getByTestId('priority-badge-high')).toHaveText(
      'High',
    );
    await expect(
      helpers.todoByTitle('Medium task').getByTestId('priority-badge-medium'),
    ).toHaveText('Medium');
    await expect(helpers.todoByTitle('Low task').getByTestId('priority-badge-low')).toHaveText(
      'Low',
    );
  });

  test('sorts pending todos high → medium → low', async () => {
    await helpers.createTodo('Low first', { priority: 'low' });
    await helpers.createTodo('Medium second', { priority: 'medium' });
    await helpers.createTodo('High third', { priority: 'high' });

    expect(await helpers.sectionTitles('pending')).toEqual([
      'High third',
      'Medium second',
      'Low first',
    ]);
  });

  test('breaks priority ties by earliest due date', async () => {
    await helpers.createTodo('Later', { priority: 'high', dueDate: dueDateInDays(5) });
    await helpers.createTodo('Sooner', { priority: 'high', dueDate: dueDateInDays(1) });

    expect(await helpers.sectionTitles('pending')).toEqual(['Sooner', 'Later']);
  });

  test('places todos with a due date ahead of todos without one', async () => {
    await helpers.createTodo('No due date', { priority: 'medium' });
    await helpers.createTodo('Has due date', { priority: 'medium', dueDate: dueDateInDays(2) });

    expect(await helpers.sectionTitles('pending')).toEqual(['Has due date', 'No due date']);
  });

  test('changing priority re-sorts the list', async () => {
    await helpers.createTodo('Promote me', { priority: 'low' });
    await helpers.createTodo('Stay put', { priority: 'medium' });

    expect(await helpers.sectionTitles('pending')).toEqual(['Stay put', 'Promote me']);

    await helpers.editTodo('Promote me', { priority: 'high' });

    expect(await helpers.sectionTitles('pending')).toEqual(['Promote me', 'Stay put']);
  });

  test('filters the list by priority', async ({ page }) => {
    await helpers.createTodo('Urgent thing', { priority: 'high' });
    await helpers.createTodo('Casual thing', { priority: 'low' });

    await page.getByLabel('Filter by priority').selectOption('high');

    await expect(helpers.todoByTitle('Urgent thing')).toBeVisible();
    await expect(helpers.todoByTitle('Casual thing')).toHaveCount(0);

    await page.getByLabel('Filter by priority').selectOption('all');
    await expect(helpers.todoByTitle('Casual thing')).toBeVisible();
  });

  test('a completed past-due todo is not shown as overdue', async () => {
    await helpers.createTodo('Finish soon', { priority: 'high', dueDate: dueDateInDays(1) });
    await helpers.toggleTodo('Finish soon');

    await expect(helpers.section('completed')).toContainText('Finish soon');
    await expect(helpers.section('overdue')).not.toContainText('Finish soon');
  });
});
