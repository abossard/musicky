import { test as base } from '@playwright/test';
import { NavigationHelper } from '../pages/navigation';
import { MoodboardPage } from '../pages/moodboard-page';
import { SettingsPage } from '../pages/settings-page';

type AppFixtures = {
  nav: NavigationHelper;
  moodboardPage: MoodboardPage;
  settingsPage: SettingsPage;
};

export const test = base.extend<AppFixtures>({
  nav: async ({ page }, use) => {
    await use(new NavigationHelper(page));
  },

  moodboardPage: async ({ page }, use) => {
    await use(new MoodboardPage(page));
  },

  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});

export { expect } from '@playwright/test';

export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}
