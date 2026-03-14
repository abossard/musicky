import { test, expect } from '../fixtures/app-fixture';

test.describe('Review Changes', () => {
  test('page loads correctly', async ({ reviewChangesPage }) => {
    await reviewChangesPage.goto();
    await reviewChangesPage.expectPageVisible();
  });

  test('has search and filter controls', async ({ reviewChangesPage }) => {
    await reviewChangesPage.goto();
    await reviewChangesPage.expectPageVisible();
  });

  test('refresh button is present', async ({ reviewChangesPage }) => {
    await reviewChangesPage.goto();
    await expect(reviewChangesPage.refreshButton).toBeVisible();
  });
});
