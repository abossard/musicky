import { type Page, type Locator, expect } from '@playwright/test';

export class SetViewPage {
  readonly page: Page;
  readonly toolbar: Locator;
  readonly phaseColumns: Locator;
  readonly songCards: Locator;
  readonly tagPalette: Locator;
  readonly shortcutHelp: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toolbar = page.locator('.set-view-toolbar');
    this.phaseColumns = page.locator('[data-testid^="phase-column-"]');
    this.songCards = page.locator('[data-testid="set-song-card"]');
    this.tagPalette = page.locator('.tag-palette-sidebar'); // adjust class if different
    this.shortcutHelp = page.getByRole('dialog', { name: /shortcut|keyboard/i });
  }

  async goto() {
    await this.page.goto('/moodboard');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForReady(timeout = 15000) {
    await expect(this.toolbar).toBeVisible({ timeout });
  }

  async getSongCount() {
    return this.songCards.count();
  }
}
