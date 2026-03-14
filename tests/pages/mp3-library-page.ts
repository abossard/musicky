import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object for /mp3-library — MP3 Library with DJ Set integration.
 */
export class MP3LibraryPage {
  readonly djSetModeToggle: Locator;
  readonly activeSetSelector: Locator;
  readonly addToSetButton: Locator;
  readonly clearSelectionButton: Locator;
  readonly refreshButton: Locator;
  readonly checkboxes: Locator;

  constructor(private page: Page) {
    this.djSetModeToggle = page.getByTestId('dj-set-mode-toggle');
    this.activeSetSelector = page.getByTestId('active-set-selector');
    this.addToSetButton = page.getByTestId('add-to-set-button');
    this.clearSelectionButton = page.getByTestId('clear-selection-button');
    this.refreshButton = page.getByRole('button', { name: /refresh/i });
    this.checkboxes = page.locator('input[type="checkbox"]');
  }

  async goto() {
    await this.page.goto('/mp3-library');
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.getByText('MP3 Library').first()).toBeVisible();
  }

  async waitForLibraryLoaded() {
    // The DJ set toggle only appears after the library finishes scanning
    await expect(
      this.page.getByText('Loading MP3 library')
    ).not.toBeVisible({ timeout: 30000 }).catch(() => {
      // If loading text was never there, that's fine
    });
  }

  async enableDJSetMode() {
    await this.waitForLibraryLoaded();
    await this.djSetModeToggle.click();
    await expect(this.activeSetSelector).toBeVisible({ timeout: 10000 });
  }

  async disableDJSetMode() {
    await this.djSetModeToggle.click();
    await expect(this.activeSetSelector).not.toBeVisible({ timeout: 10000 });
  }

  async selectActiveSet(name: string) {
    await this.activeSetSelector.click();
    await this.page.getByRole('option', { name }).click();
  }

  async selectSongs(count: number) {
    for (let i = 0; i < count; i++) {
      await this.checkboxes.nth(i).check();
    }
  }

  async addSelectedToSet() {
    await this.addToSetButton.click();
  }

  async clearSelection() {
    await this.clearSelectionButton.click();
  }

  // --- Assertions ---

  async expectPageVisible() {
    await expect(this.page.getByText('MP3 Library').first()).toBeVisible();
  }

  async expectLoading() {
    await expect(this.page.getByText('Loading MP3 library')).toBeVisible();
  }

  async expectFileCount(count: number) {
    await expect(this.page.getByText(`Found ${count} MP3 file`)).toBeVisible();
  }

  async expectNoFiles() {
    await expect(this.page.getByText('No MP3 files found')).toBeVisible();
  }

  async expectSelectionCount(count: number) {
    await expect(this.page.getByText(`${count} selected`)).toBeVisible();
  }

  async expectDJSetModeActive() {
    await expect(this.activeSetSelector).toBeVisible({ timeout: 10000 });
  }

  async expectDJSetModeInactive() {
    await expect(this.activeSetSelector).not.toBeVisible({ timeout: 10000 });
  }
}
