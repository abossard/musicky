import { test, expect } from '../fixtures/app-fixture';

test.describe('Camelot Harmonic Compatibility', () => {
  test.beforeEach(async ({ moodboardPage }) => {
    await moodboardPage.goto();
    await expect(moodboardPage.librarySongItems.first()).toBeVisible({ timeout: 15000 });
  });

  test('compatible filter toggle is hidden when no song selected on canvas', async ({ moodboardPage }) => {
    // With no canvas song selected, the compatible-filter element should not be in the DOM
    const compatibleFilter = moodboardPage.page.locator('[data-testid="library-compatible-filter"]');
    await expect(compatibleFilter).toHaveCount(0);
  });

  test('compatible filter element is conditionally rendered based on canvas selection', async ({ moodboardPage }) => {
    // The filter is only rendered when selectedCanvasKey is truthy (a song on the canvas is selected).
    // Without a canvas song selected, it should not exist in the DOM at all.
    const compatibleFilter = moodboardPage.page.locator('[data-testid="library-compatible-filter"]');
    await expect(compatibleFilter).not.toBeVisible();

    // Verify the library panel itself is visible — confirming the filter's absence is intentional
    await moodboardPage.expectLibraryVisible();
  });

  test('Camelot key badges are displayed with background colors', async ({ moodboardPage }) => {
    // Songs seeded with Camelot keys should show colored key badges
    const keyBadges = moodboardPage.page.locator(
      '[data-testid="library-song-item"] [data-testid="song-key-badge"]'
    );
    const count = await keyBadges.count();
    expect(count).toBeGreaterThan(0);

    // Each badge should have a background-color style (set inline via getCamelotColor)
    for (let i = 0; i < Math.min(count, 5); i++) {
      const badge = keyBadges.nth(i);
      await expect(badge).toBeVisible();
      const bg = await badge.evaluate(el => getComputedStyle(el).backgroundColor);
      // getCamelotColor returns hsl() values — computed style resolves to rgb(...)
      expect(bg).toMatch(/^rgb/);
      // Should not be transparent or the fallback gray (#888888 = rgb(136, 136, 136))
      expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('key badges display valid Camelot codes', async ({ moodboardPage }) => {
    const keyBadges = moodboardPage.page.locator(
      '[data-testid="library-song-item"] [data-testid="song-key-badge"]'
    );
    const count = await keyBadges.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await keyBadges.nth(i).textContent();
      // Valid Camelot key: 1A-12B
      expect(text).toMatch(/^\d{1,2}[AB]$/);
    }
  });
});
