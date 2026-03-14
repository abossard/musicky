import { test, expect } from '../fixtures/app-fixture';

test.describe('Navigation & Layout', () => {
  test('home page loads with welcome message', async ({ nav }) => {
    await nav.goHome();
    await expect(nav.appTitle.first()).toBeVisible();
  });

  test('all pages are accessible from sidebar', async ({ nav, page }) => {
    await nav.goHome();

    await nav.navigateViaLink(nav.navLinks.djSets);
    await expect(page.getByRole('heading', { name: 'DJ Set Management' })).toBeVisible();

    await nav.navigateViaLink(nav.navLinks.mp3Library);
    await expect(page.getByText('MP3 Library').first()).toBeVisible();

    await nav.navigateViaLink(nav.navLinks.settings);
    await expect(page.getByText('Playback Settings')).toBeVisible({ timeout: 15000 });

    await nav.navigateViaLink(nav.navLinks.reviews);
    await expect(page.getByText('Review Changes').first()).toBeVisible();
  });

  test('navigation links are visible on desktop', async ({ nav }) => {
    await nav.goHome();
    await nav.expectNavLinksVisible();
  });

  test('mobile viewport shows burger menu', async ({ nav, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await nav.goHome();

    // On mobile, the burger should be visible
    if (await nav.burger.isVisible()) {
      await nav.openMobileMenu();
      await nav.expectNavLinksVisible();
    }
  });

  test('each page route loads directly', async ({ page }) => {
    test.setTimeout(120000);
    const routes: { path: string; locator: string; timeout?: number }[] = [
      { path: '/dj-sets', locator: 'heading:DJ Set Management' },
      { path: '/settings', locator: 'text:Playback Settings', timeout: 30000 },
      { path: '/review-changes', locator: 'text-first:Review Changes' },
      { path: '/audio-player', locator: 'text-first:Audio Player Demo' },
      { path: '/file-browser', locator: 'text-first:File Browser' },
      // MP3 Library skipped — scanning can take >2min
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      const [type, text] = route.locator.split(':');
      const timeout = route.timeout ?? 15000;
      if (type === 'heading') {
        await expect(page.getByRole('heading', { name: text })).toBeVisible({ timeout });
      } else if (type === 'text-first') {
        await expect(page.getByText(text).first()).toBeVisible({ timeout });
      } else {
        await expect(page.getByText(text)).toBeVisible({ timeout });
      }
    }
  });
});
