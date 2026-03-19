import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Shared navigation helper — works on any page via the AppShell sidebar.
 */
export class NavigationHelper {
  readonly sidebar: Locator;
  readonly burger: Locator;
  readonly navLinks: {
    moodboard: Locator;
    settings: Locator;
  };
  readonly statusBadge: Locator;
  readonly appTitle: Locator;

  constructor(private page: Page) {
    this.sidebar = page.locator('nav');
    this.burger = page.locator('.mantine-Burger-root');
    this.navLinks = {
      moodboard: page.getByRole('link', { name: 'Moodboard' }),
      settings: page.getByRole('link', { name: 'Settings' }),
    };
    this.statusBadge = page.locator('.mantine-Badge-root');
    this.appTitle = page.getByText('Musicky');
  }

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async goToMoodboard() {
    await this.goto('/moodboard');
  }

  async goToSettings() {
    await this.goto('/settings');
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
