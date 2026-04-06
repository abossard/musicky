import { test, expect } from '@playwright/test';

test.describe('Moodboard Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/moodboard');
    // Wait for the page to finish loading (loading spinner disappears)
    await expect(page.locator('.set-view')).toBeVisible({ timeout: 30000 });
  });

  test('view toggle switches between Set View and Canvas', async ({ page }) => {
    // Switch to Canvas via the radio button
    await page.getByRole('radio', { name: 'Canvas' }).click();

    // Canvas view should render — wait for loading to finish first
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30000 });

    // Set view columns should be hidden
    await expect(page.locator('.set-view-columns')).not.toBeVisible();

    // Switch back to Set View
    await page.getByRole('radio', { name: 'Set View' }).click();
    await expect(page.locator('.set-view-columns')).toBeVisible({ timeout: 10000 });
  });

  test('canvas view shows board selector', async ({ page }) => {
    await page.getByRole('radio', { name: 'Canvas' }).click();

    // Board selector should appear after canvas loads
    const selector = page.getByTestId('board-selector');
    await expect(selector).toBeVisible({ timeout: 30000 });
  });

  test('can create a new board', async ({ page }) => {
    await page.getByRole('radio', { name: 'Canvas' }).click();
    await expect(page.getByTestId('board-selector')).toBeVisible({ timeout: 30000 });

    // Click new board button
    await page.getByTestId('new-board-btn').click();

    // Type board name and create
    const input = page.getByTestId('new-board-input');
    await expect(input).toBeVisible();
    await input.fill('Test Board');
    await page.getByTestId('create-board-btn').click();

    // Board selector should now show the new board
    await expect(page.getByTestId('board-selector')).toHaveValue('Test Board', { timeout: 10000 });
  });

  test('export and import buttons are available', async ({ page }) => {
    await page.getByRole('radio', { name: 'Canvas' }).click();
    await expect(page.getByTestId('board-selector')).toBeVisible({ timeout: 30000 });

    await expect(page.getByTestId('export-board-btn')).toBeVisible();
    await expect(page.getByTestId('import-board-btn')).toBeVisible();
  });
});
