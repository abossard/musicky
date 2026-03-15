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
  db.exec('DELETE FROM moodboard_edges');
  db.exec('DELETE FROM moodboard_nodes');
  db.exec('DELETE FROM moodboards');

  const board = db.prepare('INSERT INTO moodboards (name) VALUES (?)').run('Bundle Test');
  const boardId = board.lastInsertRowid as number;

  const songs = db.prepare('SELECT file_path FROM mp3_file_cache ORDER BY file_path LIMIT 20').all() as { file_path: string }[];
  const songIds: string[] = [];
  songs.forEach((s, i) => {
    const id = `song-bun-${i}`;
    const cols = 5;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, song_path, position_x, position_y) VALUES (?,?,?,?,?,?)')
      .run(id, boardId, 'song', s.file_path, (i % cols) * 180, Math.floor(i / cols) * 180);
    songIds.push(id);
  });

  // Single tag node — all 20 songs connect to it
  const tagId = 'tag-bun-techno';
  db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, tag_label, tag_category, tag_color, position_x, position_y) VALUES (?,?,?,?,?,?,?,?)')
    .run(tagId, boardId, 'tag', 'techno', 'genre', 'cyan', -300, 200);

  // Connect all songs to the tag
  songIds.forEach((sid, i) => {
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`e-bun-${i}`, boardId, sid, tagId, 'genre', 0.6 + Math.random() * 0.4);
  });

  // Also add a second tag with fewer connections (should NOT be bundled with default threshold)
  const tag2Id = 'tag-bun-house';
  db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, tag_label, tag_category, tag_color, position_x, position_y) VALUES (?,?,?,?,?,?,?,?)')
    .run(tag2Id, boardId, 'tag', 'house', 'genre', 'cyan', -300, 350);
  // Connect only 3 songs to house (below default threshold of 5)
  for (let i = 0; i < 3; i++) {
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`e-bun-h-${i}`, boardId, songIds[i], tag2Id, 'genre', 0.7);
  }

  console.log(`[bundle-test] Setup: ${songs.length} songs, 2 tags (techno: 20 edges, house: 3 edges)`);
  db.close();
}

test.describe('Edge Bundling — Hub and Spoke', () => {
  test.setTimeout(120000);

  test.beforeAll(() => {
    setupHighFanoutBoard();
  });

  test('bundled vs unbundled: 20 songs → 1 tag with screenshots', async ({ page }) => {
    await page.goto('/moodboard');
    await page.waitForTimeout(3000);

    // Select board
    const boardSelect = page.getByPlaceholder('Board');
    if (await boardSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await boardSelect.click();
      await page.waitForTimeout(500);
      const opt = page.getByRole('option').first();
      if (await opt.isVisible({ timeout: 2000 }).catch(() => false)) await opt.click();
      await page.waitForTimeout(2000);
    }

    const fitBtn = page.locator('.react-flow__controls-fitview');
    await expect(fitBtn).toBeVisible({ timeout: 10000 });

    // Grid layout for consistent comparison
    const gridBtn = page.getByRole('button', { name: 'Grid layout' });
    if (await gridBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gridBtn.click();
      await page.waitForTimeout(1000);
    }
    await fitBtn.click();
    await page.waitForTimeout(500);

    // Verify edges exist
    const edgeCount = await page.locator('.react-flow__edge').count();
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
      await clusterBtn.click();
      await page.waitForTimeout(1000);
      await fitBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/bundle-03-clustered-bundled.png', fullPage: true });

    // 5. Verify bundle settings panel is visible
    const settingsPanel = page.getByText('Edge Bundling');
    await expect(settingsPanel).toBeVisible();

    console.log('[bundle-test] All bundle screenshots captured');
  });
});
