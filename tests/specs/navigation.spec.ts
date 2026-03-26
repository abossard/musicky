import { test, expect } from '../fixtures/app-fixture';

test.describe('Navigation & Layout', () => {
  test('home redirects to set view', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/moodboard/, { timeout: 15000 });
  });

  test('set view page loads with toolbar and columns', async ({ setViewPage }) => {
    await setViewPage.goto();
    await setViewPage.waitForReady();
    await expect(setViewPage.toolbar).toBeVisible();
  });

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('Playback Settings')).toBeVisible({ timeout: 15000 });
  });

  test('404 handling', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/404|not found|page.*not.*found/i).first()).toBeVisible({ timeout: 10000 });
  });
});
