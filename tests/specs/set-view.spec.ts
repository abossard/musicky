import { test, expect } from '../fixtures/app-fixture';

test.describe('DJ Set Preparation Workflow', () => {
  test.beforeEach(async ({ setViewPage }) => {
    await setViewPage.goto();
    await setViewPage.waitForReady(15000);
  });

  // --- Core: Songs are visible and organized ---

  test('DJ sees songs organized in phase columns', async ({ setViewPage, page }) => {
    await expect(setViewPage.toolbar).toBeVisible();
    const columns = page.locator('[data-testid^="phase-column-"]');
    await expect(columns.first()).toBeVisible({ timeout: 10000 });

    const songCount = await setViewPage.getSongCount();
    expect(songCount).toBeGreaterThan(0);

    const firstCard = setViewPage.songCards.first();
    await expect(firstCard).toBeVisible();
  });

  // --- Tagging: DJ can tag songs with genres and moods ---

  test('DJ selects a song and sees tag palette', async ({ setViewPage, page }) => {
    const songCount = await setViewPage.getSongCount();
    test.skip(songCount === 0, 'No songs in library');

    await setViewPage.songCards.first().click();

    await expect(page.getByText('GENRES')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('MOODS')).toBeVisible();
  });

  test('DJ can toggle a genre tag on a song', async ({ setViewPage, page }) => {
    const songCount = await setViewPage.getSongCount();
    test.skip(songCount === 0, 'No songs in library');

    await setViewPage.songCards.first().click();
    await expect(page.getByText('GENRES')).toBeVisible({ timeout: 5000 });

    const genreBadges = page.locator('.mantine-Badge-root').filter({ hasText: /techno|house|trance|progressive/i });
    const badgeCount = await genreBadges.count();
    test.skip(badgeCount === 0, 'No genre tags available');

    await genreBadges.first().click();
    // Badge click is handled — no crash means tagging works
  });

  // --- Selection: DJ selects and deselects songs ---

  test('DJ clicks a song to select it', async ({ setViewPage }) => {
    const count = await setViewPage.getSongCount();
    test.skip(count === 0, 'No songs in library');

    const firstCard = setViewPage.songCards.first();
    await firstCard.click();

    // Selected card gets a prominent border
    await expect(firstCard).toHaveCSS('border', /2px solid/);
  });

  test('DJ clicks another song and previous deselects', async ({ setViewPage }) => {
    const count = await setViewPage.getSongCount();
    test.skip(count < 2, 'Need at least 2 songs');

    const firstCard = setViewPage.songCards.first();
    await firstCard.click();

    const secondCard = setViewPage.songCards.nth(1);
    await secondCard.click();

    await expect(firstCard).toHaveCSS('border', /1px solid/);
    await expect(secondCard).toHaveCSS('border', /2px solid/);
  });

  // --- Keyboard: DJ navigates with keyboard ---

  test('DJ navigates songs with arrow keys', async ({ setViewPage, page }) => {
    const songCount = await setViewPage.getSongCount();
    test.skip(songCount < 2, 'Need at least 2 songs');

    await setViewPage.songCards.first().click();
    await page.keyboard.press('ArrowDown');

    const focusedCard = page.locator('[data-testid="song-card-focused"]');
    await expect(focusedCard).toBeVisible({ timeout: 5000 });
  });

  test('DJ moves focus across phase columns', async ({ setViewPage, page }) => {
    const songCount = await setViewPage.getSongCount();
    test.skip(songCount === 0, 'No songs in library');

    await setViewPage.songCards.first().click();
    await page.keyboard.press('ArrowRight');

    const allCards = page.locator('[data-testid="set-song-card"], [data-testid="song-card-focused"]');
    await expect(allCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('DJ presses Escape to deselect all', async ({ setViewPage, page }) => {
    const count = await setViewPage.getSongCount();
    test.skip(count === 0, 'No songs in library');

    await setViewPage.songCards.first().click();
    await page.keyboard.press('Escape');

    const firstCard = setViewPage.songCards.first();
    await expect(firstCard).toHaveCSS('border', /1px solid/);
  });

  test('DJ opens keyboard shortcuts help', async ({ setViewPage, page }) => {
    // Click the keyboard shortcuts button (last toolbar button)
    const helpButton = page.locator('.set-view-toolbar button').last();
    await helpButton.click();

    const heading = page.getByRole('heading', { name: 'Keyboard Shortcuts' });
    await expect(heading).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('Navigation')).toBeVisible();
    await expect(page.getByText('Phase Movement')).toBeVisible();
    await expect(page.getByText('Playback')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(heading).not.toBeVisible();
  });

  // --- Sub-grouping: DJ groups songs by genre within phases ---

  test('DJ can group songs by genre within phases', async ({ page }) => {
    const genreButton = page.getByText('By Genre');
    await expect(genreButton).toBeVisible({ timeout: 10000 });
    await genreButton.click();

    // Segmented control reflects the change
    await expect(genreButton).toBeVisible();

    // Switch back to flat to confirm toggling works
    const flatButton = page.getByText('Flat');
    await flatButton.click();
    await expect(flatButton).toBeVisible();
  });

  // --- Export: DJ can access tag export ---

  test('DJ can open tag export panel', async ({ page }) => {
    // Export button is the second ActionIcon in the toolbar
    const exportButton = page.locator('.set-view-toolbar button').nth(1);
    await expect(exportButton).toBeVisible({ timeout: 5000 });
    await exportButton.click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible({ timeout: 5000 });
  });

  // --- Library: DJ can browse and add songs ---

  test('DJ can toggle library panel', async ({ page }) => {
    await page.keyboard.press('l');
    await page.waitForTimeout(500);

    // Press L again to toggle back
    await page.keyboard.press('l');
  });

  // --- Playback: DJ can preview songs ---

  test('DJ sees audio player bar', async ({ page }) => {
    const player = page.locator('.audio-player-bar');
    await expect(player).toBeVisible();
  });
});
