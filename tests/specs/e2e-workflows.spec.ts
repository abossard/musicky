import { test, expect, uniqueName } from '../fixtures/app-fixture';

test.describe('End-to-End Workflows', () => {
  // Tests that add songs via search require MP3 files indexed in the database.
  // Run after library scan: npx playwright test -g "@needs-library"
  test.describe.skip('Song workflows @needs-library', () => {
    test('complete DJ set creation workflow', async ({ djSetsPage, page }) => {
      await djSetsPage.goto();
      const name = uniqueName('E2E Set');
      const desc = 'End to end test set';

      await djSetsPage.createSet(name, desc);
      await expect(page.getByText(desc)).toBeVisible();

      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.expectSongCount(2);

      await djSetsPage.removeSong(0);
      await djSetsPage.expectSongCount(1);

      const newName = uniqueName('E2E Updated');
      await djSetsPage.editSet(newName, 'Updated description');
      await expect(page.getByText('Updated description')).toBeVisible();
    });

    test('multi-set management', async ({ djSetsPage }) => {
      await djSetsPage.goto();
      const set1 = uniqueName('Multi A');
      const set2 = uniqueName('Multi B');

      await djSetsPage.createSet(set1);
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.expectSongCount(2);

      await djSetsPage.createSet(set2);
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.expectSongCount(1);

      await djSetsPage.selectSet(set1);
      await djSetsPage.expectSongCount(2);
    });

    test('delete and recreate workflow', async ({ djSetsPage, page }) => {
      await djSetsPage.goto();
      const name = uniqueName('Lifecycle');

      await djSetsPage.createSet(name);
      await djSetsPage.addSongViaSearch('test');
      await djSetsPage.expectSongCount(1);

      await djSetsPage.deleteSet();

      await djSetsPage.createSet(name);
      await expect(page.getByText('Songs in Set')).toBeVisible();
    });
  });

  test('DJ set mode from library', async ({ djSetsPage, mp3LibraryPage, page }) => {
    test.setTimeout(120000);
    const name = uniqueName('Library Flow');
    await djSetsPage.goto();
    await djSetsPage.createSet(name);

    await mp3LibraryPage.goto();
    await mp3LibraryPage.enableDJSetMode();
    await mp3LibraryPage.activeSetSelector.click();
    await expect(page.getByRole('option', { name })).toBeVisible();
  });

  test('data persists across page refresh', async ({ djSetsPage, page }) => {
    await djSetsPage.goto();
    const name = uniqueName('Persist');
    await djSetsPage.createSet(name, 'Persistence test');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await djSetsPage.selectSet(name);
    await expect(page.getByText('Songs in Set')).toBeVisible();
  });
});
