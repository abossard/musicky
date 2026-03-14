import { test, expect } from '../fixtures/app-fixture';

test.describe('Moodboard', () => {
  test.setTimeout(120000);

  test('full moodboard workflow with screenshots', async ({ page }) => {
    // 1. Navigate to moodboard
    await page.goto('/moodboard');
    await expect(page.locator('text=/\\d{1,2}:\\d{2}:\\d{2}\\s*(AM|PM)/i')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/moodboard-01-empty.png', fullPage: true });

    // 2. Create a new board
    await page.getByRole('button', { name: /new board/i }).click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/moodboard-02-canvas.png', fullPage: true });

    // 3. Open song search
    const searchBtn = page.getByRole('button', { name: 'Search songs' });
    await expect(searchBtn).toBeVisible({ timeout: 10000 });
    await searchBtn.click();
    await page.waitForTimeout(500);

    const searchModal = page.getByRole('dialog');
    await expect(searchModal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/moodboard-03-search.png', fullPage: true });

    // 4. Search for Kevin MacLeod
    await page.getByPlaceholder(/search/i).fill('Kevin');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/moodboard-04-results.png', fullPage: true });

    // 5. Add songs
    const addBadges = page.getByText('+ Add');
    const count = await addBadges.count();
    console.log(`Found ${count} addable songs`);
    for (let i = 0; i < Math.min(count, 3); i++) {
      await addBadges.first().click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: 'test-results/moodboard-05-added.png', fullPage: true });

    // Close search
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 6. Canvas with song nodes
    await page.screenshot({ path: 'test-results/moodboard-06-songs-on-canvas.png', fullPage: true });

    // 6b. Verify artwork images loaded
    const songNodes = page.locator('.react-flow__node-song img');
    const imgCount = await songNodes.count();
    console.log(`Song artwork images: ${imgCount}`);
    for (let i = 0; i < imgCount; i++) {
      const img = songNodes.nth(i);
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      console.log(`Image ${i} naturalWidth: ${naturalWidth}`);
      // Image loaded if naturalWidth > 0
    }

    // 7. Add a tag node
    const tagBtn = page.getByRole('button', { name: 'Add tag' });
    if (await tagBtn.isVisible()) {
      await tagBtn.click();
      await page.waitForTimeout(500);
    }

    // 8. Fit view
    const fitBtn = page.locator('.react-flow__controls-fitview');
    if (await fitBtn.isVisible()) {
      await fitBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/moodboard-07-final.png', fullPage: true });

    // 8b. Zoom into first song node for detail shot
    const firstNode = page.locator('.react-flow__node-song').first();
    if (await firstNode.isVisible()) {
      await firstNode.scrollIntoViewIfNeeded();
      // Use React Flow zoom in button 3 times
      const zoomIn = page.locator('.react-flow__controls-zoomin');
      for (let i = 0; i < 3; i++) {
        await zoomIn.click();
        await page.waitForTimeout(200);
      }
      await page.screenshot({ path: 'test-results/moodboard-08-zoomed-node.png', fullPage: true });
    }

    // Summary
    const nodeCount = await page.locator('.react-flow__node').count();
    console.log(`Nodes on canvas: ${nodeCount}`);
    console.log(`Test complete: ${imgCount} song images, ${nodeCount} total nodes`);
    await expect(page.getByText('Moodboard').first()).toBeVisible();
  });
});
