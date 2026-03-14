import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object for /audio-player — Audio player demo.
 */
export class AudioPlayerPage {
  readonly playPauseButton: Locator;
  readonly progressSlider: Locator;
  readonly muteButton: Locator;
  readonly timeDisplay: Locator;
  readonly errorAlert: Locator;

  constructor(private page: Page) {
    this.playPauseButton = page.getByRole('button', { name: /play|pause/i });
    this.progressSlider = page.locator('.mantine-Slider-root').first();
    this.muteButton = page.getByRole('button', { name: /mute|unmute|volume/i });
    this.timeDisplay = page.locator('text=/\\d+:\\d+/').first();
    this.errorAlert = page.locator('.mantine-Alert-root');
  }

  async goto() {
    await this.page.goto('/audio-player');
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.getByText('Audio Player Demo')).toBeVisible();
  }

  async play() {
    await this.page.getByRole('button', { name: 'Play' }).click();
  }

  async pause() {
    await this.page.getByRole('button', { name: 'Pause' }).click();
  }

  // --- Assertions ---

  async expectPageVisible() {
    await expect(this.page.getByText('Audio Player Demo')).toBeVisible();
  }

  async expectPlayerControls() {
    await expect(this.playPauseButton).toBeVisible();
  }

  async expectTimeDisplay() {
    await expect(this.timeDisplay).toBeVisible();
  }
}
