import { test, expect } from '../fixtures/app-fixture';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads with playback section', async ({ page }) => {
    await expect(page.getByText('Playback Settings')).toBeVisible({ timeout: 15000 });
  });

  test('keep play head checkbox is present', async ({ page }) => {
    const checkbox = page.getByRole('checkbox');
    await expect(checkbox.first()).toBeVisible({ timeout: 10000 });
  });

  test('can toggle keep play head setting', async ({ page }) => {
    const checkbox = page.getByRole('checkbox').first();
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    const wasChecked = await checkbox.isChecked();
    await checkbox.click();
    
    if (wasChecked) {
      await expect(checkbox).not.toBeChecked();
    } else {
      await expect(checkbox).toBeChecked();
    }
  });
});
