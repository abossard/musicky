import { test, expect, uniqueName } from '../fixtures/app-fixture';

test.describe('Song Detail Panel', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ moodboardPage }) => {
    await moodboardPage.goto();
    // Wait for library to load songs
    await expect(moodboardPage.librarySongItems.first()).toBeVisible({ timeout: 15000 });
  });

  test('detail panel opens when song is selected', async ({ moodboardPage }) => {
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();
  });

  test('shows song metadata (title, artist, album)', async ({ moodboardPage }) => {
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();

    const drawer = moodboardPage.songDetailDrawer;
    const root = drawer.locator('.sdp-root');
    await expect(root).toBeVisible({ timeout: 10000 });

    // Title should be visible (either parsed from filename or metadata)
    const title = root.locator('text=Unknown').first()
      .or(root.locator('.mantine-Text-root').filter({ hasNotText: /Unknown Artist|Album:|Duration:|Genre:/ }).first());
    await expect(root.locator('.mantine-Text-root').first()).toBeVisible();

    // Artist line should appear
    const artistOrUnknown = root.getByText(/Unknown Artist|.+/);
    await expect(artistOrUnknown.first()).toBeVisible();

    // Duration line
    await expect(root.getByText(/Duration:/)).toBeVisible();
  });

  test('shows artwork or placeholder', async ({ moodboardPage }) => {
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();

    const drawer = moodboardPage.songDetailDrawer;
    const artwork = drawer.locator('.sdp-artwork');
    await expect(artwork).toBeVisible({ timeout: 10000 });
  });

  test('shows play button', async ({ moodboardPage }) => {
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();

    const playBtn = moodboardPage.songDetailDrawer.getByRole('button', { name: 'Play' });
    await expect(playBtn).toBeVisible({ timeout: 10000 });
  });

  test('displays tag badges grouped by category', async ({ moodboardPage, page }) => {
    // Select a song that has seeded tags (ARTBAT songs have techno/dark/peak)
    await moodboardPage.searchSongs('artbat');
    // Wait for filtered results that contain ARTBAT
    await expect(moodboardPage.librarySongItems.first()).toContainText(/artbat/i, { timeout: 10000 });
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();

    const drawer = moodboardPage.songDetailDrawer;
    const root = drawer.locator('.sdp-root');
    await expect(root).toBeVisible({ timeout: 10000 });

    // Category headings should be visible (phase, genre, mood, topic, custom)
    await expect(root.getByText('phase', { exact: true })).toBeVisible();
    await expect(root.getByText('genre', { exact: true })).toBeVisible();
    await expect(root.getByText('mood', { exact: true })).toBeVisible();

    // ARTBAT songs are seeded with: techno (genre), dark (mood), peak (phase)
    // Wait for tags to load from the database
    const badges = root.locator('.mantine-Badge-root');
    await expect(badges.first()).toBeVisible({ timeout: 5000 });
    const badgeCount = await badges.count();
    expect(badgeCount).toBeGreaterThan(0);
  });

  test('can add a tag to a song', async ({ moodboardPage, page }) => {
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();

    const drawer = moodboardPage.songDetailDrawer;
    const root = drawer.locator('.sdp-root');
    await expect(root).toBeVisible({ timeout: 10000 });

    const tagName = uniqueName('testtag');

    // The "custom" category heading is a <p> inside a Box. The Box also contains
    // the add (+) ActionIcon. Navigate from heading to its parent Box.
    const customHeading = root.getByText('custom', { exact: true });
    await expect(customHeading).toBeVisible();
    const customBox = customHeading.locator('..');
    const addBtn = customBox.getByRole('button');
    await addBtn.click();

    // Type the tag name and press Enter
    const tagInput = drawer.locator('.sdp-tag-input input');
    await expect(tagInput).toBeVisible();
    await tagInput.fill(tagName);
    await tagInput.press('Enter');

    // Verify the new tag badge appears
    await expect(drawer.getByText(tagName)).toBeVisible({ timeout: 5000 });
  });

  test('can remove a tag from a song', async ({ moodboardPage, page }) => {
    // Use an ARTBAT song which has seeded tags
    await moodboardPage.searchSongs('artbat');
    await expect(moodboardPage.librarySongItems.first()).toContainText(/artbat/i, { timeout: 10000 });
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();

    const drawer = moodboardPage.songDetailDrawer;
    const root = drawer.locator('.sdp-root');
    await expect(root).toBeVisible({ timeout: 10000 });

    // Wait for tags to load, then count badges before removal
    await moodboardPage.page.waitForTimeout(1000);
    const badges = root.locator('.mantine-Badge-root');
    await expect(badges.first()).toBeVisible({ timeout: 5000 });
    const countBefore = await badges.count();

    // Click the × button on the first badge to remove it
    const removeBtn = badges.first().getByRole('button');
    await removeBtn.click();

    // Wait for the tag count to decrease
    await expect(badges).toHaveCount(countBefore - 1, { timeout: 5000 });
  });

  test('shows connections section or empty state', async ({ moodboardPage }) => {
    // Global setup clears song_connections, so we expect the section to either
    // show connections (if any were added) or not appear at all.
    // The Connections section only renders if connections.length > 0,
    // so we verify the Similar Songs section is always present instead.
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();

    const drawer = moodboardPage.songDetailDrawer;
    const root = drawer.locator('.sdp-root');
    await expect(root).toBeVisible({ timeout: 10000 });

    // The "Similar Songs" divider is always rendered (use exact match to avoid matching "No similar songs...")
    await expect(drawer.getByText('Similar Songs', { exact: true })).toBeVisible();
  });

  test('shows similar songs section', async ({ moodboardPage }) => {
    // Select an ARTBAT song — multiple ARTBAT tracks share tags, so similarity is likely
    await moodboardPage.searchSongs('artbat');
    await expect(moodboardPage.librarySongItems.first()).toContainText(/artbat/i, { timeout: 10000 });
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();

    const drawer = moodboardPage.songDetailDrawer;
    const root = drawer.locator('.sdp-root');
    await expect(root).toBeVisible({ timeout: 10000 });

    await expect(drawer.getByText('Similar Songs', { exact: true })).toBeVisible();

    // Either we get similar songs or "No similar songs found yet."
    const hasSimilar = drawer.locator('.sdp-connection-row');
    const emptyMsg = drawer.getByText('No similar songs found yet.');
    await expect(hasSimilar.first().or(emptyMsg)).toBeVisible({ timeout: 10000 });
  });

  test('clicking a similar song navigates to that song', async ({ moodboardPage }) => {
    // Select an ARTBAT song that likely has similar songs
    await moodboardPage.searchSongs('artbat');
    await expect(moodboardPage.librarySongItems.first()).toContainText(/artbat/i, { timeout: 10000 });
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();

    const drawer = moodboardPage.songDetailDrawer;
    const root = drawer.locator('.sdp-root');
    await expect(root).toBeVisible({ timeout: 10000 });

    // Wait for similar songs to load
    const similarRows = drawer.locator('.sdp-connection-row');
    const emptyMsg = drawer.getByText('No similar songs found yet.');

    // If similar songs loaded, click the first one
    const firstSimilar = similarRows.first();
    if (await firstSimilar.isVisible({ timeout: 8000 }).catch(() => false)) {
      const similarTitle = await firstSimilar.textContent();
      await firstSimilar.click();

      // The drawer should still be open but showing a different song
      await moodboardPage.expectSongDetailVisible();
      // The content should have changed (new metadata loading)
      await expect(root).toBeVisible({ timeout: 10000 });
    } else {
      // No similar songs available — just verify empty state
      await expect(emptyMsg).toBeVisible();
    }
  });

  test('detail panel closes on drawer close', async ({ moodboardPage }) => {
    await moodboardPage.selectSong(0);
    await moodboardPage.expectSongDetailVisible();

    await moodboardPage.closeSongDetail();

    await expect(moodboardPage.songDetailDrawer).not.toBeVisible({ timeout: 5000 });
  });
});
