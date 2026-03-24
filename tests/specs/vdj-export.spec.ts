import { test, expect } from '../fixtures/app-fixture';

test.describe('VDJ Export', () => {
  test.beforeEach(async ({ moodboardPage }) => {
    await moodboardPage.goto();
    await moodboardPage.waitForCanvasReady();
    await moodboardPage.openReview();
    await moodboardPage.expectReviewDrawerVisible();
  });

  test('VDJ Export tab exists in Review panel', async ({ moodboardPage }) => {
    const drawer = moodboardPage.reviewDrawer;
    const vdjTab = drawer.locator('[data-testid="vdj-export-tab"]');
    await expect(vdjTab).toBeVisible();
    await expect(drawer.getByRole('tab', { name: /vdj export/i })).toBeVisible();
  });

  test('Preview button is present after clicking VDJ Export tab', async ({ moodboardPage }) => {
    const drawer = moodboardPage.reviewDrawer;
    await drawer.locator('[data-testid="vdj-export-tab"]').click();

    const previewBtn = drawer.locator('[data-testid="vdj-preview-btn"]');
    await expect(previewBtn).toBeVisible();
    await expect(previewBtn).toContainText(/preview vdj export/i);
  });

  test('Can click preview without error', async ({ moodboardPage }) => {
    const drawer = moodboardPage.reviewDrawer;
    await drawer.locator('[data-testid="vdj-export-tab"]').click();

    const previewBtn = drawer.locator('[data-testid="vdj-preview-btn"]');
    await previewBtn.click();

    // Preview may return empty results if no songs are tagged; just verify no crash
    await expect(drawer.locator('[data-testid="vdj-export-tab"]')).toBeVisible();
  });

  test('Export options checkboxes are present', async ({ moodboardPage }) => {
    const drawer = moodboardPage.reviewDrawer;
    await drawer.locator('[data-testid="vdj-export-tab"]').click();

    await expect(drawer.getByLabel(/write genre/i)).toBeVisible();
    await expect(drawer.getByLabel(/write comment/i)).toBeVisible();
    await expect(drawer.getByLabel(/write grouping/i)).toBeVisible();
    await expect(drawer.getByLabel(/write musicky tags/i)).toBeVisible();
  });

  test('Apply button appears after preview with diffs, or empty state shown', async ({ moodboardPage }) => {
    const drawer = moodboardPage.reviewDrawer;
    await drawer.locator('[data-testid="vdj-export-tab"]').click();

    // Click preview to scan for diffs
    await drawer.locator('[data-testid="vdj-preview-btn"]').click();

    // Wait for scan to finish — either diffs appear (with apply button) or empty state
    const applyBtn = drawer.locator('[data-testid="vdj-apply-btn"]');
    const emptyState = drawer.getByText(/no vdj export diffs found/i);

    await expect(applyBtn.or(emptyState)).toBeVisible();
  });
});
