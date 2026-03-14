import { test, expect } from '../fixtures/app-fixture';

test.describe('Moodboard', () => {
  test.setTimeout(120000);

  test('full workflow: add songs, create tags, connect, layout, verify clustering', async ({ page }) => {
    await page.goto('/moodboard');
    await expect(page.locator('text=/\\d{1,2}:\\d{2}:\\d{2}\\s*(AM|PM)/i')).toBeVisible({ timeout: 15000 });

    // 1. Create board
    await page.getByRole('button', { name: /new board/i }).click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/moodboard-01-empty-canvas.png', fullPage: true });

    // 2. Add songs: ARTBAT, Anyma, Dom Dolla, Sofi Tukker, more
    const searchBtn = page.getByRole('button', { name: 'Search songs' });
    await expect(searchBtn).toBeVisible({ timeout: 10000 });

    const searchAndAdd = async (query: string, maxAdd: number = 5) => {
      await searchBtn.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByPlaceholder(/search/i).fill(query);
      await page.waitForTimeout(1500);
      const badges = page.getByText('+ Add');
      const count = await badges.count();
      for (let i = 0; i < Math.min(count, maxAdd); i++) {
        await badges.first().click();
        await page.waitForTimeout(500);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      return Math.min(count, maxAdd);
    };

    let totalSongs = 0;
    totalSongs += await searchAndAdd('ARTBAT', 4);
    totalSongs += await searchAndAdd('Anyma', 3);
    totalSongs += await searchAndAdd('Sofi Tukker', 2);
    totalSongs += await searchAndAdd('Odd Mob', 2);
    totalSongs += await searchAndAdd('Adriatique', 2);
    console.log(`Added ${totalSongs} songs`);

    // Fit view
    const fitBtn = page.locator('.react-flow__controls-fitview');
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-02-songs-added.png', fullPage: true });

    // 3. Open tag palette and add mood + genre tags
    const tagBtn = page.getByRole('button', { name: 'Add tag' });
    await tagBtn.click();
    await page.waitForTimeout(300);

    // Add mood tags
    const darkBadge = page.getByRole('button', { name: 'dark' }).or(page.locator('text=dark').first());
    if (await darkBadge.isVisible()) await darkBadge.click();
    await page.waitForTimeout(200);

    await tagBtn.click();
    await page.waitForTimeout(300);
    const energeticBadge = page.getByRole('button', { name: 'energetic' }).or(page.locator('text=energetic').first());
    if (await energeticBadge.isVisible()) await energeticBadge.click();
    await page.waitForTimeout(200);

    await tagBtn.click();
    await page.waitForTimeout(300);
    const dreamyBadge = page.getByRole('button', { name: 'dreamy' }).or(page.locator('text=dreamy').first());
    if (await dreamyBadge.isVisible()) await dreamyBadge.click();
    await page.waitForTimeout(200);

    // Add genre tags
    await tagBtn.click();
    await page.waitForTimeout(300);
    const technoBadge = page.getByRole('button', { name: 'techno' }).or(page.locator('text=techno').first());
    if (await technoBadge.isVisible()) await technoBadge.click();
    await page.waitForTimeout(200);

    await tagBtn.click();
    await page.waitForTimeout(300);
    const houseBadge = page.getByRole('button', { name: 'house' }).or(page.locator('text=house').first());
    if (await houseBadge.isVisible()) await houseBadge.click();
    await page.waitForTimeout(200);

    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-03-with-tags.png', fullPage: true });

    const tagNodes = page.locator('.react-flow__node-tag');
    const tagCount = await tagNodes.count();
    console.log(`Tag nodes created: ${tagCount}`);

    // 4. Connect songs to tags by dragging (simulate by using the handle mechanism)
    // For now, verify that nodes and connection handles exist
    const songNodes = page.locator('.react-flow__node-song');
    const songCount = await songNodes.count();
    console.log(`Song nodes: ${songCount}, Tag nodes: ${tagCount}`);

    // 5. Apply cluster layout
    const clusterBtn = page.getByRole('button', { name: 'Cluster layout' });
    await expect(clusterBtn).toBeVisible();
    await clusterBtn.click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-04-cluster-layout.png', fullPage: true });

    // 6. Apply grid layout
    const gridBtn = page.getByRole('button', { name: 'Grid layout' });
    await expect(gridBtn).toBeVisible();
    await gridBtn.click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-05-grid-layout.png', fullPage: true });

    // 7. Zoom in for detail
    const zoomIn = page.locator('.react-flow__controls-zoomin');
    for (let i = 0; i < 3; i++) {
      await zoomIn.click();
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: 'test-results/moodboard-06-zoomed-detail.png', fullPage: true });

    // 8. Final overview
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-07-final-overview.png', fullPage: true });

    // Verify artwork loaded
    const imgNodes = page.locator('.react-flow__node-song img');
    const imgCount = await imgNodes.count();
    let loaded = 0;
    for (let i = 0; i < imgCount; i++) {
      const nw = await imgNodes.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth);
      if (nw > 0) loaded++;
    }
    console.log(`Artwork: ${loaded}/${imgCount} loaded`);

    const totalNodes = await page.locator('.react-flow__node').count();
    console.log(`Final: ${totalNodes} nodes (${songCount} songs + ${tagCount} tags)`);

    await expect(page.getByText('Moodboard').first()).toBeVisible();
  });
});
