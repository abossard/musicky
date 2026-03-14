import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Shared navigation helper — works on any page via the AppShell sidebar.
 */
export class NavigationHelper {
  readonly sidebar: Locator;
  readonly burger: Locator;
  readonly navLinks: {
    djSets: Locator;
    mp3Library: Locator;
    reviews: Locator;
    settings: Locator;
  };
  readonly statusBadge: Locator;
  readonly appTitle: Locator;

  constructor(private page: Page) {
    this.sidebar = page.locator('nav');
    this.burger = page.locator('.mantine-Burger-root');
    this.navLinks = {
      djSets: page.getByRole('link', { name: 'DJ Sets' }),
      mp3Library: page.getByRole('link', { name: 'MP3 Library' }),
      reviews: page.getByRole('link', { name: 'Reviews' }),
      settings: page.getByRole('link', { name: 'Settings' }),
    };
    this.statusBadge = page.locator('.mantine-Badge-root');
    this.appTitle = page.getByText('Musicky');
  }

  async goto(path: string) {
    await this.page.goto(path);
    // Wait for React hydration — the live clock only renders after JS runs
    await expect(
      this.page.locator('text=/\\d{1,2}:\\d{2}:\\d{2}\\s*(AM|PM)/i')
    ).toBeVisible({ timeout: 15000 });
  }

  async goToDJSets() {
    await this.goto('/dj-sets');
  }

  async goToMP3Library() {
    await this.goto('/mp3-library');
  }

  async goToSettings() {
    await this.goto('/settings');
  }

  async goToReviewChanges() {
    await this.goto('/review-changes');
  }

  async goToFileBrowser() {
    await this.goto('/file-browser');
  }

  async goToAudioPlayer() {
    await this.goto('/audio-player');
  }

  async goHome() {
    await this.goto('/');
  }

  async openMobileMenu() {
    if (await this.burger.isVisible()) {
      await this.burger.click();
    }
  }

  async navigateViaLink(link: Locator) {
    if (await this.burger.isVisible()) {
      await this.burger.click();
    }
    await link.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectNavLinksVisible() {
    for (const link of Object.values(this.navLinks)) {
      await expect(link).toBeVisible();
    }
  }
}
