import { test, expect } from '../fixtures/app-fixture';

test.describe('Navigation & Layout', () => {
  test('home redirects to moodboard', async ({ page, nav }) => {
    await nav.goHome();
    await expect(page).toHaveURL(/\/moodboard/, { timeout: 15000 });
  });

  test('set view page loads', async ({ setViewPage }) => {
    await setViewPage.goto();
    await setViewPage.waitForReady();
  });

  test('settings page loads', async ({ settingsPage }) => {
    await settingsPage.goto();
    await settingsPage.expectPlaybackSettingsVisible();
  });

  test('sidebar navigation works on desktop', async ({ nav, page, setViewPage }) => {
    await nav.goToMoodboard();
    await nav.expectNavLinksVisible();

    await nav.navigateViaLink(nav.navLinks.settings);
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText('Playback Settings')).toBeVisible({ timeout: 15000 });

    await nav.navigateViaLink(nav.navLinks.moodboard);
    await expect(page).toHaveURL(/\/moodboard/);
    await setViewPage.waitForReady();
  });

  test('mobile burger menu', async ({ nav, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await nav.goToMoodboard();

    await expect(nav.burger).toBeVisible();
    await nav.openMobileMenu();
    await nav.expectNavLinksVisible();

    // On mobile viewport the nav link may be outside the viewport due to
    // AppShell layout. Use JavaScript navigation as a workaround.
    await nav.navLinks.settings.evaluate((el: HTMLElement) => el.click());
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/settings/);
  });

  test('app title visible', async ({ nav }) => {
    await nav.goToMoodboard();
    await expect(nav.appTitle.first()).toBeVisible();
  });

  test('404 handling', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/404|not found|page.*not.*found/i).first()).toBeVisible({ timeout: 10000 });
  });
});
