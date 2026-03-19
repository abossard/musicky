import { test, expect } from '../fixtures/app-fixture';
import path from 'path';
import sqlite from 'better-sqlite3';

function setupRichBoard() {
  const db = sqlite(path.resolve('sqlite.db'));
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

  // Add ALL songs
  const songs = db.prepare('SELECT file_path, filename, artist, title FROM mp3_file_cache ORDER BY file_path').all() as any[];
  const songPaths: { path: string; name: string }[] = [];
  songs.forEach((s: any, i: number) => {
    const nodeId = `song:${s.file_path}`;
    db.prepare('INSERT INTO canvas_positions (node_id, position_x, position_y) VALUES (?,?,?)')
      .run(nodeId, (i % 7) * 160, Math.floor(i / 7) * 160);
    songPaths.push({ path: s.file_path, name: (s.file_path as string).toLowerCase() });
  });

  // Rich set of tags — 4 moods, 4 genres, 4 phases
  const tags = [
    { label: 'dark', cat: 'mood' },
    { label: 'energetic', cat: 'mood' },
    { label: 'dreamy', cat: 'mood' },
    { label: 'hypnotic', cat: 'mood' },
    { label: 'techno', cat: 'genre' },
    { label: 'house', cat: 'genre' },
    { label: 'melodic', cat: 'genre' },
    { label: 'progressive', cat: 'genre' },
    { label: 'opener', cat: 'phase' },
    { label: 'buildup', cat: 'phase' },
    { label: 'peak', cat: 'phase' },
    { label: 'closer', cat: 'phase' },
  ];
  const tagSet = new Set(tags.map(t => t.label));
  tags.forEach((t, i) => {
    const nodeId = `tag:${t.cat}:${t.label}`;
    db.prepare('INSERT INTO canvas_positions (node_id, position_x, position_y) VALUES (?,?,?)')
      .run(nodeId, -300 + i * 60, -200 + i * 60);
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

  let tagCount = 0;
  for (const song of songPaths) {
    for (const [kw, labels] of rules) {
      if (song.name.includes(kw)) {
        for (const label of labels) {
          if (tagSet.has(label)) {
            const cat = tags.find(t => t.label === label)!.cat;
            db.prepare('INSERT OR IGNORE INTO song_tags (file_path, tag_label, tag_category, source) VALUES (?,?,?,?)')
              .run(song.path, label, cat, 'manual');
            tagCount++;
          }
        }
      }
    }
  }

  // Song→song directed edges (flow chains)
  const artbat = songPaths.filter(s => s.name.includes('artbat'));
  let connCount = 0;
  for (let i = 0; i < artbat.length - 1; i++) {
    db.prepare('INSERT OR IGNORE INTO song_connections (source_path, target_path, connection_type, weight) VALUES (?,?,?,?)')
      .run(artbat[i].path, artbat[i + 1].path, 'similarity', 0.9);
    connCount++;
  }

  // Cross-artist flows
  const anyma = songPaths.filter(s => s.name.includes('anyma'));
  const adriatique = songPaths.filter(s => s.name.includes('adriatique'));
  if (anyma.length && adriatique.length) {
    db.prepare('INSERT OR IGNORE INTO song_connections (source_path, target_path, connection_type, weight) VALUES (?,?,?,?)')
      .run(anyma[0].path, adriatique[0].path, 'similarity', 0.85);
    connCount++;
  }

  const elderbrook = songPaths.filter(s => s.name.includes('elderbrook'));
  const rufus = songPaths.filter(s => s.name.includes('rufus'));
  if (elderbrook.length && rufus.length) {
    db.prepare('INSERT OR IGNORE INTO song_connections (source_path, target_path, connection_type, weight) VALUES (?,?,?,?)')
      .run(elderbrook[0].path, rufus[0].path, 'similarity', 0.8);
    connCount++;
  }

  const domDolla = songPaths.filter(s => s.name.includes('dom dolla'));
  const oddMob = songPaths.filter(s => s.name.includes('odd mob'));
  if (domDolla.length && oddMob.length) {
    db.prepare('INSERT OR IGNORE INTO song_connections (source_path, target_path, connection_type, weight) VALUES (?,?,?,?)')
      .run(domDolla[0].path, oddMob[0].path, 'similarity', 0.75);
    connCount++;
  }

  console.log(`[setup] ${songPaths.length} songs, ${tags.length} tags, ${tagCount} song-tags, ${connCount} connections`);
  db.close();
}

test.describe('Moodboard Visual Tests', () => {
  test.setTimeout(180000);

  test.afterAll(() => {
    const db = sqlite(path.resolve('sqlite.db'));
    db.exec('DELETE FROM canvas_positions');
    db.exec('DELETE FROM song_connections');
    db.close();
  });

  test('rich board: 44 songs, 12 tags, complex edges', async ({ page, moodboardPage }) => {
    setupRichBoard();

    // MoodboardPage auto-selects the first board on mount
    await moodboardPage.goto();
    await moodboardPage.waitForCanvasReady(15000);

    const fitBtn = moodboardPage.fitViewButton;
    const zoomIn = moodboardPage.zoomInButton;

    // Helpers to avoid scroll-into-view issues inside React Flow panels
    const clickFit = () => fitBtn.dispatchEvent('click');
    const clickZoomIn = () => zoomIn.dispatchEvent('click');

    // 1. Grid layout — all 44 songs visible
    const gridBtn = page.getByRole('button', { name: 'Grid layout' });
    await gridBtn.dispatchEvent('click');
    await page.waitForTimeout(1000);
    await clickFit();
    await page.waitForTimeout(500);
    const nodeCount = await page.locator('.react-flow__node').count();
    const edgeCount = await moodboardPage.edges.count();
    console.log(`Grid: ${nodeCount} nodes, ${edgeCount} edges`);
    await page.screenshot({ path: 'test-results/moodboard-01-grid-44songs.png', fullPage: true });

    // 2. Cluster layout — songs grouped by tag connections
    const clusterBtn = page.getByRole('button', { name: 'Cluster layout' });
    await clusterBtn.dispatchEvent('click');
    await page.waitForTimeout(1000);
    await clickFit();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-02-cluster-overview.png', fullPage: true });

    // 3. Cluster zoomed — edges and artwork detail
    for (let i = 0; i < 4; i++) { await clickZoomIn(); await page.waitForTimeout(150); }
    await page.screenshot({ path: 'test-results/moodboard-03-cluster-zoomed.png', fullPage: true });

    // Helper to click segmented control radio buttons via their labels
    const clickSegmentedOption = async (name: string) => {
      const radio = page.getByRole('radio', { name });
      await radio.dispatchEvent('click');
    };

    // 4. Phase container view
    await clickSegmentedOption('Phase');
    await page.waitForTimeout(1000);
    await clickFit();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-04-phase-containers.png', fullPage: true });

    // 5. Phase zoomed — see songs inside containers
    for (let i = 0; i < 3; i++) { await clickZoomIn(); await page.waitForTimeout(150); }
    await page.screenshot({ path: 'test-results/moodboard-05-phase-zoomed.png', fullPage: true });

    // 6. Genre container view
    await clickSegmentedOption('Genre');
    await page.waitForTimeout(1000);
    await clickFit();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-06-genre-containers.png', fullPage: true });

    // 7. Mood container view
    await clickSegmentedOption('Mood');
    await page.waitForTimeout(1000);
    await clickFit();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-07-mood-containers.png', fullPage: true });

    // 8. Back to free — filter by "dark"
    await clickSegmentedOption('Free');
    await page.waitForTimeout(500);
    await clusterBtn.dispatchEvent('click');
    await page.waitForTimeout(1000);
    await clickFit();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-08-free-cluster.png', fullPage: true });

    // 9. Final overview — fit view
    await clickFit();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/moodboard-09-final-overview.png', fullPage: true });

    // Summary
    console.log(`Final: ${nodeCount} nodes, ${edgeCount} edges`);
    const imgs = moodboardPage.songNodes.locator('img');
    let loaded = 0;
    const imgCount = await imgs.count();
    for (let i = 0; i < imgCount; i++)
      if (await imgs.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth) > 0) loaded++;
    console.log(`Artwork: ${loaded}/${imgCount} loaded`);

    await expect(moodboardPage.canvas).toBeVisible();
  });
});
