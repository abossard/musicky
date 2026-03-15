import { test, expect } from '../fixtures/app-fixture';
import path from 'path';
import sqlite from 'better-sqlite3';

function setupRichBoard() {
  const db = sqlite(path.resolve('sqlite.db'));
  db.prepare('DELETE FROM moodboard_edges').run();
  db.prepare('DELETE FROM moodboard_nodes').run();
  db.prepare('DELETE FROM moodboards').run();

  const board = db.prepare('INSERT INTO moodboards (name) VALUES (?)').run('Rich Moodboard');
  const boardId = board.lastInsertRowid as number;

  // Add ALL 44 songs
  const songs = db.prepare('SELECT file_path, filename, artist, title FROM mp3_file_cache ORDER BY file_path').all() as any[];
  const songNodes: { id: string; path: string; name: string }[] = [];
  songs.forEach((s: any, i: number) => {
    const id = `song-${i}`;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, song_path, position_x, position_y) VALUES (?,?,?,?,?,?)')
      .run(id, boardId, 'song', s.file_path, (i % 7) * 160, Math.floor(i / 7) * 160);
    songNodes.push({ id, path: s.file_path, name: (s.file_path as string).toLowerCase() });
  });

  // Rich set of tags — 4 moods, 4 genres, 4 phases
  const tags = [
    // Moods
    { label: 'dark', cat: 'mood', color: 'pink' },
    { label: 'energetic', cat: 'mood', color: 'pink' },
    { label: 'dreamy', cat: 'mood', color: 'pink' },
    { label: 'hypnotic', cat: 'mood', color: 'pink' },
    // Genres
    { label: 'techno', cat: 'genre', color: 'cyan' },
    { label: 'house', cat: 'genre', color: 'cyan' },
    { label: 'melodic', cat: 'genre', color: 'cyan' },
    { label: 'progressive', cat: 'genre', color: 'cyan' },
    // Phases
    { label: 'opener', cat: 'phase', color: 'violet' },
    { label: 'buildup', cat: 'phase', color: 'violet' },
    { label: 'peak', cat: 'phase', color: 'violet' },
    { label: 'closer', cat: 'phase', color: 'violet' },
  ];
  const tagIds: Record<string, string> = {};
  tags.forEach((t, i) => {
    const id = `tag-${t.label}`;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, tag_label, tag_category, tag_color, position_x, position_y) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, boardId, 'tag', t.label, t.cat, t.color, -300 + i * 60, -200 + i * 60);
    tagIds[t.label] = id;
  });

  // Complex song→tag connections (each song connected to 2-4 tags)
  const rules: [string, string[]][] = [
    ['artbat', ['dark', 'techno', 'melodic', 'peak']],
    ['anyma', ['dreamy', 'progressive', 'melodic', 'peak']],
    ['sofi tukker', ['energetic', 'house', 'opener']],
    ['dom dolla', ['energetic', 'house', 'peak']],
    ['adriatique', ['dreamy', 'melodic', 'progressive', 'buildup']],
    ['super flu', ['melodic', 'house', 'opener']],
    ['odd mob', ['energetic', 'house', 'techno', 'peak']],
    ['keinemusik', ['house', 'melodic', 'hypnotic', 'closer']],
    ['tiesto', ['energetic', 'techno', 'progressive', 'peak']],
    ['morten', ['techno', 'energetic', 'dark', 'peak']],
    ['kolya', ['energetic', 'house', 'opener']],
    ['raffa', ['dark', 'techno', 'hypnotic', 'buildup']],
    ['jonas blue', ['melodic', 'house', 'opener']],
    ['asal', ['dark', 'melodic', 'hypnotic', 'closer']],
    ['salif', ['house', 'melodic', 'dreamy', 'buildup']],
    ['hi-lo', ['techno', 'dark', 'energetic', 'peak']],
    ['benny benassi', ['techno', 'energetic', 'hypnotic', 'peak']],
    ['elderbrook', ['dreamy', 'melodic', 'progressive', 'buildup']],
    ['empire of the sun', ['dreamy', 'progressive', 'melodic', 'closer']],
    ['enai', ['melodic', 'progressive', 'dreamy', 'buildup']],
    ['jack orley', ['house', 'melodic', 'opener']],
    ['jamie jones', ['house', 'techno', 'hypnotic', 'peak']],
    ['jazzy', ['house', 'energetic', 'opener']],
    ['john summit', ['techno', 'house', 'energetic', 'peak']],
    ['moby', ['dreamy', 'melodic', 'progressive', 'closer']],
    ['pete tong', ['techno', 'melodic', 'peak']],
    ['rivo', ['melodic', 'progressive', 'dreamy', 'buildup']],
    ['roland clark', ['house', 'energetic', 'peak']],
    ['rufus', ['dreamy', 'progressive', 'melodic', 'closer']],
    ['sailor', ['dark', 'melodic', 'hypnotic', 'buildup']],
    ['sean paul', ['house', 'energetic', 'peak']],
    ['shakedown', ['dark', 'progressive', 'hypnotic', 'peak']],
    ['sonique', ['house', 'energetic', 'opener']],
    ['sonny fodera', ['house', 'energetic', 'opener']],
    ['temper trap', ['dreamy', 'melodic', 'progressive', 'closer']],
    ['womack', ['house', 'melodic', 'dreamy', 'closer']],
    ['zac', ['dark', 'progressive', 'hypnotic', 'buildup']],
    ['zhu', ['dark', 'techno', 'hypnotic', 'peak']],
    ['kevin mckay', ['house', 'energetic', 'opener']],
  ];

  let ei = 0;
  for (const song of songNodes) {
    for (const [kw, labels] of rules) {
      if (song.name.includes(kw)) {
        for (const label of labels) {
          if (tagIds[label])
            db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
              .run(`e-${ei++}`, boardId, song.id, tagIds[label], tags.find(t => t.label === label)!.cat, 0.6 + Math.random() * 0.4);
        }
      }
    }
  }

  // Song→song directed edges (flow chains)
  const artbat = songNodes.filter(s => s.name.includes('artbat'));
  for (let i = 0; i < artbat.length - 1; i++)
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`flow-${ei++}`, boardId, artbat[i].id, artbat[i + 1].id, 'similarity', 0.9);

  // Cross-artist flows
  const anyma = songNodes.filter(s => s.name.includes('anyma'));
  const adriatique = songNodes.filter(s => s.name.includes('adriatique'));
  if (anyma.length && adriatique.length)
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`flow-${ei++}`, boardId, anyma[0].id, adriatique[0].id, 'similarity', 0.85);

  const elderbrook = songNodes.filter(s => s.name.includes('elderbrook'));
  const rufus = songNodes.filter(s => s.name.includes('rufus'));
  if (elderbrook.length && rufus.length)
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`flow-${ei++}`, boardId, elderbrook[0].id, rufus[0].id, 'similarity', 0.8);

  const domDolla = songNodes.filter(s => s.name.includes('dom dolla'));
  const oddMob = songNodes.filter(s => s.name.includes('odd mob'));
  if (domDolla.length && oddMob.length)
    db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
      .run(`flow-${ei++}`, boardId, domDolla[0].id, oddMob[0].id, 'similarity', 0.75);

  console.log(`[setup] ${songNodes.length} songs, ${tags.length} tags, ${ei} edges`);
  db.close();
}

test.describe('Moodboard Visual Tests', () => {
  test.setTimeout(90000);

  test('rich board: 44 songs, 12 tags, complex edges', async ({ page }) => {
    setupRichBoard();
    await page.goto('/moodboard');
    await page.waitForTimeout(5000);

    // Select board
    const fitBtn = page.locator('.react-flow__controls-fitview');
    if (!(await fitBtn.isVisible({ timeout: 8000 }).catch(() => false))) {
      await page.getByPlaceholder("Board").click().catch(() => {});
      await page.waitForTimeout(500);
      const opt = page.getByRole('option').first();
      if (await opt.isVisible().catch(() => false)) await opt.click();
      await page.waitForTimeout(3000);
    }
    await expect(fitBtn).toBeVisible({ timeout: 10000 });

    // 1. Grid layout — all 44 songs visible
    const gridBtn = page.getByRole('button', { name: 'Grid layout' });
    await gridBtn.click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    const nodeCount = await page.locator('.react-flow__node').count();
    const edgeCount = await page.locator('.react-flow__edge').count();
    console.log(`Grid: ${nodeCount} nodes, ${edgeCount} edges`);
    await page.screenshot({ path: 'test-results/moodboard-01-grid-44songs.png', fullPage: true });

    // 2. Cluster layout — songs grouped by tag connections
    const clusterBtn = page.getByRole('button', { name: 'Cluster layout' });
    await clusterBtn.click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-02-cluster-overview.png', fullPage: true });

    // 3. Cluster zoomed — edges and artwork detail
    const zoomIn = page.locator('.react-flow__controls-zoomin');
    for (let i = 0; i < 4; i++) { await zoomIn.click(); await page.waitForTimeout(150); }
    await page.screenshot({ path: 'test-results/moodboard-03-cluster-zoomed.png', fullPage: true });

    // 4. Phase container view
    await page.locator('.mantine-SegmentedControl-root').getByText('Phase').click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-04-phase-containers.png', fullPage: true });

    // 5. Phase zoomed — see songs inside containers
    for (let i = 0; i < 3; i++) { await zoomIn.click(); await page.waitForTimeout(150); }
    await page.screenshot({ path: 'test-results/moodboard-05-phase-zoomed.png', fullPage: true });

    // 6. Genre container view
    await page.locator('.mantine-SegmentedControl-root').getByText('Genre').click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-06-genre-containers.png', fullPage: true });

    // 7. Mood container view
    await page.locator('.mantine-SegmentedControl-root').getByText('Mood').click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-07-mood-containers.png', fullPage: true });

    // 8. Back to free — filter by "dark"
    await page.locator('.mantine-SegmentedControl-root').getByText('Free').click();
    await page.waitForTimeout(500);
    await clusterBtn.click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(300);
    await page.locator('.react-flow__node-tag').filter({ hasText: 'dark' }).dblclick();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-08-filter-dark.png', fullPage: true });
    const darkMatches = await page.getByText(/\d+ matches/).textContent().catch(() => '?');
    console.log(`Dark filter: ${darkMatches}`);

    // 9. Filter: dark + techno
    await page.locator('.react-flow__node-tag').filter({ hasText: 'techno' }).dblclick();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-09-filter-dark-techno.png', fullPage: true });

    // 10. Filter: dreamy + progressive
    await page.locator('.react-flow__node-tag').filter({ hasText: 'dark' }).dblclick();
    await page.locator('.react-flow__node-tag').filter({ hasText: 'techno' }).dblclick();
    await page.waitForTimeout(200);
    await page.locator('.react-flow__node-tag').filter({ hasText: 'dreamy' }).dblclick();
    await page.locator('.react-flow__node-tag').filter({ hasText: 'progressive' }).dblclick();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-10-filter-dreamy-progressive.png', fullPage: true });

    // 11. Final overview — clear filters, cluster, fit
    await page.locator('.react-flow__node-tag').filter({ hasText: 'dreamy' }).dblclick();
    await page.locator('.react-flow__node-tag').filter({ hasText: 'progressive' }).dblclick();
    await page.waitForTimeout(200);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-11-final-overview.png', fullPage: true });

    // Summary
    console.log(`Final: ${nodeCount} nodes, ${edgeCount} edges`);
    const imgs = page.locator('.react-flow__node-song img');
    let loaded = 0;
    const imgCount = await imgs.count();
    for (let i = 0; i < imgCount; i++)
      if (await imgs.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth) > 0) loaded++;
    console.log(`Artwork: ${loaded}/${imgCount} loaded`);

    await expect(page.getByText('Moodboard').first()).toBeVisible();
  });
});
