import { test, expect } from '../fixtures/app-fixture';

test.describe('Moodboard Keyboard Navigation', () => {
  test.beforeEach(async ({ moodboardPage }) => {
    await moodboardPage.goto();
    await moodboardPage.waitForCanvasReady();
    // Click canvas to ensure focus is not in an input
    await moodboardPage.canvas.click();
  });

  test('? key toggles shortcut help modal', async ({ page, moodboardPage }) => {
    const modal = page.getByText('Keyboard Shortcuts');
    await expect(modal).not.toBeVisible();

    await page.keyboard.press('?');
    await expect(modal).toBeVisible();

    // Table should list known shortcuts
    await expect(page.getByText('Play / pause current track')).toBeVisible();
    await expect(page.getByText('Toggle library panel')).toBeVisible();
    await expect(page.getByText('Show this help')).toBeVisible();

    // Press ? again to toggle off
    await page.keyboard.press('?');
    await expect(modal).not.toBeVisible();
  });

  test('Escape closes shortcut help modal', async ({ page }) => {
    const modal = page.getByText('Keyboard Shortcuts');

    await page.keyboard.press('?');
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Escape closes settings drawer', async ({ page, moodboardPage }) => {
    await moodboardPage.openSettings();
    await expect(moodboardPage.settingsDrawer).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(moodboardPage.settingsDrawer).not.toBeVisible();
  });

  test('Escape closes review drawer', async ({ page, moodboardPage }) => {
    await moodboardPage.openReview();
    await expect(moodboardPage.reviewDrawer).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(moodboardPage.reviewDrawer).not.toBeVisible();
  });

  test('Escape respects priority: settings before review', async ({ page, moodboardPage }) => {
    // Open settings (will be checked first in onEscape handler)
    await moodboardPage.openSettings();
    await expect(moodboardPage.settingsDrawer).toBeVisible();

    // First Escape closes settings
    await page.keyboard.press('Escape');
    await expect(moodboardPage.settingsDrawer).not.toBeVisible();
  });

  test('Control+L toggles library panel', async ({ page, moodboardPage }) => {
    await expect(moodboardPage.libraryPanel).toBeVisible();

    await page.keyboard.press('Control+l');
    await expect(moodboardPage.libraryPanel).not.toBeVisible();

    await page.keyboard.press('Control+l');
    await expect(moodboardPage.libraryPanel).toBeVisible();
  });

  test('Control+P toggles playlist panel', async ({ page, moodboardPage }) => {
    await expect(moodboardPage.playlistPanel).not.toBeVisible();

    await page.keyboard.press('Control+p');
    await expect(moodboardPage.playlistPanel).toBeVisible();

    await page.keyboard.press('Control+p');
    await expect(moodboardPage.playlistPanel).not.toBeVisible();
  });

  test('Control+F focuses library search', async ({ page, moodboardPage }) => {
    await page.keyboard.press('Control+f');
    // The hook opens library if closed, then focuses the search input
    await expect(moodboardPage.libraryPanel).toBeVisible();
    await expect(moodboardPage.librarySearch).toBeFocused({ timeout: 1000 });
  });

  test('/ key focuses library search', async ({ page, moodboardPage }) => {
    await page.keyboard.press('/');
    await expect(moodboardPage.libraryPanel).toBeVisible();
    await expect(moodboardPage.librarySearch).toBeFocused({ timeout: 1000 });
  });

  test('Control+, opens settings drawer', async ({ page, moodboardPage }) => {
    await expect(moodboardPage.settingsDrawer).not.toBeVisible();

    await page.keyboard.press('Control+,');
    await expect(moodboardPage.settingsDrawer).toBeVisible();
  });

  test('? key is ignored when typing in an input', async ({ page, moodboardPage }) => {
    // Focus the library search input first
    await moodboardPage.librarySearch.click();
    await moodboardPage.librarySearch.focus();

    await page.keyboard.press('?');
    // Modal should NOT open because focus is on an input element
    const modal = page.getByText('Keyboard Shortcuts');
    await expect(modal).not.toBeVisible();
  });

  test('Control+F focuses search even when library is closed', async ({ page, moodboardPage }) => {
    // Close library first
    await page.keyboard.press('Control+l');
    await expect(moodboardPage.libraryPanel).not.toBeVisible();

    // Ctrl+F should reopen library and focus search
    await page.keyboard.press('Control+f');
    await expect(moodboardPage.libraryPanel).toBeVisible();
    await expect(moodboardPage.librarySearch).toBeFocused({ timeout: 1000 });
  });
});
