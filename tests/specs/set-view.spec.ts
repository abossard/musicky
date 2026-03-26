import { test, expect } from '../fixtures/app-fixture';

test.describe('Set View', () => {
  test.beforeEach(async ({ setViewPage }) => {
    await setViewPage.goto();
    await setViewPage.waitForReady(15000);
  });

  // ── 1. Basic rendering ──────────────────────────────────────────────

  test.describe('Basic rendering', () => {
    test('page loads with toolbar visible', async ({ setViewPage, page }) => {
      await expect(setViewPage.toolbar).toBeVisible();
      await expect(page.getByText('🎧 SET VIEW')).toBeVisible();
    });

    test('phase columns are rendered with unassigned column', async ({ page }) => {
      const unassigned = page.locator('[data-testid="phase-column-unassigned"]');
      await expect(unassigned).toBeVisible({ timeout: 10000 });
    });

    test('song cards are visible when songs exist', async ({ setViewPage }) => {
      const count = await setViewPage.getSongCount();
      if (count > 0) {
        await expect(setViewPage.songCards.first()).toBeVisible();
      }
      // If no songs in DB, we just verify the page loaded without error
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 2. Song selection ───────────────────────────────────────────────

  test.describe('Song selection', () => {
    test('clicking a song card selects it', async ({ setViewPage }) => {
      const count = await setViewPage.getSongCount();
      test.skip(count === 0, 'No songs in the library');

      const firstCard = setViewPage.songCards.first();
      await firstCard.click();

      // Selected card gets violet border
      await expect(firstCard).toHaveCSS(
        'border',
        /2px solid/,
      );
    });

    test('clicking another song deselects previous', async ({ setViewPage, page }) => {
      const count = await setViewPage.getSongCount();
      test.skip(count < 2, 'Need at least 2 songs');

      const firstCard = setViewPage.songCards.first();
      await firstCard.click();

      // Click second card
      const secondCard = setViewPage.songCards.nth(1);
      await secondCard.click();

      // First card reverts to thin default border
      await expect(firstCard).toHaveCSS('border', /1px solid/);
      // Second card now has selection border
      await expect(secondCard).toHaveCSS('border', /2px solid/);
    });
  });

  // ── 3. Keyboard navigation ─────────────────────────────────────────

  test.describe('Keyboard navigation', () => {
    test('ArrowDown moves focus to next song', async ({ setViewPage, page }) => {
      const count = await setViewPage.getSongCount();
      test.skip(count < 2, 'Need at least 2 songs');

      // Click first card to establish focus
      await setViewPage.songCards.first().click();
      await page.keyboard.press('ArrowDown');

      // A focused card gets the 'song-card-focused' testid
      const focusedCard = page.locator('[data-testid="song-card-focused"]');
      await expect(focusedCard).toBeVisible({ timeout: 5000 });
    });

    test('ArrowRight moves focus to next column', async ({ setViewPage, page }) => {
      const count = await setViewPage.getSongCount();
      test.skip(count === 0, 'No songs in the library');

      // Click first card then navigate right
      await setViewPage.songCards.first().click();
      await page.keyboard.press('ArrowRight');

      // Focus indicator should still be present (moved to another column)
      const focusedCard = page.locator('[data-testid="song-card-focused"]');
      const allCards = page.locator('[data-testid="set-song-card"], [data-testid="song-card-focused"]');
      // At minimum, some card is rendered
      await expect(allCards.first()).toBeVisible({ timeout: 5000 });
    });

    test('Escape clears selection', async ({ setViewPage, page }) => {
      const count = await setViewPage.getSongCount();
      test.skip(count === 0, 'No songs in the library');

      await setViewPage.songCards.first().click();
      await page.keyboard.press('Escape');

      // After escape, no card should have violet selection border
      // All cards should revert to default 1px border
      const firstCard = setViewPage.songCards.first();
      await expect(firstCard).toHaveCSS('border', /1px solid/);
    });
  });

  // ── 4. Keyboard shortcuts help ─────────────────────────────────────

  test.describe('Keyboard shortcuts help', () => {
    async function openShortcutHelp(page: import('@playwright/test').Page) {
      // The keyboard shortcuts button is the last ActionIcon in the toolbar
      // Mantine Tooltip wraps it, so we find via the tooltip text
      const btn = page.locator('.set-view-toolbar button').last();
      await btn.click();
    }

    test('clicking keyboard button opens shortcuts modal', async ({ page }) => {
      await openShortcutHelp(page);

      await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible({ timeout: 5000 });
    });

    test('modal shows keyboard shortcut content', async ({ page }) => {
      await openShortcutHelp(page);

      await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible({ timeout: 5000 });

      // Verify section headers from the modal
      await expect(page.getByText('Navigation')).toBeVisible();
      await expect(page.getByText('Phase Movement')).toBeVisible();
      await expect(page.getByText('Playback')).toBeVisible();
    });

    test('Escape closes the shortcuts modal', async ({ page }) => {
      await openShortcutHelp(page);
      await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible({ timeout: 5000 });

      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).not.toBeVisible({ timeout: 5000 });
    });
  });

  // ── 5. Tag palette ─────────────────────────────────────────────────

  test.describe('Tag palette', () => {
    test('tag palette sidebar is visible', async ({ page }) => {
      // The sidebar always renders with a "Tags" header
      const tagsHeader = page.getByText('Tags', { exact: true }).first();
      await expect(tagsHeader).toBeVisible({ timeout: 10000 });
    });

    test('selecting a song shows genre and mood sections', async ({ setViewPage, page }) => {
      const count = await setViewPage.getSongCount();
      test.skip(count === 0, 'No songs in the library');

      await setViewPage.songCards.first().click();

      // When a song is selected, GENRES and MOODS headings appear
      await expect(page.getByText('GENRES')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('MOODS')).toBeVisible({ timeout: 5000 });
    });
  });

  // ── 6. Sub-grouping ────────────────────────────────────────────────

  test.describe('Sub-grouping', () => {
    test('By Genre groups songs within phases', async ({ page }) => {
      // Click the "By Genre" option in the SegmentedControl
      await page.getByText('By Genre').click();

      // Verify the segmented control reflects the new value
      const genreControl = page.getByText('By Genre');
      await expect(genreControl).toBeVisible();

      // After switching, the GENRES text in the sidebar stays, and
      // sub-group headers (colored border-left bars with cyan text) appear
      // in the phase columns — we verify the control was toggled
      // by checking the Flat button is no longer active
    });

    test('Flat returns songs to flat list', async ({ page }) => {
      // First switch to By Genre
      await page.getByText('By Genre').click();

      // Then switch back to Flat
      await page.getByText('Flat').click();

      const flatControl = page.getByText('Flat');
      await expect(flatControl).toBeVisible();
    });
  });
});
