import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object for /review-changes — Pending edits review.
 */
export class ReviewChangesPage {
  readonly searchInput: Locator;
  readonly hideAppliedToggle: Locator;
  readonly refreshButton: Locator;
  readonly applyButtons: Locator;
  readonly rejectButtons: Locator;
  readonly undoButtons: Locator;
  readonly editRows: Locator;

  constructor(private page: Page) {
    this.searchInput = page.getByRole('textbox');
    this.hideAppliedToggle = page.locator('.mantine-Switch-root');
    this.refreshButton = page.getByRole('button', { name: /refresh/i });
    this.applyButtons = page.getByRole('button', { name: /apply/i });
    this.rejectButtons = page.getByRole('button', { name: /reject/i });
    this.undoButtons = page.getByRole('button', { name: /undo/i });
    this.editRows = page.locator('tr').or(page.locator('.mantine-Table-tr'));
  }

  async goto() {
    await this.page.goto('/review-changes');
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.getByText('Review Changes').first()).toBeVisible();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  async toggleHideApplied() {
    await this.hideAppliedToggle.click();
  }

  async refresh() {
    await this.refreshButton.click();
  }

  // --- Assertions ---

  async expectPageVisible() {
    await expect(this.page.getByText('Review Changes').first()).toBeVisible();
  }

  async expectNoEdits() {
    await expect(this.page.getByText(/no pending/i).or(this.page.getByText('0'))).toBeVisible();
  }

  async expectEditVisible(filePath: string) {
    await expect(this.page.getByText(filePath, { exact: false })).toBeVisible();
  }
}
