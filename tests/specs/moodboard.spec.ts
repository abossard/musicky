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
  const songs = db.prepare('SELECT file_path, filename, artist, title FROM mp3_file_cache ORDER BY file_path').all() as any[];

  // Use 20 songs for a good mix
  const selectedSongs = songs.slice(0, 20);
  const songNodes: { id: string; path: string; name: string }[] = [];
  selectedSongs.forEach((s: any, i: number) => {
    const id = `song-${i}`;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, song_path, position_x, position_y) VALUES (?,?,?,?,?,?)')
      .run(id, boardId, 'song', s.file_path, (i % 5) * 180, Math.floor(i / 5) * 180);
    songNodes.push({ id, path: s.file_path, name: (s.file_path as string).toLowerCase() });
  });

  const tags = [
    { label: 'dark', category: 'mood', color: 'pink' },
    { label: 'energetic', category: 'mood', color: 'pink' },
    { label: 'dreamy', category: 'mood', color: 'pink' },
    { label: 'techno', category: 'genre', color: 'cyan' },
    { label: 'house', category: 'genre', color: 'cyan' },
    { label: 'melodic', category: 'genre', color: 'cyan' },
    { label: 'starter', category: 'phase', color: 'violet' },
    { label: 'peak', category: 'phase', color: 'violet' },
  ];
  const tagIds: Record<string, string> = {};
  tags.forEach((t, i) => {
    const id = `tag-${t.label}`;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, tag_label, tag_category, tag_color, position_x, position_y) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, boardId, 'tag', t.label, t.category, t.color, -200 + i * 50, -100 + i * 80);
    tagIds[t.label] = id;
  });

  // Map keywords in filename to tags
  const rules: [string, string[]][] = [
    ['artbat', ['dark', 'techno', 'melodic', 'peak']],
    ['anyma', ['dreamy', 'melodic', 'peak']],
    ['sofi tukker', ['energetic', 'house', 'starter']],
    ['adriatique', ['dreamy', 'melodic', 'starter']],
    ['dom dolla', ['energetic', 'house', 'peak']],
    ['super flu', ['melodic', 'house', 'starter']],
    ['odd mob', ['energetic', 'house']],
    ['keinemusik', ['house', 'melodic']],
    ['tiesto', ['energetic', 'techno']],
    ['morten', ['techno', 'energetic', 'peak']],
    ['kolya', ['energetic', 'house', 'starter']],
    ['raffa', ['dark', 'techno']],
    ['jonas blue', ['melodic', 'house', 'starter']],
    ['asal', ['dark', 'melodic']],
  ];

  let ei = 0;
  for (const song of songNodes) {
    for (const [kw, labels] of rules) {
      if (song.name.includes(kw)) {
        for (const label of labels) {
          if (tagIds[label])
            db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
              .run(`e-${ei++}`, boardId, song.id, tagIds[label], tags.find(t => t.label === label)!.category, 0.8);
        }
        // Don't break — a song can match multiple rules
      }
    }
  }

  // Song→song flow edges
  const artbat = songNodes.filter(s => s.name.includes('artbat'));
  for (let i = 0; i < artbat.length - 1; i++)
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`e-${ei++}`, boardId, artbat[i].id, artbat[i + 1].id, 'similarity', 0.9);

  console.log(`[setup] Board ${boardId}: ${songNodes.length} songs, ${tags.length} tags, ${ei} edges`);
  db.close();
}

test.describe('Moodboard', () => {
  test.setTimeout(120000);

  test('edges, layout, and filter workflow', async ({ page }) => {
    setupBoardWithEdges();

    await page.goto('/moodboard');
    await expect(page.locator('text=/\\d{1,2}:\\d{2}:\\d{2}\\s*(AM|PM)/i')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    // Select board
    if (!(await page.locator('.react-flow__controls-fitview').isVisible().catch(() => false))) {
      await page.locator('.mantine-Select-input').click();
      await page.waitForTimeout(500);
      const opt = page.getByRole('option', { name: 'DJ Moodboard' });
      if (await opt.isVisible({ timeout: 3000 }).catch(() => false)) await opt.click();
      await page.waitForTimeout(2000);
    }
    const fitBtn = page.locator('.react-flow__controls-fitview');
    await expect(fitBtn).toBeVisible({ timeout: 15000 });

    // 1. Cluster layout with edges
    await page.getByRole('button', { name: 'Cluster layout' }).click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    const edgeCount = await page.locator('.react-flow__edge').count();
    console.log(`Edges: ${edgeCount}`);
    await page.screenshot({ path: 'test-results/moodboard-01-cluster.png', fullPage: true });

    // 2. Filter: dark
    await page.locator('.react-flow__node-tag').filter({ hasText: 'dark' }).dblclick();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-02-filter-dark.png', fullPage: true });
    const darkMatches = await page.getByText(/\d+ matches/).textContent().catch(() => '');
    console.log(`Dark filter: ${darkMatches}`);

    // 3. Filter: dark + techno
    await page.locator('.react-flow__node-tag').filter({ hasText: 'techno' }).dblclick();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-03-filter-dark-techno.png', fullPage: true });

    // 4. Clear, then filter: starter
    // Clear by double-clicking active tags
    await page.locator('.react-flow__node-tag').filter({ hasText: 'dark' }).dblclick();
    await page.waitForTimeout(200);
    await page.locator('.react-flow__node-tag').filter({ hasText: 'techno' }).dblclick();
    await page.waitForTimeout(200);
    await page.locator('.react-flow__node-tag').filter({ hasText: 'starter' }).dblclick();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-04-filter-starter.png', fullPage: true });

    // 5. Filter: energetic + house
    await page.locator('.react-flow__node-tag').filter({ hasText: 'starter' }).dblclick();
    await page.waitForTimeout(200);
    await page.locator('.react-flow__node-tag').filter({ hasText: 'energetic' }).dblclick();
    await page.waitForTimeout(200);
    await page.locator('.react-flow__node-tag').filter({ hasText: 'house' }).dblclick();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-05-filter-energetic-house.png', fullPage: true });

    // 6. Grid layout while filtered
    await page.getByRole('button', { name: 'Grid layout' }).click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-06-grid-filtered.png', fullPage: true });

    // 7. Clear all, zoom detail
    await page.locator('.react-flow__node-tag').filter({ hasText: 'energetic' }).dblclick();
    await page.waitForTimeout(200);
    await page.locator('.react-flow__node-tag').filter({ hasText: 'house' }).dblclick();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Cluster layout' }).click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(300);
    const zoomIn = page.locator('.react-flow__controls-zoomin');
    for (let i = 0; i < 2; i++) { await zoomIn.click(); await page.waitForTimeout(200); }
    await page.screenshot({ path: 'test-results/moodboard-07-final-detail.png', fullPage: true });

    const nodeCount = await page.locator('.react-flow__node').count();
    console.log(`Final: ${nodeCount} nodes, ${edgeCount} edges`);
    await expect(page.getByText('Moodboard').first()).toBeVisible();
  });
});
