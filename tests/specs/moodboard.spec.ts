import { test, expect } from '../fixtures/app-fixture';

test.describe('Moodboard', () => {
  test.setTimeout(120000);

  test('full moodboard workflow with real DJ tracks', async ({ page }) => {
    // 1. Navigate to moodboard
    await page.goto('/moodboard');
    await expect(page.locator('text=/\\d{1,2}:\\d{2}:\\d{2}\\s*(AM|PM)/i')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/moodboard-01-empty.png', fullPage: true });

    // 2. Create a new board
    await page.getByRole('button', { name: /new board/i }).click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/moodboard-02-canvas.png', fullPage: true });

    // 3. Open search and add ARTBAT tracks
    const searchBtn = page.getByRole('button', { name: 'Search songs' });
    await expect(searchBtn).toBeVisible({ timeout: 10000 });
    await searchBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder(/search/i).fill('ARTBAT');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/moodboard-03-search-artbat.png', fullPage: true });

    // Add all ARTBAT results
    let addBadges = page.getByText('+ Add');
    let count = await addBadges.count();
    console.log(`ARTBAT results: ${count}`);
    for (let i = 0; i < Math.min(count, 5); i++) {
      await addBadges.first().click();
      await page.waitForTimeout(600);
    }

    // Search for Anyma tracks
    await page.getByPlaceholder(/search/i).clear();
    await page.getByPlaceholder(/search/i).fill('Anyma');
    await page.waitForTimeout(2000);
    addBadges = page.getByText('+ Add');
    count = await addBadges.count();
    console.log(`Anyma results: ${count}`);
    for (let i = 0; i < Math.min(count, 3); i++) {
      await addBadges.first().click();
      await page.waitForTimeout(600);
    }

    // Search for more varied artists
    for (const query of ['Odd Mob', 'Sofi Tukker', 'Dom Dolla', 'Adriatique', 'Super Flu']) {
      await page.getByPlaceholder(/search/i).clear();
      await page.getByPlaceholder(/search/i).fill(query);
      await page.waitForTimeout(1500);
      addBadges = page.getByText('+ Add');
      if (await addBadges.count() > 0) {
        await addBadges.first().click();
        await page.waitForTimeout(600);
      }
    }

    await page.screenshot({ path: 'test-results/moodboard-04-many-added.png', fullPage: true });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 4. Fit view to see all nodes
    const fitBtn = page.locator('.react-flow__controls-fitview');
    if (await fitBtn.isVisible()) {
      await fitBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/moodboard-05-all-songs.png', fullPage: true });

    // 5. Add tag nodes for grouping
    const tagBtn = page.getByRole('button', { name: 'Add tag' });
    await tagBtn.click(); await page.waitForTimeout(300);
    await tagBtn.click(); await page.waitForTimeout(300);
    await tagBtn.click(); await page.waitForTimeout(500);

    if (await fitBtn.isVisible()) {
      await fitBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/moodboard-06-with-tags.png', fullPage: true });

    // 6. Verify artwork loaded
    const songNodes = page.locator('.react-flow__node-song img');
    const imgCount = await songNodes.count();
    let loadedCount = 0;
    for (let i = 0; i < imgCount; i++) {
      const naturalWidth = await songNodes.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth);
      if (naturalWidth > 0) loadedCount++;
    }
    console.log(`Artwork: ${loadedCount}/${imgCount} loaded`);

    // 7. Zoom into a song node for detail
    const zoomIn = page.locator('.react-flow__controls-zoomin');
    for (let i = 0; i < 4; i++) {
      await zoomIn.click();
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: 'test-results/moodboard-07-zoomed-detail.png', fullPage: true });

    // 8. Final fit view overview
    if (await fitBtn.isVisible()) {
      await fitBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/moodboard-08-final-overview.png', fullPage: true });

    const nodeCount = await page.locator('.react-flow__node').count();
    console.log(`Total: ${nodeCount} nodes (${imgCount} songs + ${nodeCount - imgCount} tags)`);

    await expect(page.getByText('Moodboard').first()).toBeVisible();
  });
});
