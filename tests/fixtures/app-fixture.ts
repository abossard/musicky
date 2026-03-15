import { test as base, expect, type Page } from '@playwright/test';
import { NavigationHelper } from '../pages/navigation';
import { DJSetsPage } from '../pages/dj-sets-page';
import { MP3LibraryPage } from '../pages/mp3-library-page';
import { SettingsPage } from '../pages/settings-page';
import { ReviewChangesPage } from '../pages/review-changes-page';
import { FileBrowserPage } from '../pages/file-browser-page';
import { AudioPlayerPage } from '../pages/audio-player-page';
import { TagSyncPage } from '../pages/tag-sync-page';

type AppFixtures = {
  nav: NavigationHelper;
  djSetsPage: DJSetsPage;
  mp3LibraryPage: MP3LibraryPage;
  settingsPage: SettingsPage;
  reviewChangesPage: ReviewChangesPage;
  fileBrowserPage: FileBrowserPage;
  audioPlayerPage: AudioPlayerPage;
  tagSyncPage: TagSyncPage;
};

export const test = base.extend<AppFixtures>({
  nav: async ({ page }, use) => {
    await use(new NavigationHelper(page));
  },

  djSetsPage: async ({ page }, use) => {
    await use(new DJSetsPage(page));
  },

  mp3LibraryPage: async ({ page }, use) => {
    await use(new MP3LibraryPage(page));
  },

  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },

  reviewChangesPage: async ({ page }, use) => {
    await use(new ReviewChangesPage(page));
  },

  fileBrowserPage: async ({ page }, use) => {
    await use(new FileBrowserPage(page));
  },

  audioPlayerPage: async ({ page }, use) => {
    await use(new AudioPlayerPage(page));
  },

  tagSyncPage: async ({ page }, use) => {
    await use(new TagSyncPage(page));
  },
});

export { expect };

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}
