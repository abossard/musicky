import { test, expect } from '../fixtures/app-fixture';
import path from 'path';
import sqlite from 'better-sqlite3';

function setupBoardWithEdges() {
  const dbPath = path.resolve('sqlite.db');
  const db = sqlite(dbPath);
  db.prepare('DELETE FROM moodboard_edges').run();
  db.prepare('DELETE FROM moodboard_nodes').run();
  db.prepare('DELETE FROM moodboards').run();

  const board = db.prepare('INSERT INTO moodboards (name) VALUES (?)').run('DJ Moodboard');
  const boardId = board.lastInsertRowid as number;

  const songs = db.prepare('SELECT file_path, filename, artist, title FROM mp3_file_cache').all() as any[];
  const songNodes: { id: string; path: string }[] = [];
  songs.slice(0, 13).forEach((song: any, i: number) => {
    const id = `song-${i}`;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, song_path, position_x, position_y) VALUES (?,?,?,?,?,?)')
      .run(id, boardId, 'song', song.file_path, (i % 5) * 180, Math.floor(i / 5) * 180);
    songNodes.push({ id, path: song.file_path });
  });

  const tags = [
    { label: 'dark', category: 'mood', color: 'pink' },
    { label: 'energetic', category: 'mood', color: 'pink' },
    { label: 'dreamy', category: 'mood', color: 'pink' },
    { label: 'techno', category: 'genre', color: 'cyan' },
    { label: 'house', category: 'genre', color: 'cyan' },
    { label: 'melodic', category: 'genre', color: 'cyan' },
  ];
  const tagIds: Record<string, string> = {};
  tags.forEach((t, i) => {
    const id = `tag-${t.label}`;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, tag_label, tag_category, tag_color, position_x, position_y) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, boardId, 'tag', t.label, t.category, t.color, -200 + i * 50, -100 + i * 80);
    tagIds[t.label] = id;
  });

  const mapping: Record<string, string[]> = {
    'artbat': ['dark', 'techno', 'melodic'],
    'anyma': ['dreamy', 'melodic'],
    'sofi tukker': ['energetic', 'house'],
    'adriatique': ['dreamy', 'melodic'],
    'dom dolla': ['energetic', 'house'],
    'super flu': ['melodic', 'house'],
    'odd mob': ['energetic', 'house'],
    'keinemusik': ['house', 'melodic'],
  };

  let edgeIdx = 0;
  for (const song of songNodes) {
    const lc = song.path.toLowerCase();
    for (const [kw, labels] of Object.entries(mapping)) {
      if (lc.includes(kw.replace(/\s/g, '')) || lc.includes(kw)) {
        for (const label of labels) {
          if (tagIds[label]) {
            db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
              .run(`e-${edgeIdx++}`, boardId, song.id, tagIds[label], tags.find(t => t.label === label)!.category, 0.8);
          }
        }
        break;
      }
    }
  }

  // Similarity edges between ARTBAT songs
  const artbat = songNodes.filter(s => s.path.toLowerCase().includes('artbat'));
  for (let i = 0; i < artbat.length - 1; i++) {
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`e-${edgeIdx++}`, boardId, artbat[i].id, artbat[i + 1].id, 'similarity', 0.9);
  }

  console.log(`[setup] Board ${boardId}: ${songNodes.length} songs, ${tags.length} tags, ${edgeIdx} edges`);
  db.close();
}

test.describe('Moodboard', () => {
  test.setTimeout(120000);

  test('songs with edges and cluster layout', async ({ page }) => {
    setupBoardWithEdges();

    // Navigate — the page auto-selects the first board
    await page.goto('/moodboard');
    await expect(page.locator('text=/\\d{1,2}:\\d{2}:\\d{2}\\s*(AM|PM)/i')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    // The page should auto-select the first (only) board
    // If not, click "New Board" won't help — we need to select ours
    // Check if canvas loaded (react-flow controls visible)
    let canvasReady = await page.locator('.react-flow__controls-fitview').isVisible().catch(() => false);

    if (!canvasReady) {
      // Try to select the board from dropdown
      await page.locator('.mantine-Select-input').click();
      await page.waitForTimeout(500);
      const option = page.getByRole('option', { name: 'DJ Moodboard' });
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click();
        await page.waitForTimeout(2000);
      }
    }

    // Wait for canvas
    const fitBtn = page.locator('.react-flow__controls-fitview');
    await expect(fitBtn).toBeVisible({ timeout: 15000 });

    // 1. Initial state
    await fitBtn.click();
    await page.waitForTimeout(500);
    const edgeCount = await page.locator('.react-flow__edge').count();
    const nodeCount = await page.locator('.react-flow__node').count();
    console.log(`Loaded: ${nodeCount} nodes, ${edgeCount} edges`);
    await page.screenshot({ path: 'test-results/moodboard-01-with-edges.png', fullPage: true });

    // 2. Cluster layout
    const clusterBtn = page.getByRole('button', { name: 'Cluster layout' });
    await clusterBtn.click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-02-cluster-layout.png', fullPage: true });

    // 3. Zoom in for edge detail
    const zoomIn = page.locator('.react-flow__controls-zoomin');
    for (let i = 0; i < 3; i++) { await zoomIn.click(); await page.waitForTimeout(200); }
    await page.screenshot({ path: 'test-results/moodboard-03-cluster-zoomed.png', fullPage: true });

    // 4. Grid layout
    await fitBtn.click(); await page.waitForTimeout(300);
    const gridBtn = page.getByRole('button', { name: 'Grid layout' });
    await gridBtn.click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-04-grid-layout.png', fullPage: true });

    // 5. Final cluster
    await clusterBtn.click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-05-final.png', fullPage: true });

    // Summary
    const songCount = await page.locator('.react-flow__node-song').count();
    const tagCount = await page.locator('.react-flow__node-tag').count();
    const imgs = page.locator('.react-flow__node-song img');
    let loaded = 0;
    for (let i = 0; i < await imgs.count(); i++) {
      if (await imgs.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth) > 0) loaded++;
    }
    console.log(`Final: ${songCount} songs, ${tagCount} tags, ${edgeCount} edges, ${loaded}/${songCount} artwork`);
    await expect(page.getByText('Moodboard').first()).toBeVisible();
  });
});
