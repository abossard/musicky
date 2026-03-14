import { test, expect } from '../fixtures/app-fixture';

test.describe('Audio Player', () => {
  test('demo page loads with player', async ({ audioPlayerPage }) => {
    await audioPlayerPage.goto();
    await audioPlayerPage.expectPageVisible();
  });

  test('player controls are visible', async ({ audioPlayerPage }) => {
    await audioPlayerPage.goto();
    await audioPlayerPage.expectPlayerControls();
  });

  test('time display is present', async ({ audioPlayerPage }) => {
    await audioPlayerPage.goto();
    await audioPlayerPage.expectTimeDisplay();
  });
});

test.describe('File Browser', () => {
  test('page loads with correct heading', async ({ fileBrowserPage }) => {
    await fileBrowserPage.goto();
    await fileBrowserPage.expectPageVisible();
  });
});
