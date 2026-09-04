import { expect, type Page } from '@playwright/test';

/**
 * Shared page-object helpers for the E2E suite.
 *
 * Auth is WebAuthn-only, so `signIn` drives a virtual authenticator via CDP.
 * The login UI itself lands in feature 11; until then `signIn` is only used by
 * specs that are skipped.
 */
export class TodoHelpers {
  constructor(private readonly page: Page) {}

  /** Register a fresh passkey user and land on the todo page. */
  async signIn(username = `user-${Date.now()}`): Promise<string> {
    const client = await this.page.context().newCDPSession(this.page);
    await client.send('WebAuthn.enable');
    await client.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    await this.page.goto('/login');
    await this.page.getByLabel('Username').fill(username);
    await this.page.getByRole('button', { name: /register/i }).click();
    await this.page.waitForURL('/');

    return username;
  }

  async createTodo(
    title: string,
    options: { priority?: 'high' | 'medium' | 'low'; dueDate?: string } = {},
  ): Promise<void> {
    await this.page.getByLabel('Todo title').fill(title);

    if (options.priority) {
      await this.page.getByLabel('Priority', { exact: true }).selectOption(options.priority);
    }
    if (options.dueDate) {
      await this.page.getByLabel('Due date', { exact: true }).fill(options.dueDate);
    }

    await this.page.getByRole('button', { name: 'Add' }).click();
    await expect(this.todoByTitle(title)).toBeVisible();
  }

  todoByTitle(title: string) {
    return this.page.getByTestId('todo-item').filter({ hasText: title });
  }

  async toggleTodo(title: string): Promise<void> {
    await this.todoByTitle(title).getByRole('checkbox').click();
  }

  async deleteTodo(title: string): Promise<void> {
    await this.todoByTitle(title).getByRole('button', { name: /^Delete/ }).click();
    await expect(this.todoByTitle(title)).toHaveCount(0);
  }

  async editTodo(
    title: string,
    changes: { title?: string; priority?: 'high' | 'medium' | 'low'; dueDate?: string },
  ): Promise<void> {
    await this.todoByTitle(title).getByRole('button', { name: 'Edit' }).click();

    if (changes.title !== undefined) {
      await this.page.getByLabel('Edit title').fill(changes.title);
    }
    if (changes.priority) {
      await this.page.getByLabel('Edit priority').selectOption(changes.priority);
    }
    if (changes.dueDate !== undefined) {
      await this.page.getByLabel('Edit due date').fill(changes.dueDate);
    }

    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  section(name: 'overdue' | 'pending' | 'completed') {
    return this.page.getByTestId(`section-${name}`);
  }

  /** Titles in a section, in rendered order — used to assert sort ordering. */
  async sectionTitles(name: 'overdue' | 'pending' | 'completed'): Promise<string[]> {
    return this.section(name).getByTestId('todo-title').allInnerTexts();
  }
}

/** `datetime-local` value N days from now, in Singapore wall-clock terms. */
export function dueDateInDays(days: number, hour = 12): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  now.setUTCDate(now.getUTCDate() + days);

  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;

  return `${date}T${pad(hour)}:00`;
}
