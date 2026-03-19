import { test, expect } from '../fixtures/app-fixture';
import path from 'path';
import sqlite from 'better-sqlite3';

const DB_PATH = path.resolve('sqlite.db');

function setupBoardForEdgeTest() {
  const db = sqlite(DB_PATH);
  db.exec('DELETE FROM moodboard_edges');
  db.exec('DELETE FROM moodboard_nodes');
  db.exec('DELETE FROM moodboards');

  const board = db.prepare('INSERT INTO moodboards (name) VALUES (?)').run('Edge Style Test');
  const boardId = board.lastInsertRowid as number;

  const songs = db.prepare('SELECT file_path FROM mp3_file_cache ORDER BY file_path LIMIT 6').all() as { file_path: string }[];
  const songIds: string[] = [];
  songs.forEach((s, i) => {
    const id = `song-es-${i}`;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, song_path, position_x, position_y) VALUES (?,?,?,?,?,?)')
      .run(id, boardId, 'song', s.file_path, (i % 3) * 200, Math.floor(i / 3) * 200);
    songIds.push(id);
  });

  // Tags
  const tags = ['techno', 'house', 'peak'];
  const tagIds: string[] = [];
  tags.forEach((t, i) => {
    const id = `tag-es-${t}`;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, tag_label, tag_category, tag_color, position_x, position_y) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, boardId, 'tag', t, i < 2 ? 'genre' : 'phase', i < 2 ? 'cyan' : 'violet', -200 + i * 120, -100);
    tagIds.push(id);
  });

  // Edges: song→tag + song→song
  let ei = 0;
  for (let i = 0; i < songIds.length; i++) {
    const tagIdx = i % tags.length;
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`e-es-${ei++}`, boardId, songIds[i], tagIds[tagIdx], i < 2 ? 'genre' : 'phase', 0.7);
  }
  // Song→song similarity edges
  if (songIds.length >= 4) {
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`e-es-sim1`, boardId, songIds[0], songIds[3], 'similarity', 0.9);
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`e-es-sim2`, boardId, songIds[1], songIds[4], 'similarity', 0.8);
  }

  console.log(`[edge-test] Setup: ${songs.length} songs, ${tags.length} tags`);
  db.close();
}

test.describe('Moodboard Edge Styles', () => {
  test.setTimeout(120000);

  test.beforeAll(() => {
    setupBoardForEdgeTest();
  });

  test('edge style selector: switch between all 5 styles with screenshots', async ({ page, moodboardPage }) => {
    // MoodboardPage auto-selects the first board on mount
    await moodboardPage.goto();
    await moodboardPage.waitForCanvasReady(15000);

    const fitBtn = moodboardPage.fitViewButton;

    // Grid layout for clean comparison
    const gridBtn = page.getByRole('button', { name: 'Grid layout' });
    if (await gridBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gridBtn.click();
      await page.waitForTimeout(1000);
    }
    await fitBtn.click();
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
    await edgeStyleSelector.getByText('Straight').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/edge-style-02-straight.png', fullPage: true });

    // 3. Step
    await edgeStyleSelector.getByText('Step').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/edge-style-03-step.png', fullPage: true });

    // 4. Smooth Step
    await edgeStyleSelector.getByText('Smooth').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/edge-style-04-smoothstep.png', fullPage: true });

    // 5. Smart (A* pathfinding)
    await edgeStyleSelector.getByText('Smart').click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/edge-style-05-smart.png', fullPage: true });

    // 6. Back to Curve
    await edgeStyleSelector.getByText('Curve').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/edge-style-06-back-to-bezier.png', fullPage: true });

    // Verify all edges still render after style switching
    const finalEdgeCount = await moodboardPage.edges.count();
    expect(finalEdgeCount).toBe(edgeCount);

    console.log(`[edge-test] All 5 edge styles captured`);
  });
});
