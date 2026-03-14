import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object for /file-browser — File browser demo.
 */
export class FileBrowserPage {
  readonly searchInput: Locator;
  readonly backButton: Locator;
  readonly refreshButton: Locator;
  readonly hiddenFilesToggle: Locator;
  readonly extensionFilter: Locator;
  readonly useFolderButton: Locator;
  readonly fileRows: Locator;
  readonly breadcrumbs: Locator;

  constructor(private page: Page) {
    this.searchInput = page.getByPlaceholder(/search/i);
    this.backButton = page.getByRole('button', { name: '⬆️' }).or(page.getByText('⬆️'));
    this.refreshButton = page.getByRole('button', { name: '🔄' }).or(page.getByText('🔄'));
    this.hiddenFilesToggle = page.getByText('Show hidden files');
    this.extensionFilter = page.locator('.mantine-MultiSelect-root');
    this.useFolderButton = page.getByRole('button', { name: /use this folder/i });
    this.fileRows = page.locator('tr').or(page.locator('.mantine-Table-tr'));
    this.breadcrumbs = page.locator('.mantine-Breadcrumbs-root');
  }

  async goto() {
    await this.page.goto('/file-browser');
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.getByText('File Browser')).toBeVisible();
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  async navigateBack() {
    await this.backButton.click();
  }

  async refresh() {
    await this.refreshButton.click();
  }

  // --- Assertions ---

  async expectPageVisible() {
    await expect(this.page.getByText('File Browser')).toBeVisible();
  }

  async expectItemCount(count: number) {
    await expect(this.page.getByText(`${count} items`)).toBeVisible();
  }

  async expectLoading() {
    await expect(this.page.getByText('Loading files')).toBeVisible();
  }
}
