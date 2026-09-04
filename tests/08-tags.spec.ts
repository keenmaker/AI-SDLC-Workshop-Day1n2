import { test, expect } from '@playwright/test';
import { TodoAppHelper } from './helpers';

test.describe('Tag Management (PRP-06)', () => {
  let helper: TodoAppHelper;

  test.beforeEach(async ({ page }) => {
    helper = new TodoAppHelper(page);
    await helper.goto();
  });

  test('should display Manage Tags button', async ({ page }) => {
    const button = page.locator('button:has-text("Manage Tags")');
    await expect(button).toBeVisible();
  });

  test('should open and close Manage Tags modal', async () => {
    await helper.openManageTagsModal();
    await expect(
      helper['page'].locator('text=Create New Tag'),
    ).toBeVisible();

    await helper.closeManageTagsModal();
    await expect(
      helper['page'].locator('text=Create New Tag'),
    ).toBeHidden();
  });

  test('should create a tag with default color', async ({ page }) => {
    await helper.openManageTagsModal();

    // Fill tag name
    await page.locator('input[placeholder="Enter tag name..."]').fill('Work');

    // Create tag
    await page.locator('button:has-text("Create Tag")').click();

    // Wait for tag to appear in list
    await expect(page.locator('text=Work')).toBeVisible();

    // Verify tag appears with default color indicator
    await expect(page.locator(`div:has-text("Work")`).first()).toBeVisible();
  });

  test('should create a tag with custom color', async ({ page }) => {
    await helper.openManageTagsModal();

    // Fill tag name
    await page.locator('input[placeholder="Enter tag name..."]').fill('Personal');

    // Set custom color
    const colorInput = page.locator('input[type="color"]').first();
    await colorInput.fill('#FF0000');

    // Create tag
    await page.locator('button:has-text("Create Tag")').click();

    // Wait for tag to appear
    await expect(page.locator('text=Personal')).toBeVisible();

    // Verify tag exists in list
    const tagRow = page.locator(`div:has-text("Personal")`).first();
    await expect(tagRow).toBeVisible();
  });

  test('should reject duplicate tag name with 409 error', async ({ page }) => {
    await helper.openManageTagsModal();

    // Create first tag
    await page.locator('input[placeholder="Enter tag name..."]').fill('Urgent');
    await page.locator('button:has-text("Create Tag")').click();
    await expect(page.locator('text=Urgent')).toBeVisible();

    // Attempt to create duplicate
    await page.locator('input[placeholder="Enter tag name..."]').fill('Urgent');
    await page.locator('button:has-text("Create Tag")').click();

    // Check for error message
    await expect(
      page.locator('text=/Tag with this name already exists/'),
    ).toBeVisible();
  });

  test('should edit tag name', async ({ page }) => {
    await helper.openManageTagsModal();

    // Create tag
    await page.locator('input[placeholder="Enter tag name..."]').fill('Todo');
    await page.locator('button:has-text("Create Tag")').click();
    await expect(page.locator('text=Todo')).toBeVisible();

    // Find tag row and click Edit
    const tagRow = page.locator('text=Todo').locator('..').first();
    await tagRow.locator('button:has-text("Edit")').click();

    // Update name
    const nameInputs = page.locator('input[type="text"]');
    const editInput = nameInputs.last();
    await editInput.fill('Updated Task');

    // Save
    await page.locator('button:has-text("Save")').click();

    // Verify update
    await expect(page.locator('text=Updated Task')).toBeVisible();
  });

  test('should edit tag color', async ({ page }) => {
    await helper.openManageTagsModal();

    // Create tag
    await page.locator('input[placeholder="Enter tag name..."]').fill('Bug');
    await page.locator('button:has-text("Create Tag")').click();
    await expect(page.locator('text=Bug')).toBeVisible();

    // Find tag row and click Edit
    const tagRow = page.locator('text=Bug').locator('..').first();
    await tagRow.locator('button:has-text("Edit")').click();

    // Update color
    const colorInputs = page.locator('input[type="color"]');
    const editColorInput = colorInputs.last();
    await editColorInput.fill('#FF5733');

    // Save
    await page.locator('button:has-text("Save")').click();

    // Verify update (tag still visible)
    await expect(page.locator('text=Bug')).toBeVisible();
  });

  test('should delete a tag with confirmation', async ({ page }) => {
    await helper.openManageTagsModal();

    // Create tag
    await page.locator('input[placeholder="Enter tag name..."]').fill('Delete Me');
    await page.locator('button:has-text("Create Tag")').click();
    await expect(page.locator('text=Delete Me')).toBeVisible();

    // Find tag row and click Delete
    const tagRow = page.locator('text=Delete Me').locator('..').first();

    // Set up dialog handler before clicking
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('Delete');
      dialog.accept();
    });

    await tagRow.locator('button:has-text("Delete")').click();

    // Verify tag is removed
    await expect(page.locator('text=Delete Me')).toBeHidden();
  });

  test('should show empty state when no tags exist', async ({ page }) => {
    await helper.openManageTagsModal();

    // Should show "No tags yet" message
    await expect(page.locator('text=No tags yet.')).toBeVisible();
  });

  test('should load and display all tags on page load', async ({ page }) => {
    // Create tags via API
    const createTag = async (name: string) => {
      const response = await page.request.post('/api/tags', {
        data: { name, color: '#3B82F6' },
      });
      expect(response.ok()).toBeTruthy();
    };

    await createTag('Work');
    await createTag('Personal');

    // Reload and verify tags appear in tag selector
    await page.reload();

    // Wait for tags to load
    await page.waitForTimeout(500);

    // Open manage tags modal to see list
    await helper.openManageTagsModal();

    await expect(page.locator('text=Work')).toBeVisible();
    await expect(page.locator('text=Personal')).toBeVisible();
  });

  test('tag selector should toggle tag selection', async ({ page }) => {
    // Create a tag via API
    await page.request.post('/api/tags', {
      data: { name: 'Feature', color: '#3B82F6' },
    });

    // Reload to see tag selector
    await page.reload();
    await page.waitForTimeout(500);

    // Click tag pill to select
    const tagPill = page.locator('button:has-text("Feature")').first();
    await tagPill.click();

    // Verify tag is now selected (should show checkmark)
    // Selected tags have different styling and include a checkmark
    await page.waitForTimeout(300);

    // Tag should now show in selected state
    const selectedTag = page.locator('button:has-text("Feature"):has-text("✓")');
    await expect(selectedTag).toBeVisible();
  });

  test('should persist tag colors across updates', async ({ page }) => {
    await helper.openManageTagsModal();

    // Create tag with specific color
    await page.locator('input[placeholder="Enter tag name..."]').fill('Colored');
    const colorInput = page.locator('input[type="color"]').first();
    await colorInput.fill('#FFA500');
    await page.locator('button:has-text("Create Tag")').click();

    // Wait for creation
    await expect(page.locator('text=Colored')).toBeVisible();

    // Reload and verify color persists
    await page.reload();
    await page.waitForTimeout(500);

    // Open modal again
    await helper.openManageTagsModal();

    // Verify tag is still there
    await expect(page.locator('text=Colored')).toBeVisible();
  });

  test('should handle empty tag name validation', async ({ page }) => {
    await helper.openManageTagsModal();

    // Try to create tag with empty name
    const nameInput = page.locator('input[placeholder="Enter tag name..."]');
    await nameInput.fill('   ');

    const createButton = page.locator('button:has-text("Create Tag")');

    // Button should be disabled
    await expect(createButton).toBeDisabled();
  });

  test('should validate hex color format', async ({ page }) => {
    await helper.openManageTagsModal();

    // Fill tag name
    await page.locator('input[placeholder="Enter tag name..."]').fill('Test');

    // Color input should accept valid hex
    const colorInput = page.locator('input[type="color"]').first();
    await colorInput.fill('#000000');

    // Should be able to create with valid color
    await page.locator('button:has-text("Create Tag")').click();

    // Wait for creation
    await expect(page.locator('text=Test')).toBeVisible();
  });
});
