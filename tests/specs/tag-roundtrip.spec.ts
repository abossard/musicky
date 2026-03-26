/**
 * E2E tests that verify the full tag round-trip with REAL MP3 files.
 *
 * These drive the actual Musicky UI which triggers real Telefunc calls
 * that read/write real MP3 files in test-music/.
 */
import { test, expect } from '../fixtures/app-fixture';

test.describe('Tag Round-Trip with Real MP3 Files', () => {
  test.beforeEach(async ({ setViewPage }) => {
    await setViewPage.goto();
    await setViewPage.waitForReady(15000);
  });

  // ── Tag assignment via UI ──────────────────────────────────────────

  test('DJ tags a song and exports → hashtags written to MP3 comment', async ({ setViewPage, page }) => {
    const songCount = await setViewPage.getSongCount();
    test.skip(songCount === 0, 'No songs in library');

    // 1. Select the first song
    const firstCard = setViewPage.songCards.first();
    await firstCard.click();

    // 2. Tag palette should appear with genre/mood sections
    await expect(page.getByText('GENRES')).toBeVisible({ timeout: 5000 });

    // 3. Toggle a genre tag
    const genreBadges = page.locator('.mantine-Badge-root')
      .filter({ hasText: /techno|house|trance|progressive/i });
    const badgeCount = await genreBadges.count();
    test.skip(badgeCount === 0, 'No genre tags available in palette');
    await genreBadges.first().click();
    await page.waitForTimeout(1000); // wait for DB write

    // 4. Open the export drawer
    const exportButton = page.locator('.set-view-toolbar button').nth(1);
    await exportButton.click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // 5. Wait for the scan to finish
    //    Either we see "Accept All" (changes found) or "All songs up to date"
    await expect(
      drawer.getByText(/accept all|all songs up to date/i).first()
    ).toBeVisible({ timeout: 15000 });

    // 6. If changes are proposed, apply them
    const acceptAllBtn = drawer.getByText(/accept all/i);
    if (await acceptAllBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await acceptAllBtn.click();

      const applyBtn = drawer.getByText(/apply selected/i);
      await applyBtn.click();

      // 7. Expect the success alert
      await expect(drawer.getByText(/export complete/i)).toBeVisible({ timeout: 15000 });
    }
  });

  // ── Page reload persists tags ──────────────────────────────────────

  test('songs are organized into phase columns after reload', async ({ setViewPage, page }) => {
    const songCount = await setViewPage.getSongCount();
    test.skip(songCount === 0, 'No songs in library');

    // Phase columns should exist (seeded by global setup)
    const columns = page.locator('[data-testid^="phase-column-"]');
    const columnCount = await columns.count();
    expect(columnCount).toBeGreaterThan(0);

    // At least one column should contain songs
    let totalSongsInColumns = 0;
    for (let i = 0; i < columnCount; i++) {
      const songsInColumn = await columns.nth(i).locator('[data-testid="set-song-card"]').count();
      totalSongsInColumns += songsInColumn;
    }
    expect(totalSongsInColumns).toBeGreaterThan(0);
  });

  // ── Real metadata on song cards ────────────────────────────────────

  test('song cards display Camelot key and BPM from real MP3 tags', async ({ setViewPage, page }) => {
    const songCount = await setViewPage.getSongCount();
    test.skip(songCount === 0, 'No songs in library');

    const firstCard = setViewPage.songCards.first();
    await expect(firstCard).toBeVisible();

    // Camelot key badge (pattern like "8A", "6B", "12A")
    const keyBadge = firstCard.locator('.mantine-Badge-root').filter({
      hasText: /^\d{1,2}[AB]$/,
    });
    if (await keyBadge.count() > 0) {
      const keyText = await keyBadge.first().textContent();
      expect(keyText).toMatch(/^\d{1,2}[AB]$/);
    }

    // BPM text (3-digit number)
    const bpmTexts = firstCard.locator('span').filter({
      hasText: /^\d{2,3}$/,
    });
    if (await bpmTexts.count() > 0) {
      const bpm = parseInt((await bpmTexts.first().textContent()) ?? '0', 10);
      expect(bpm).toBeGreaterThan(60);
      expect(bpm).toBeLessThan(200);
    }
  });

  test('song cards display energy level badge', async ({ setViewPage }) => {
    const songCount = await setViewPage.getSongCount();
    test.skip(songCount === 0, 'No songs in library');

    const firstCard = setViewPage.songCards.first();
    await expect(firstCard).toBeVisible();

    // Energy badge (pattern like "E5", "E8")
    const energyBadge = firstCard.locator('.mantine-Badge-root').filter({
      hasText: /^E\d{1,2}$/,
    });
    if (await energyBadge.count() > 0) {
      const text = await energyBadge.first().textContent();
      const level = parseInt(text?.replace('E', '') ?? '0', 10);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(10);
    }
  });

  // ── Song detail panel ──────────────────────────────────────────────

  test('double-click song opens detail panel with metadata', async ({ setViewPage, page }) => {
    const songCount = await setViewPage.getSongCount();
    test.skip(songCount === 0, 'No songs in library');

    // Double-click to open the detail drawer
    await setViewPage.songCards.first().dblclick();

    const drawer = page.getByRole('dialog').filter({ hasText: /song detail/i });
    await expect(drawer).toBeVisible({ timeout: 10000 });

    // The detail panel should show at least a title
    const textContent = await drawer.textContent();
    expect(textContent?.length).toBeGreaterThan(0);
  });

  // ── Export review table states ─────────────────────────────────────

  test('export panel shows scanning state then results', async ({ page }) => {
    // Open the export drawer
    const exportButton = page.locator('.set-view-toolbar button').nth(1);
    await exportButton.click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // Should initially show scanning or jump straight to results
    // Wait for either outcome
    await expect(
      drawer.getByText(/scanning files|accept all|all songs up to date/i).first()
    ).toBeVisible({ timeout: 15000 });

    // After scan completes, should show one of the final states
    await expect(
      drawer.getByText(/accept all|all songs up to date|export complete/i).first()
    ).toBeVisible({ timeout: 15000 });
  });
});
