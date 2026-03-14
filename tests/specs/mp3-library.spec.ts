import { test, expect, uniqueName } from '../fixtures/app-fixture';

test.describe('MP3 Library', () => {
  // Library scanning can take >30s depending on music folder size
  test.setTimeout(120000);

  // Library scanning depends on the music folder size — can exceed 2 min
  test.describe('Page Loading', () => {
    test('page loads with heading and library or file browser', async ({ mp3LibraryPage, page }) => {
      await mp3LibraryPage.goto();
      await mp3LibraryPage.expectPageVisible();
    });
  });

  test.describe('DJ Set Mode @needs-library', () => {
    test.beforeEach(async ({ mp3LibraryPage }) => {
      await mp3LibraryPage.goto();
      await mp3LibraryPage.waitForLibraryLoaded();
    });
    test('toggle enables DJ set controls', async ({ mp3LibraryPage }) => {
      await mp3LibraryPage.goto();
      await mp3LibraryPage.expectDJSetModeInactive();
      await mp3LibraryPage.enableDJSetMode();
      await mp3LibraryPage.expectDJSetModeActive();
    });

    test('toggle disables DJ set controls', async ({ mp3LibraryPage }) => {
      await mp3LibraryPage.goto();
      await mp3LibraryPage.enableDJSetMode();
      await mp3LibraryPage.disableDJSetMode();
      await mp3LibraryPage.expectDJSetModeInactive();
    });

    test('active set selector shows available sets', async ({ djSetsPage, mp3LibraryPage, page }) => {
      // Create a set first
      const name = uniqueName('Library Set');
      await djSetsPage.goto();
      await djSetsPage.createSet(name);

      // Go to library and check
      await mp3LibraryPage.goto();
      await mp3LibraryPage.enableDJSetMode();
      await mp3LibraryPage.activeSetSelector.click();
      await expect(page.getByRole('option', { name })).toBeVisible();
    });
  });

  test.describe('Cross-Page Integration', () => {
    test('data persists across navigation', async ({ djSetsPage, mp3LibraryPage, page }) => {
      const name = uniqueName('Cross Page');
      await djSetsPage.goto();
      await djSetsPage.createSet(name);

      await mp3LibraryPage.goto();
      await mp3LibraryPage.enableDJSetMode();
      await mp3LibraryPage.activeSetSelector.click();
      await expect(page.getByRole('option', { name })).toBeVisible();
    });

    test('navigation between pages works', async ({ nav, page }) => {
      await nav.goToDJSets();
      await expect(page.getByRole('heading', { name: 'DJ Set Management' })).toBeVisible();

      await nav.goToMP3Library();
      await expect(page.getByText('MP3 Library').first()).toBeVisible();

      await nav.goToDJSets();
      await expect(page.getByRole('heading', { name: 'DJ Set Management' })).toBeVisible();
    });
  });
});
