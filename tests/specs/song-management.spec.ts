import { test, expect, uniqueName } from '../fixtures/app-fixture';

test.describe('Song Search & Management', () => {
  let setName: string;

  test.beforeEach(async ({ djSetsPage }) => {
    setName = uniqueName('Song Test');
    await djSetsPage.goto();
    await djSetsPage.createSet(setName);
    // Set is auto-selected after creation — "Songs in Set" visible
  });

  test.describe('Search Popup', () => {
    test('opens when clicking add song', async ({ djSetsPage }) => {
      await djSetsPage.openSearchPopup();
      await expect(djSetsPage.searchPopup).toBeVisible();
      await expect(djSetsPage.searchInput).toBeVisible();
    });

    test('search input is auto-focused', async ({ djSetsPage }) => {
      await djSetsPage.openSearchPopup();
      await expect(djSetsPage.searchInput).toBeFocused();
    });

    test('closes with Escape key', async ({ djSetsPage, page }) => {
      await djSetsPage.openSearchPopup();
      await page.keyboard.press('Escape');
      await expect(djSetsPage.searchPopup).not.toBeVisible();
    });

    test('shows minimum character message for short query', async ({ djSetsPage, page }) => {
      await djSetsPage.openSearchPopup();
      await djSetsPage.searchInput.fill('a');
      await expect(page.getByText('Type at least 2 characters')).toBeVisible();
    });

    test('shows no results for nonexistent query', async ({ djSetsPage, page }) => {
      await djSetsPage.openSearchPopup();
      await djSetsPage.searchInput.fill('xyzabc123nonexistent');
      // Wait for search to complete — might show "No songs found" or "Searching..."
      await expect(
        page.getByText('No songs found').or(page.getByText('Searching'))
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // Song add/remove/insert tests require MP3 files indexed in mp3_file_cache.
  // Run these after the library has been scanned: npx playwright test -g "Adding Songs"
  test.describe.skip('Adding Songs @needs-library', () => {

    test('can add a song via search', async ({ djSetsPage, page }) => {
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.expectSongCount(1);
      await expect(page.getByText('#1')).toBeVisible();
    });

    test('can add multiple songs', async ({ djSetsPage, page }) => {
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.expectSongCount(2);
      await expect(page.getByText('#1')).toBeVisible();
      await expect(page.getByText('#2')).toBeVisible();
    });

    test('empty set shows add first song button', async ({ djSetsPage }) => {
      await djSetsPage.expectEmptySet();
      await expect(djSetsPage.addFirstSongButton).toBeVisible();
    });
  });

  test.describe.skip('Removing Songs @needs-library', () => {
    test('can remove a song', async ({ djSetsPage }) => {
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.expectSongCount(1);
      await djSetsPage.removeSong(0);
      await djSetsPage.expectEmptySet();
    });

    test('removing renumbers remaining songs', async ({ djSetsPage, page }) => {
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.removeSong(1);
      await expect(page.getByText('#1')).toBeVisible();
      await expect(page.getByText('#2')).toBeVisible();
      await expect(page.getByText('#3')).not.toBeVisible();
    });
  });

  test.describe.skip('Song Insertion @needs-library', () => {
    test('can insert song at specific position', async ({ djSetsPage, page }) => {
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.insertSongAfter(0, 'test');
      await djSetsPage.expectSongCount(3);
      await expect(page.getByText('#1')).toBeVisible();
      await expect(page.getByText('#2')).toBeVisible();
      await expect(page.getByText('#3')).toBeVisible();
    });

    test('add-after button appears on each song', async ({ djSetsPage }) => {
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.addSongViaSearch('test');
      await expect(djSetsPage.addAfterButtons).toHaveCount(2);
    });
  });
});
