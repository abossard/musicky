import { test, expect } from '../fixtures/app-fixture';

test.describe('Settings', () => {
  test.beforeEach(async ({ settingsPage }) => {
    await settingsPage.goto();
  });

  test('page loads with correct sections', async ({ settingsPage }) => {
    await settingsPage.expectPageVisible();
    await settingsPage.expectPlaybackSettingsVisible();
    await settingsPage.expectLibraryPhasesVisible();
  });

  test('keep play head checkbox is present', async ({ settingsPage }) => {
    await expect(settingsPage.keepPlayHeadCheckbox).toBeVisible();
  });

  test('can toggle keep play head setting', async ({ settingsPage }) => {
    const wasChecked = await settingsPage.keepPlayHeadCheckbox.isChecked();
    await settingsPage.toggleKeepPlayHead();

    if (wasChecked) {
      await settingsPage.expectKeepPlayHeadChecked(false);
    } else {
      await settingsPage.expectKeepPlayHeadChecked(true);
    }
  });

  test('phase management section is visible', async ({ settingsPage }) => {
    await settingsPage.expectLibraryPhasesVisible();
  });
});
