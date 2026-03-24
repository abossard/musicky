import { test, expect } from '../fixtures/app-fixture';

test.describe('Moodboard Revision History', () => {
  test.beforeEach(async ({ moodboardPage }) => {
    await moodboardPage.goto();
    await moodboardPage.waitForCanvasReady();
  });

  test('revision badge is visible in the toolbar', async ({ moodboardPage }) => {
    await expect(moodboardPage.revisionBadge).toBeVisible({ timeout: 10000 });
  });

  test('clicking revision badge opens revision browser modal', async ({ moodboardPage }) => {
    await moodboardPage.openRevisionBrowser();
    await moodboardPage.expectRevisionBrowserVisible();
    // Modal title should say "Revision History"
    const title = moodboardPage.revisionBrowser.getByText('Revision History');
    await expect(title).toBeVisible();
  });

  test('revision browser shows empty state or revision list', async ({ moodboardPage }) => {
    await moodboardPage.openRevisionBrowser();
    // Wait for the loader to disappear (content has loaded)
    await expect(moodboardPage.revisionBrowser.locator('.mantine-Loader-root')).not.toBeVisible({ timeout: 10000 });

    // Depending on test order, the DB may have revisions from other tests.
    // Verify the modal shows either the empty message or actual revision entries.
    const emptyText = moodboardPage.revisionBrowser.getByText('No revisions yet');
    const restoreButtons = moodboardPage.revisionRestoreButtons;

    const hasEmpty = await emptyText.isVisible().catch(() => false);
    const revisionCount = await restoreButtons.count();
    // Valid: either empty state shown, or revision entries present
    expect(hasEmpty || revisionCount > 0).toBeTruthy();
  });

  test('revision browser can be closed with Escape', async ({ moodboardPage }) => {
    await moodboardPage.openRevisionBrowser();
    await moodboardPage.expectRevisionBrowserVisible();
    await moodboardPage.closeRevisionBrowser();
    await moodboardPage.expectRevisionBrowserHidden();
  });

  test('revision browser can be reopened after closing', async ({ moodboardPage }) => {
    // Open, close, and reopen to verify modal lifecycle
    await moodboardPage.openRevisionBrowser();
    await moodboardPage.expectRevisionBrowserVisible();
    await moodboardPage.closeRevisionBrowser();
    await moodboardPage.expectRevisionBrowserHidden();

    // Reopen
    await moodboardPage.openRevisionBrowser();
    await moodboardPage.expectRevisionBrowserVisible();
  });

  test('revision browser displays revision entries when revisions exist', async ({ moodboardPage, page }) => {
    // Create a revision via Telefunc RPC (the UI save flow doesn't call onSaveBoard yet)
    // Create a revision via Telefunc RPC endpoint
    await page.evaluate(async () => {
      await fetch('/_telefunc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: '/components/Moodboard/Moodboard.telefunc.ts',
          name: 'onSaveBoard',
          args: [1, [], JSON.stringify({ x: 0, y: 0, zoom: 1 })],
        }),
      });
    });

    // Reload to pick up the new revision count
    await moodboardPage.goto();
    await moodboardPage.waitForCanvasReady();
    await moodboardPage.openRevisionBrowser();

    // Should show at least one revision entry with a Restore button
    await expect(moodboardPage.revisionRestoreButtons.first()).toBeVisible({ timeout: 10000 });

    // Verify a version badge like "v1" is present
    const versionBadge = moodboardPage.revisionBrowser.locator('.mantine-Badge-root').first();
    await expect(versionBadge).toBeVisible();
    await expect(versionBadge).toContainText(/v\d+/);

    // Each revision entry should display node and edge counts
    const nodesText = moodboardPage.revisionBrowser.getByText(/\d+ nodes/);
    const edgesText = moodboardPage.revisionBrowser.getByText(/\d+ edges/);
    await expect(nodesText.first()).toBeVisible();
    await expect(edgesText.first()).toBeVisible();
  });
});
