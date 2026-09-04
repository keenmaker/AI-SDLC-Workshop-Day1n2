import type { BrowserContext, Page } from '@playwright/test';

/**
 * WebAuthn virtual-authenticator support.
 *
 * The app is passkey-only, so every authenticated spec needs a virtual
 * authenticator attached over CDP. The Chromium flags that make this possible
 * (`WebAuthenticationTestingAPI`) are set in playwright.config.ts.
 *
 * Lives alongside tests/helpers.ts rather than inside it: helpers.ts is owned
 * by the subtasks/tags work and merges cleanly only if left alone.
 */

/**
 * Attaches a virtual authenticator to the page and returns its id.
 *
 * The authenticator is bound to the browser context, so credentials created
 * during registration remain usable for a later login in the same test.
 */
export async function addVirtualAuthenticator(page: Page): Promise<string> {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');

  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  return authenticatorId;
}

/** Unique username per test run so repeated runs never collide in todos.db. */
export function uniqueUsername(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

/**
 * Registers a brand new passkey user and waits for the redirect to the
 * todo page. Returns the username so the test can log in again later.
 */
export async function registerUser(page: Page, username = uniqueUsername()): Promise<string> {
  await addVirtualAuthenticator(page);

  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByRole('button', { name: 'Register' }).click();
  await page.waitForURL('/');

  return username;
}

/** Reads the session cookie, or undefined when the user is signed out. */
export async function getSessionCookie(context: BrowserContext) {
  const cookies = await context.cookies();
  return cookies.find((cookie) => cookie.name === 'todo_session');
}

/**
 * A `datetime-local` value offset from now, expressed in Singapore wall clock.
 *
 * Playwright fixes the context timezone to Asia/Singapore, but Node still
 * reports the host zone, so the offset is applied explicitly.
 */
export function dueDateInDays(days: number, hour = 12): string {
  const singapore = new Date(Date.now() + 8 * 60 * 60 * 1000);
  singapore.setUTCDate(singapore.getUTCDate() + days);

  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    `${singapore.getUTCFullYear()}-${pad(singapore.getUTCMonth() + 1)}-` +
    `${pad(singapore.getUTCDate())}T${pad(hour)}:00`
  );
}
