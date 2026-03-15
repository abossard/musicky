import { test, expect } from '../fixtures/app-fixture';
import path from 'path';
import sqlite from 'better-sqlite3';

function setupBoard() {
  const dbPath = path.resolve('sqlite.db');
  const db = sqlite(dbPath);
  db.prepare('DELETE FROM moodboard_edges').run();
  db.prepare('DELETE FROM moodboard_nodes').run();
  db.prepare('DELETE FROM moodboards').run();

  const board = db.prepare('INSERT INTO moodboards (name) VALUES (?)').run('DJ Moodboard');
  const boardId = board.lastInsertRowid as number;
  const songs = db.prepare('SELECT file_path, filename FROM mp3_file_cache ORDER BY file_path').all() as any[];

  const songNodes: { id: string; path: string }[] = [];
  songs.slice(0, 20).forEach((s: any, i: number) => {
    const id = `song-${i}`;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, song_path, position_x, position_y) VALUES (?,?,?,?,?,?)')
      .run(id, boardId, 'song', s.file_path, (i % 5) * 180, Math.floor(i / 5) * 180);
    songNodes.push({ id, path: s.file_path });
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
    { label: 'closer', category: 'phase', color: 'violet' },
  ];
  const tagIds: Record<string, string> = {};
  tags.forEach((t, i) => {
    const id = `tag-${t.label}`;
    db.prepare('INSERT INTO moodboard_nodes (id, board_id, node_type, tag_label, tag_category, tag_color, position_x, position_y) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, boardId, 'tag', t.label, t.category, t.color, -200 + i * 50, -100 + i * 80);
    tagIds[t.label] = id;
  });

  const rules: [string, string[]][] = [
    ['artbat', ['dark', 'techno', 'melodic', 'peak']],
    ['anyma', ['dreamy', 'melodic', 'peak']],
    ['sofi tukker', ['energetic', 'house', 'starter']],
    ['adriatique', ['dreamy', 'melodic', 'starter']],
    ['dom dolla', ['energetic', 'house', 'peak']],
    ['super flu', ['melodic', 'house', 'starter']],
    ['odd mob', ['energetic', 'house']],
    ['keinemusik', ['house', 'melodic', 'closer']],
    ['kolya', ['energetic', 'house', 'starter']],
    ['raffa', ['dark', 'techno', 'peak']],
    ['jonas blue', ['melodic', 'house', 'starter']],
    ['asal', ['dark', 'melodic', 'closer']],
    ['tiesto', ['energetic', 'techno', 'peak']],
  ];

  let ei = 0;
  for (const song of songNodes) {
    const lc = song.path.toLowerCase();
    for (const [kw, labels] of rules) {
      if (lc.includes(kw)) {
        for (const label of labels)
          if (tagIds[label])
            db.prepare('INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)')
              .run(`e-${ei++}`, boardId, song.id, tagIds[label], tags.find(t => t.label === label)!.category, 0.8);
      }
    }
  }

  console.log(`[setup] ${songNodes.length} songs, ${tags.length} tags, ${ei} edges`);
  db.close();
}

test.describe('Moodboard', () => {
  test.setTimeout(120000);

  test('container view modes', async ({ page }) => {
    setupBoard();

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
    const zoomIn = page.locator('.react-flow__controls-zoomin');
    await expect(fitBtn).toBeVisible({ timeout: 15000 });

    // 1. Free view — cluster layout
    await page.getByRole('button', { name: 'Cluster layout' }).click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-01-free-cluster.png', fullPage: true });

    // 2. Switch to Phase container view
    await page.locator(".mantine-SegmentedControl-root").getByText("Phase").click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-02-phase-overview.png', fullPage: true });

    // Zoom into first container to show it clearly
    for (let i = 0; i < 5; i++) { await zoomIn.click(); await page.waitForTimeout(150); }
    await page.screenshot({ path: 'test-results/moodboard-02b-phase-zoomed.png', fullPage: true });

    const containers = await page.locator('.react-flow__node-container').count();
    const groups = await page.locator('.react-flow__node-group').count();
    console.log(`Phase containers: ${containers}, groups: ${groups}`);
    // Dump all node types
    const nodeInfo = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[class*="react-flow__node"]')).map(n => {
        const cl = n.className;
        const type = cl.match(/react-flow__node-(\w+)/)?.[1] || 'unknown';
        const el = n as HTMLElement;
        return `${type}:${el.offsetWidth}x${el.offsetHeight} bg=${getComputedStyle(el).backgroundColor} border=${getComputedStyle(el).borderColor}`;
      });
    });
    nodeInfo.forEach(n => console.log('  ', n));

    // 3. Switch to Genre container view
    await page.locator('.mantine-SegmentedControl-root').getByText('Genre').click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-03-genre-containers.png', fullPage: true });

    // 4. Switch to Mood container view
    await page.locator('.mantine-SegmentedControl-root').getByText('Mood').click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-04-mood-containers.png', fullPage: true });

    // 5. Zoom into a container
    for (let i = 0; i < 3; i++) { await zoomIn.click(); await page.waitForTimeout(200); }
    await page.screenshot({ path: 'test-results/moodboard-05-container-zoomed.png', fullPage: true });

    // 6. Back to free
    await page.locator('.mantine-SegmentedControl-root').getByText('Free').click();
    await page.waitForTimeout(1000);
    await fitBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-06-back-to-free.png', fullPage: true });

    const totalNodes = await page.locator('.react-flow__node').count();
    console.log(`Total nodes in free view: ${totalNodes}`);
    await expect(page.getByText('Moodboard').first()).toBeVisible();
  });
});
