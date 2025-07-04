import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Pages to capture screenshots of
const pages = [
  { path: '/', name: 'homepage' },
  { path: '/file-browser', name: 'file-browser' },
  { path: '/mp3-demo', name: 'mp3-demo' },
  { path: '/mp3-library', name: 'mp3-library' },
  { path: '/review-changes', name: 'review-changes' },
  { path: '/audio-player', name: 'audio-player' },
  { path: '/settings', name: 'settings' },
  { path: '/todo', name: 'todo' },
];

async function captureScreenshots() {
  const baseUrl = 'http://localhost:3000';
  const screenshotsDir = './screenshots';

  // Create screenshots directory if it doesn't exist
  if (!existsSync(screenshotsDir)) {
    await mkdir(screenshotsDir, { recursive: true });
  }

  // Launch browser using system Chrome
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  for (const pageInfo of pages) {
    console.log(`Capturing screenshot for ${pageInfo.name}...`);
    
    try {
      await page.goto(`${baseUrl}${pageInfo.path}`, {
        waitUntil: 'networkidle',
        timeout: 10000,
      });

      // Wait a bit more for any animations or dynamic content
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: `${screenshotsDir}/${pageInfo.name}.png`,
        fullPage: true,
      });

      console.log(`✓ Screenshot saved: ${pageInfo.name}.png`);
    } catch (error) {
      console.error(`✗ Failed to capture ${pageInfo.name}:`, error.message);
    }
  }

  await browser.close();
  console.log('\nScreenshot capture completed!');
}

// Run the script
captureScreenshots().catch(console.error);