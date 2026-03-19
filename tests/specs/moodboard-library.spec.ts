import { test, expect } from '../fixtures/app-fixture';
import { searchQueries } from '../fixtures/test-data';

test.describe('Moodboard Library Panel', () => {
  test.beforeEach(async ({ moodboardPage }) => {
    await moodboardPage.goto();
    // Wait for library to finish loading (skeleton disappears, song items appear)
    await expect(moodboardPage.librarySongItems.first()).toBeVisible({ timeout: 15000 });
  });

  // --- Panel visibility ---

  test('library panel is visible by default', async ({ moodboardPage }) => {
    await moodboardPage.expectLibraryVisible();
  });

  test('can toggle library panel visibility', async ({ moodboardPage }) => {
    await moodboardPage.expectLibraryVisible();

    // Hide
    await moodboardPage.toggleLibraryButton.click();
    await moodboardPage.expectLibraryHidden();

    // Show again
    await moodboardPage.toggleLibraryButton.click();
    await moodboardPage.expectLibraryVisible();
  });

  // --- Search ---

  test('search input is present', async ({ moodboardPage }) => {
    await expect(moodboardPage.librarySearch).toBeVisible();
    await expect(moodboardPage.librarySearch).toHaveAttribute('placeholder', /search songs/i);
  });

  test('can search for songs', async ({ moodboardPage }) => {
    const initialCount = await moodboardPage.getSongCount();
    expect(initialCount).toBeGreaterThan(0);

    // Search for "ARTBAT" — several test-music files contain this artist
    await moodboardPage.searchSongs('ARTBAT');
    // Wait for debounce (300ms) + server response
    await moodboardPage.page.waitForTimeout(500);
    await expect(moodboardPage.librarySongItems.first()).toBeVisible({ timeout: 5000 });

    const searchCount = await moodboardPage.getSongCount();
    expect(searchCount).toBeGreaterThan(0);
    expect(searchCount).toBeLessThan(initialCount);
  });

  test('search shows results matching query', async ({ moodboardPage }) => {
    await moodboardPage.searchSongs('Anyma');
    await moodboardPage.page.waitForTimeout(500);
    await expect(moodboardPage.librarySongItems.first()).toBeVisible({ timeout: 5000 });

    // Every visible song item should contain "Anyma" in its text
    const count = await moodboardPage.librarySongItems.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(moodboardPage.librarySongItems.nth(i)).toContainText(/anyma/i);
    }
  });

  test('search shows empty state for no results', async ({ moodboardPage }) => {
    await moodboardPage.searchSongs(searchQueries.noResults[0]);
    await moodboardPage.page.waitForTimeout(500);

    // Song items should disappear; empty message should show
    await expect(moodboardPage.librarySongItems).toHaveCount(0, { timeout: 5000 });
    await expect(moodboardPage.libraryPanel.getByText(/no songs match/i)).toBeVisible();
  });

  test('search is debounced', async ({ moodboardPage }) => {
    const initialCount = await moodboardPage.getSongCount();

    // Type quickly — results should NOT update instantly
    await moodboardPage.librarySearch.fill('ARTBAT');
    // Immediately after typing, count should still be the full list
    // (debounce is 300ms, we check within ~50ms)
    const immediateCount = await moodboardPage.getSongCount();
    expect(immediateCount).toBe(initialCount);

    // After debounce settles, results should change
    await moodboardPage.page.waitForTimeout(600);
    await expect(moodboardPage.librarySongItems.first()).toBeVisible({ timeout: 5000 });
    const debouncedCount = await moodboardPage.getSongCount();
    expect(debouncedCount).toBeLessThan(initialCount);
  });

  test('clearing search restores full list', async ({ moodboardPage }) => {
    const initialCount = await moodboardPage.getSongCount();

    await moodboardPage.searchSongs('ARTBAT');
    await moodboardPage.page.waitForTimeout(500);
    await expect(moodboardPage.librarySongItems.first()).toBeVisible({ timeout: 5000 });
    const filteredCount = await moodboardPage.getSongCount();
    expect(filteredCount).toBeLessThan(initialCount);

    await moodboardPage.clearSearch();
    await moodboardPage.page.waitForTimeout(500);
    await expect(moodboardPage.librarySongItems.first()).toBeVisible({ timeout: 5000 });
    const restoredCount = await moodboardPage.getSongCount();
    expect(restoredCount).toBe(initialCount);
  });

  // --- Filters ---

  test('phase filter dropdown is present', async ({ moodboardPage }) => {
    await expect(moodboardPage.libraryPhaseFilter).toBeVisible();
  });

  test('genre filter dropdown is present', async ({ moodboardPage }) => {
    await expect(moodboardPage.libraryGenreFilter).toBeVisible();
  });

  test('mood filter dropdown is present', async ({ moodboardPage }) => {
    await expect(moodboardPage.libraryMoodFilter).toBeVisible();
  });

  test('filtering by phase reduces song list', async ({ moodboardPage }) => {
    const initialCount = await moodboardPage.getSongCount();
    expect(initialCount).toBeGreaterThan(0);

    // Filter by "peak" phase (seeded for artbat and dom dolla songs)
    await moodboardPage.filterByPhase('peak');
    // Tags are lazily loaded — wait for the filtered list to settle
    await moodboardPage.page.waitForTimeout(1000);

    const filteredCount = await moodboardPage.getSongCount();
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  // --- Song list ---

  test('displays songs with title and artist', async ({ moodboardPage }) => {
    const firstSong = moodboardPage.librarySongItems.first();
    await expect(firstSong).toBeVisible();

    // Each song item should have text content (title and artist rendered inside)
    const text = await firstSong.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('shows song count in footer', async ({ moodboardPage }) => {
    await expect(moodboardPage.librarySongCount).toBeVisible();
    const count = await moodboardPage.getSongCount();
    // Global setup seeds ~32 MP3 files from test-music folder
    expect(count).toBeGreaterThanOrEqual(10);
    await expect(moodboardPage.librarySongCount).toContainText(/\d+\s+songs/);
  });

  test('clicking a song selects it', async ({ moodboardPage }) => {
    await moodboardPage.selectSong(0);
    // Clicking a song opens the Song Detail drawer
    await moodboardPage.expectSongDetailVisible();
  });

  // --- Keyboard navigation ---

  test('arrow keys navigate song list', async ({ moodboardPage }) => {
    // Focus the library panel
    await moodboardPage.libraryPanel.click();

    // Press ArrowDown to move focus to first item
    await moodboardPage.page.keyboard.press('ArrowDown');
    const firstItem = moodboardPage.librarySongItems.nth(0);
    await expect(firstItem).toHaveAttribute('data-focused', 'true');

    // Press ArrowDown again to move to second item
    await moodboardPage.page.keyboard.press('ArrowDown');
    const secondItem = moodboardPage.librarySongItems.nth(1);
    await expect(secondItem).toHaveAttribute('data-focused', 'true');
    // First item should no longer be focused
    await expect(firstItem).toHaveAttribute('data-focused', 'false');

    // Press ArrowUp to go back to first
    await moodboardPage.page.keyboard.press('ArrowUp');
    await expect(firstItem).toHaveAttribute('data-focused', 'true');
  });

  test('Enter key selects focused song', async ({ moodboardPage }) => {
    // Focus library panel and navigate to first item
    await moodboardPage.libraryPanel.click();
    await moodboardPage.page.keyboard.press('ArrowDown');
    await expect(moodboardPage.librarySongItems.nth(0)).toHaveAttribute('data-focused', 'true');

    // Press Enter to select the focused song
    await moodboardPage.page.keyboard.press('Enter');
    // Should open Song Detail drawer
    await moodboardPage.expectSongDetailVisible();
  });

  // --- Drag ---

  test('songs are draggable', async ({ moodboardPage }) => {
    const count = await moodboardPage.librarySongItems.count();
    expect(count).toBeGreaterThan(0);

    // Verify all song items have the draggable attribute
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(moodboardPage.librarySongItems.nth(i)).toHaveAttribute('draggable', 'true');
    }
  });
});
