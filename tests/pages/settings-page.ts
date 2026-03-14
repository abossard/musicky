import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object for /settings — Application settings.
 */
export class SettingsPage {
  readonly keepPlayHeadCheckbox: Locator;
  readonly newPhaseInput: Locator;
  readonly addPhaseButton: Locator;

  constructor(private page: Page) {
    this.keepPlayHeadCheckbox = page.getByRole('checkbox', { name: /keep play head/i });
    this.newPhaseInput = page.getByPlaceholder(/new phase/i);
    this.addPhaseButton = page.getByRole('button', { name: /add phase/i });
  }

  async goto() {
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');
    // Wait for settings to finish loading
    await expect(this.keepPlayHeadCheckbox).toBeVisible({ timeout: 15000 });
  }

  async toggleKeepPlayHead() {
    await this.keepPlayHeadCheckbox.click();
  }

  async addPhase(name: string) {
    await this.newPhaseInput.fill(name);
    await this.addPhaseButton.click();
  }

  async removePhase(name: string) {
    const phaseButton = this.page.getByRole('button', { name: new RegExp(`${name}.*×`) });
    const removeBtn = phaseButton.getByRole('button', { name: '×' });
    await removeBtn.click();
  }

  // --- Assertions ---

  async expectPageVisible() {
    await expect(this.keepPlayHeadCheckbox).toBeVisible();
  }

  async expectPlaybackSettingsVisible() {
    await expect(this.page.getByText('Playback Settings')).toBeVisible();
  }

  async expectLibraryPhasesVisible() {
    await expect(this.page.getByText('Library Phases')).toBeVisible();
  }

  async expectPhaseVisible(name: string) {
    await expect(this.page.getByText(name)).toBeVisible();
  }

  async expectPhaseNotVisible(name: string) {
    await expect(this.page.getByText(name)).not.toBeVisible();
  }

  async expectKeepPlayHeadChecked(checked: boolean) {
    if (checked) {
      await expect(this.keepPlayHeadCheckbox).toBeChecked();
    } else {
      await expect(this.keepPlayHeadCheckbox).not.toBeChecked();
    }
  }
}
