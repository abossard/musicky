import { test, expect } from '../fixtures/app-fixture';
import path from 'path';
import sqlite from 'better-sqlite3';

const DB_PATH = path.resolve('sqlite.db');

function setupBoardForEdgeTest() {
  const db = sqlite(DB_PATH);
  db.exec('DELETE FROM canvas_positions');
  db.exec(`CREATE TABLE IF NOT EXISTS song_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path TEXT NOT NULL,
    target_path TEXT NOT NULL,
    connection_type TEXT DEFAULT 'similarity',
    weight REAL DEFAULT 0.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_path, target_path)
  )`);
  db.exec('DELETE FROM song_connections');

  const songs = db.prepare('SELECT file_path FROM mp3_file_cache ORDER BY file_path LIMIT 6').all() as { file_path: string }[];
  songs.forEach((s, i) => {
    const nodeId = `song:${s.file_path}`;
    db.prepare('INSERT INTO canvas_positions (node_id, position_x, position_y) VALUES (?,?,?)')
      .run(nodeId, (i % 3) * 200, Math.floor(i / 3) * 200);
  });

  // Tags
  const tags: { label: string; cat: string }[] = [
    { label: 'techno', cat: 'genre' },
    { label: 'house', cat: 'genre' },
    { label: 'peak', cat: 'phase' },
  ];
  tags.forEach((t, i) => {
    const nodeId = `tag:${t.cat}:${t.label}`;
    db.prepare('INSERT INTO canvas_positions (node_id, position_x, position_y) VALUES (?,?,?)')
      .run(nodeId, -200 + i * 120, -100);
  });

  // Song→tag edges
  for (let i = 0; i < songs.length; i++) {
    const tag = tags[i % tags.length];
    db.prepare('INSERT OR IGNORE INTO song_tags (file_path, tag_label, tag_category, source) VALUES (?,?,?,?)')
      .run(songs[i].file_path, tag.label, tag.cat, 'manual');
  }

  // Song→song similarity edges
  if (songs.length >= 5) {
    db.prepare('INSERT OR IGNORE INTO song_connections (source_path, target_path, connection_type, weight) VALUES (?,?,?,?)')
      .run(songs[0].file_path, songs[3].file_path, 'similarity', 0.9);
    db.prepare('INSERT OR IGNORE INTO song_connections (source_path, target_path, connection_type, weight) VALUES (?,?,?,?)')
      .run(songs[1].file_path, songs[4].file_path, 'similarity', 0.8);
  }

  console.log(`[edge-test] Setup: ${songs.length} songs, ${tags.length} tags`);
  db.close();
}

test.describe('Moodboard Edge Styles', () => {
  test.setTimeout(120000);

  test.beforeAll(() => {
    setupBoardForEdgeTest();
  });

  test.afterAll(() => {
    const db = sqlite(DB_PATH);
    db.exec('DELETE FROM canvas_positions');
    db.exec('DELETE FROM song_connections');
    db.close();
  });

  test('edge style selector: switch between all 5 styles with screenshots', async ({ page, moodboardPage }) => {
    // MoodboardPage auto-selects the first board on mount
    await moodboardPage.goto();
    await moodboardPage.waitForCanvasReady(15000);

    const fitBtn = moodboardPage.fitViewButton;

    // Grid layout for clean comparison
    const gridBtn = page.getByRole('button', { name: 'Grid layout' });
    if (await gridBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gridBtn.dispatchEvent('click');
      await page.waitForTimeout(1000);
    }
    await fitBtn.dispatchEvent('click');
    await page.waitForTimeout(500);

    // Verify edge style selector exists
    const edgeStyleSelector = page.locator('.mantine-SegmentedControl-root').last();
    await expect(edgeStyleSelector).toBeVisible();

    // Verify edges are visible
    const edgeCount = await moodboardPage.edges.count();
    console.log(`[edge-test] Edges visible: ${edgeCount}`);
    expect(edgeCount).toBeGreaterThan(0);

    // 1. Default: Curve (Bezier)
    await page.screenshot({ path: 'test-results/edge-style-01-bezier.png', fullPage: true });

    // 2. Straight
    await edgeStyleSelector.getByText('Straight').click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/edge-style-02-straight.png', fullPage: true });

    // 3. Step
    await edgeStyleSelector.getByText('Step').click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/edge-style-03-step.png', fullPage: true });

    // 4. Smooth Step
    await edgeStyleSelector.getByText('Smooth').click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/edge-style-04-smoothstep.png', fullPage: true });

    // 5. Smart (A* pathfinding)
    await edgeStyleSelector.getByText('Smart').click({ force: true });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/edge-style-05-smart.png', fullPage: true });

    // 6. Back to Curve
    await edgeStyleSelector.getByText('Curve').click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/edge-style-06-back-to-bezier.png', fullPage: true });

    // Verify all edges still render after style switching
    const finalEdgeCount = await moodboardPage.edges.count();
    expect(finalEdgeCount).toBe(edgeCount);

    console.log(`[edge-test] All 5 edge styles captured`);
  });
});
