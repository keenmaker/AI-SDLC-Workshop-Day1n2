import { expect, test } from '@playwright/test';
import {
  addVirtualAuthenticator,
  getSessionCookie,
  registerUser,
  uniqueUsername,
} from './webauthn';

/**
 * Step 9 — Authentication (feature 11).
 *
 * Covers passkey signup, login, session cookie properties, and route
 * protection. Auth is WebAuthn-only, so each test attaches a virtual
 * authenticator over CDP before touching the login form.
 */
test.describe('Authentication', () => {
  test('registers a new user with a passkey and lands on the todo page', async ({ page }) => {
    const username = uniqueUsername();
    await addVirtualAuthenticator(page);

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Todo App' })).toBeVisible();

    await page.getByLabel('Username').fill(username);
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page).toHaveURL('/');
  });

  test('disables both actions until a username is entered', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('button', { name: 'Register' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Login' })).toBeDisabled();

    await page.getByLabel('Username').fill('someone');

    await expect(page.getByRole('button', { name: 'Register' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Login' })).toBeEnabled();
  });

  test('rejects a duplicate username', async ({ page }) => {
    const username = await registerUser(page);

    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Username').fill(username);
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('rejects login for an unknown username', async ({ page }) => {
    await addVirtualAuthenticator(page);

    await page.goto('/login');
    await page.getByLabel('Username').fill(uniqueUsername('ghost'));
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs back in with the existing passkey after signing out', async ({ page, context }) => {
    const username = await registerUser(page);

    await page.request.post('/api/auth/logout');
    await page.goto('/login');

    await page.getByLabel('Username').fill(username);
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL('/');
    expect(await getSessionCookie(context)).toBeDefined();
  });

  test('issues an HTTP-only session cookie scoped to the site', async ({ page, context }) => {
    await registerUser(page);

    const cookie = await getSessionCookie(context);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.path).toBe('/');
    expect(cookie?.sameSite).toBe('Lax');
    // Value is a signed JWT, never the raw username.
    expect(cookie?.value.split('.')).toHaveLength(3);
  });

  test('reports the signed-in user from /api/auth/me', async ({ page }) => {
    const username = await registerUser(page);

    const response = await page.request.get('/api/auth/me');
    expect(response.ok()).toBe(true);
    await expect(response.json()).resolves.toMatchObject({ username });
  });

  test('redirects anonymous visitors from / to the login page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();
  });

  test('preserves the intended destination through the login redirect', async ({ page }) => {
    await page.goto('/calendar');

    await expect(page).toHaveURL(/\/login\?next=%2Fcalendar/);
  });

  test('redirects a signed-in user away from the login page', async ({ page }) => {
    await registerUser(page);

    await page.goto('/login');

    await expect(page).toHaveURL('/');
  });

  test('rejects API access without a session', async ({ page }) => {
    const response = await page.request.get('/api/todos');

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'Not authenticated' });
  });

  test('rejects API access when the session cookie is tampered with', async ({ page, context }) => {
    await registerUser(page);
    const cookie = await getSessionCookie(context);

    await context.clearCookies();
    await context.addCookies([
      { ...cookie!, value: `${cookie!.value}tampered` },
    ]);

    const response = await page.request.get('/api/todos');
    expect(response.status()).toBe(401);
  });

  test('clears the session on logout and blocks the protected route again', async ({
    page,
    context,
  }) => {
    await registerUser(page);

    const response = await page.request.post('/api/auth/logout');
    expect(response.ok()).toBe(true);

    const cookie = await getSessionCookie(context);
    expect(cookie?.value ?? '').toBe('');

    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('keeps two users isolated from each other', async ({ browser }) => {
    const firstContext = await browser.newContext();
    const firstPage = await firstContext.newPage();
    await registerUser(firstPage);
    await firstPage.request.post('/api/todos', {
      data: { title: 'Only mine', priority: 'high' },
    });

    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await registerUser(secondPage);

    const response = await secondPage.request.get('/api/todos');
    const body: { todos: { title: string }[] } = await response.json();
    expect(body.todos.map((todo) => todo.title)).not.toContain('Only mine');

    await firstContext.close();
    await secondContext.close();
  });
});
