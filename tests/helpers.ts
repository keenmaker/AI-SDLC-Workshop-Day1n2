import { Page } from '@playwright/test';
import type { Subtask, Tag } from '@/lib/db';

/**
 * Test helper class for common todo app operations.
 */
export class TodoAppHelper {
  constructor(private page: Page) {}

  /**
   * Navigate to the home page
   */
  async goto() {
    await this.page.goto('/');
  }

  /**
   * Create a new todo with the given title.
   * Assumes there is an "Add todo" input and button on the page.
   */
  async createTodo(title: string) {
    // Find the input field and add button
    const input = this.page.locator('input[placeholder*="Add"]').first();
    const addButton = this.page.locator('button:has-text("Add")').first();

    // Type and submit
    await input.fill(title);
    await addButton.click();

    // Wait for the todo to appear
    await this.page.locator(`text=${title}`).waitFor({ state: 'visible' });
  }

  /**
   * Expand the subtasks section for a specific todo.
   * Looks for the "▶ Subtasks" button and clicks it.
   */
  async expandSubtasks(todoTitle: string) {
    // Find the todo row containing the title
    const todoRow = this.page.locator(`div:has-text("${todoTitle}")`).first();

    // Find and click the subtasks toggle button within this row
    const toggleButton = todoRow.locator('button:has-text("Subtasks")').first();
    await toggleButton.click();

    // Wait for the subtask input to appear
    await this.page
      .locator('input[placeholder*="subtask"]')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Add a subtask with the given title to a todo.
   * The subtasks section should already be expanded.
   * Returns the created subtask data (or resolves to indicate success).
   */
  async addSubtask(todoId: number, title: string): Promise<Subtask | null> {
    // Find the subtask input field
    const input = this.page.locator('input[placeholder*="subtask"]').first();

    // Type the subtask title
    await input.fill(title);

    // Press Enter to add (or click the Add button)
    await input.press('Enter');

    // Wait for the subtask to appear in the list
    await this.page.locator(`text=${title}`).waitFor({ state: 'visible', timeout: 5000 });

    // Return null as we don't have direct access to the created object
    // In a real scenario, you'd fetch it from the API or return the DOM state
    return null;
  }

  /**
   * Add a subtask via the "Add" button instead of Enter key.
   */
  async addSubtaskViaButton(todoId: number, title: string): Promise<Subtask | null> {
    const input = this.page.locator('input[placeholder*="subtask"]').first();
    const addButton = this.page.locator('button:has-text("Add")').first();

    await input.fill(title);
    await addButton.click();

    // Wait for the subtask to appear
    await this.page.locator(`text=${title}`).waitFor({ state: 'visible', timeout: 5000 });

    return null;
  }

  /**
   * Toggle a subtask completion state by clicking its checkbox.
   */
  async toggleSubtask(subtaskTitle: string) {
    // Find the checkbox for this subtask
    const row = this.page.locator(`div:has-text("${subtaskTitle}")`).first();
    const checkbox = row.locator('input[type="checkbox"]').first();

    await checkbox.click();

    // Wait for any state update (progress bar color change, etc.)
    await this.page.waitForTimeout(300);
  }

  /**
   * Delete a subtask by clicking the ✕ button.
   */
  async deleteSubtask(subtaskTitle: string) {
    const row = this.page.locator(`div:has-text("${subtaskTitle}")`).first();
    const deleteButton = row.locator('button:has-text("✕")').first();

    await deleteButton.click();

    // Wait for the subtask to be removed
    await this.page.locator(`text=${subtaskTitle}`).waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Collapse the subtasks section for a todo.
   */
  async collapseSubtasks(todoTitle: string) {
    const todoRow = this.page.locator(`div:has-text("${todoTitle}")`).first();
    const toggleButton = todoRow.locator('button:has-text("Subtasks")').first();

    await toggleButton.click();

    // Wait for the input to disappear
    await this.page
      .locator('input[placeholder*="subtask"]')
      .first()
      .waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Check the progress bar color by inspecting the background color.
   * Returns 'blue' or 'green' based on the bar's color class.
   */
  async getProgressBarColor(todoTitle: string): Promise<string | null> {
    const todoRow = this.page.locator(`div:has-text("${todoTitle}")`).first();
    const progressBar = todoRow.locator('div.bg-blue-500, div.bg-green-500').first();

    if (!(await progressBar.isVisible())) {
      return null;
    }

    const classList = await progressBar.evaluate((el) => el.className);
    return classList.includes('bg-green-500') ? 'green' : 'blue';
  }

  /**
   * Get the progress percentage text from the progress bar.
   */
  async getProgressPercentage(todoTitle: string): Promise<number | null> {
    const todoRow = this.page.locator(`div:has-text("${todoTitle}")`).first();
    const percentText = todoRow.locator('text=/\\d+%/').first();

    if (!(await percentText.isVisible())) {
      return null;
    }

    const text = await percentText.textContent();
    const match = text?.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Get the subtask count text (e.g., "3/7 subtasks").
   */
  async getSubtaskCount(todoTitle: string): Promise<{ completed: number; total: number } | null> {
    const todoRow = this.page.locator(`div:has-text("${todoTitle}")`).first();
    const countText = todoRow.locator('text=/\\d+\\/\\d+ subtasks/').first();

    if (!(await countText.isVisible())) {
      return null;
    }

    const text = await countText.textContent();
    const match = text?.match(/(\d+)\/(\d+) subtasks/);
    return match ? { completed: parseInt(match[1], 10), total: parseInt(match[2], 10) } : null;
  }

  /**
   * Delete a todo by clicking its delete button.
   */
  async deleteTodo(todoTitle: string) {
    const todoRow = this.page.locator(`div:has-text("${todoTitle}")`).first();
    const deleteButton = todoRow.locator('button:has-text("✕")').first();

    await deleteButton.click();

    // Wait for the todo to be removed
    await this.page.locator(`text=${todoTitle}`).waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Check if a subtask is visible on the page.
   */
  async isSubtaskVisible(subtaskTitle: string): Promise<boolean> {
    return this.page.locator(`text=${subtaskTitle}`).isVisible();
  }

  /**
   * Check if the progress bar is visible for a todo.
   */
  async isProgressBarVisible(todoTitle: string): Promise<boolean> {
    const todoRow = this.page.locator(`div:has-text("${todoTitle}")`).first();
    const progressBar = todoRow.locator('div.bg-blue-500, div.bg-green-500, div.h-2').first();

    return progressBar.isVisible();
  }

  // =========================================================================
  // Tag Management Helpers
  // =========================================================================

  /**
   * Open the Manage Tags modal by clicking the "+ Manage Tags" button.
   */
  async openManageTagsModal() {
    const button = this.page.locator('button:has-text("Manage Tags")');
    await button.click();

    // Wait for modal to appear
    await this.page.locator('text=Create New Tag').waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Close the Manage Tags modal by clicking the close button.
   */
  async closeManageTagsModal() {
    // Find the close button (✕) within the modal
    const modalCloseButton = this.page.locator('button:has-text("✕")').first();
    await modalCloseButton.click();

    // Wait for modal to disappear
    await this.page.locator('text=Create New Tag').waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Create a tag via the modal form.
   */
  async createTag(name: string, color?: string): Promise<Tag | null> {
    // Ensure modal is open
    const isModalOpen = await this.page.locator('text=Create New Tag').isVisible();
    if (!isModalOpen) {
      await this.openManageTagsModal();
    }

    // Fill tag name
    const nameInput = this.page.locator('input[placeholder="Enter tag name..."]');
    await nameInput.fill(name);

    // Set color if provided
    if (color) {
      const colorInput = this.page.locator('input[type="color"]').first();
      await colorInput.fill(color);
    }

    // Click Create Tag button
    const createButton = this.page.locator('button:has-text("Create Tag")');
    await createButton.click();

    // Wait for tag to appear in the list
    const tagElement = this.page.locator(`div:has-text("${name}")`).first();
    await tagElement.waitFor({ state: 'visible', timeout: 5000 });

    // Return null as we don't have direct access to the created object
    return null;
  }

  /**
   * Edit a tag's name and/or color via the modal.
   */
  async editTag(tagName: string, newName?: string, newColor?: string) {
    // Find the tag row and click Edit button
    const tagRow = this.page.locator(`div:has-text("${tagName}")`).first();
    const editButton = tagRow.locator('button:has-text("Edit")');
    await editButton.click();

    // Wait for edit form to appear
    await this.page.locator('button:has-text("Save")').waitFor({ state: 'visible', timeout: 5000 });

    // Update name if provided
    if (newName) {
      const nameInput = this.page.locator('input[type="text"]').last();
      await nameInput.fill(newName);
    }

    // Update color if provided
    if (newColor) {
      const colorInput = this.page.locator('input[type="color"]').last();
      await colorInput.fill(newColor);
    }

    // Click Save button
    const saveButton = this.page.locator('button:has-text("Save")');
    await saveButton.click();

    // Wait for form to disappear
    await this.page.locator('button:has-text("Save")').waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Delete a tag via the modal.
   */
  async deleteTag(tagName: string) {
    // Find the tag row and click Delete button
    const tagRow = this.page.locator(`div:has-text("${tagName}")`).first();
    const deleteButton = tagRow.locator('button:has-text("Delete")');
    await deleteButton.click();

    // Confirm deletion if prompted
    await this.page.once('dialog', (dialog) => {
      if (dialog.message().includes('Delete')) {
        dialog.accept();
      }
    });

    // Wait for tag to disappear
    await this.page.locator(`text=${tagName}`).waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Select a tag for a todo by clicking on a tag pill.
   */
  async selectTagForTodo(tagName: string) {
    // Find tag pill and click it
    const tagPill = this.page.locator(`button:has-text("${tagName}")`, { hasText: tagName });
    await tagPill.click();

    // Wait for selection to take effect
    await this.page.waitForTimeout(300);
  }

  /**
   * Get all visible tags on the page.
   */
  async getVisibleTags(): Promise<string[]> {
    const tags = await this.page.locator('div:has(> button[title])').all();
    const tagNames: string[] = [];

    for (const tag of tags) {
      const text = await tag.textContent();
      if (text) {
        tagNames.push(text.trim());
      }
    }

    return tagNames;
  }

  /**
   * Check if a tag is visible on the page.
   */
  async isTagVisible(tagName: string): Promise<boolean> {
    return this.page.locator(`button:has-text("${tagName}")`).isVisible();
  }

/**
 * Export a helper function for easier test setup.
 */
export async function createTodoAppHelper(page: Page): Promise<TodoAppHelper> {
  return new TodoAppHelper(page);
}
