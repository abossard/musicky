import { test, expect } from '../fixtures/app-fixture';
import path from 'path';
import sqlite from 'better-sqlite3';

const DB_PATH = path.resolve('sqlite.db');

/**
 * Create a board with 20 songs all connected to a single "techno" tag —
 * the exact scenario that needs hub-and-spoke bundling.
 */
function setupHighFanoutBoard() {
  const db = sqlite(DB_PATH);
  db.exec('DELETE FROM canvas_positions');

  const songs = db.prepare('SELECT file_path FROM mp3_file_cache ORDER BY file_path LIMIT 20').all() as { file_path: string }[];
  const cols = 5;
  songs.forEach((s, i) => {
    const nodeId = `song:${s.file_path}`;
    db.prepare('INSERT INTO canvas_positions (node_id, position_x, position_y) VALUES (?,?,?)')
      .run(nodeId, (i % cols) * 180, Math.floor(i / cols) * 180);
  });

  // Single tag node — all 20 songs connect to it
  db.prepare('INSERT INTO canvas_positions (node_id, position_x, position_y) VALUES (?,?,?)')
    .run('tag:genre:techno', -300, 200);

  // Connect all songs to the techno tag
  songs.forEach((s) => {
    db.prepare('INSERT OR IGNORE INTO song_tags (file_path, tag_label, tag_category, source) VALUES (?,?,?,?)')
      .run(s.file_path, 'techno', 'genre', 'manual');
  });

  // Also add a second tag with fewer connections (should NOT be bundled with default threshold)
  db.prepare('INSERT INTO canvas_positions (node_id, position_x, position_y) VALUES (?,?,?)')
    .run('tag:genre:house', -300, 350);
  // Connect only 3 songs to house (below default threshold of 5)
  for (let i = 0; i < 3; i++) {
    db.prepare('INSERT OR IGNORE INTO song_tags (file_path, tag_label, tag_category, source) VALUES (?,?,?,?)')
      .run(songs[i].file_path, 'house', 'genre', 'manual');
  }

  console.log(`[bundle-test] Setup: ${songs.length} songs, 2 tags (techno: 20 edges, house: 3 edges)`);
  db.close();
}

test.describe('Edge Bundling — Hub and Spoke', () => {
  test.setTimeout(120000);

  test.beforeAll(() => {
    setupHighFanoutBoard();
  });

  test.afterAll(() => {
    const db = sqlite(DB_PATH);
    db.exec('DELETE FROM canvas_positions');
    db.exec('DELETE FROM song_connections');
    db.close();
  });

  test('bundled vs unbundled: 20 songs → 1 tag with screenshots', async ({ page, moodboardPage }) => {
    // MoodboardPage auto-selects the first board on mount
    await moodboardPage.goto();
    await moodboardPage.waitForCanvasReady(15000);

    const fitBtn = moodboardPage.fitViewButton;

    // Grid layout for consistent comparison
    const gridBtn = page.getByRole('button', { name: 'Grid layout' });
    if (await gridBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gridBtn.dispatchEvent('click');
      await page.waitForTimeout(1000);
    }
    await fitBtn.dispatchEvent('click');
    await page.waitForTimeout(500);

    // Verify edges exist
    const edgeCount = await moodboardPage.edges.count();
    console.log(`[bundle-test] Total edges: ${edgeCount}`);
    expect(edgeCount).toBeGreaterThan(0);

    // 1. Screenshot: bundled (default — enabled by default)
    await page.screenshot({ path: 'test-results/bundle-01-bundled-default.png', fullPage: true });

    // 2. Find the bundle toggle and disable it
    const bundleToggle = page.locator('input[type="checkbox"]').first();
    if (await bundleToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bundleToggle.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/bundle-02-unbundled.png', fullPage: true });

    // 3. Re-enable bundling
    if (await bundleToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bundleToggle.click();
      await page.waitForTimeout(500);
    }

    // 4. Cluster layout to see how bundles look with grouped songs
    const clusterBtn = page.getByRole('button', { name: 'Cluster layout' });
    if (await clusterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clusterBtn.dispatchEvent('click');
      await page.waitForTimeout(1000);
      await fitBtn.dispatchEvent('click');
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/bundle-03-clustered-bundled.png', fullPage: true });

    // 5. Verify bundle settings panel is visible
    const settingsPanel = page.getByText('Edge Bundling');
    await expect(settingsPanel).toBeVisible();

    console.log('[bundle-test] All bundle screenshots captured');
  });
});
