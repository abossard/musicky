import { test as base } from '@playwright/test';
import { NavigationHelper } from '../pages/navigation';
import { SetViewPage } from '../pages/set-view-page';
import { SettingsPage } from '../pages/settings-page';

type AppFixtures = {
  nav: NavigationHelper;
  setViewPage: SetViewPage;
  settingsPage: SettingsPage;
};

export const test = base.extend<AppFixtures>({
  nav: async ({ page }, use) => {
    await use(new NavigationHelper(page));
  },

  setViewPage: async ({ page }, use) => {
    await use(new SetViewPage(page));
  },

  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});

export { expect } from '@playwright/test';

export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}
