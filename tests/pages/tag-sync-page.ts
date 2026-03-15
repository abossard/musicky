import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Tag Sync page (/tag-sync).
 */
export class TagSyncPage {
  readonly heading: Locator;
  readonly exportTab: Locator;
  readonly importTab: Locator;
  readonly scanLibraryBtn: Locator;
  readonly scanFilesBtn: Locator;
  readonly applyBtn: Locator;
  readonly diffCards: Locator;
  readonly noChangesText: Locator;
  readonly errorAlert: Locator;
  readonly loader: Locator;

  constructor(private page: Page) {
    this.heading = page.getByText('Tag Sync');
    this.exportTab = page.getByRole('tab', { name: /Export to Files/i });
    this.importTab = page.getByRole('tab', { name: /Import from Files/i });
    this.scanLibraryBtn = page.getByRole('button', { name: /Scan Library/i });
    this.scanFilesBtn = page.getByRole('button', { name: /Scan Files/i });
    this.applyBtn = page.getByRole('button', { name: /Apply/i });
    this.diffCards = page.locator('.diff-card');
    this.noChangesText = page.getByText(/No differences found|No µ: tags found/i);
    this.errorAlert = page.locator('.mantine-Alert-root');
    this.loader = page.locator('.mantine-Loader-root');
  }

  async goto() {
    await this.page.goto('/tag-sync');
    await expect(this.heading.first()).toBeVisible({ timeout: 15000 });
  }

  async switchToExportTab() {
    await this.exportTab.click();
    await this.page.waitForTimeout(300);
  }

  async switchToImportTab() {
    await this.importTab.click();
    await this.page.waitForTimeout(300);
  }

  async scanExport() {
    await this.scanLibraryBtn.click();
    // Wait for scan to complete (loader appears then disappears)
    await this.page.waitForTimeout(500);
    await this.waitForScanComplete();
  }

  async scanImport() {
    await this.scanFilesBtn.click();
    await this.page.waitForTimeout(500);
    await this.waitForScanComplete();
  }

  private async waitForScanComplete() {
    // Wait for loader to go away (if it appeared) or for content to appear
    try {
      await expect(this.loader).toBeHidden({ timeout: 120000 });
    } catch {
      // Loader may have already disappeared
    }
    await this.page.waitForTimeout(500);
  }

  async getDiffCardCount(): Promise<number> {
    return await this.diffCards.count();
  }

  async getApplyButtonText(): Promise<string> {
    return await this.applyBtn.textContent() || '';
  }

  async clickApply() {
    await this.applyBtn.click();
    await this.waitForScanComplete();
  }

  async screenshot(name: string) {
    await this.page.screenshot({ path: `test-results/tag-sync-${name}.png`, fullPage: true });
  }
}
