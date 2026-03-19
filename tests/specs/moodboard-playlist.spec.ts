import { test, expect, uniqueName } from '../fixtures/app-fixture';
import path from 'path';
import sqlite from 'better-sqlite3';

/**
 * Seed a moodboard with songs, tags (including phase tags), and edges
 * so the playlist generator has data to work with.
 */
function setupBoardForPlaylist() {
  const db = sqlite(path.resolve('sqlite.db'));
  db.prepare('DELETE FROM moodboard_edges').run();
  db.prepare('DELETE FROM moodboard_nodes').run();
  db.prepare('DELETE FROM moodboards').run();

  const board = db.prepare('INSERT INTO moodboards (name) VALUES (?)').run('Playlist Test Board');
  const boardId = board.lastInsertRowid as number;

  const songs = db
    .prepare('SELECT file_path, filename, artist, title FROM mp3_file_cache ORDER BY file_path')
    .all() as { file_path: string; filename: string; artist: string | null; title: string | null }[];

  const songNodes: { id: string; lowerPath: string }[] = [];
  songs.forEach((s, i) => {
    const id = `song-${i}`;
    db.prepare(
      'INSERT INTO moodboard_nodes (id, board_id, node_type, song_path, position_x, position_y) VALUES (?,?,?,?,?,?)',
    ).run(id, boardId, 'song', s.file_path, (i % 7) * 160, Math.floor(i / 7) * 160);
    songNodes.push({ id, lowerPath: s.file_path.toLowerCase() });
  });

  // Phase + genre + mood tags
  const tags = [
    { label: 'opener', cat: 'phase', color: 'violet' },
    { label: 'buildup', cat: 'phase', color: 'violet' },
    { label: 'peak', cat: 'phase', color: 'violet' },
    { label: 'closer', cat: 'phase', color: 'violet' },
    { label: 'techno', cat: 'genre', color: 'cyan' },
    { label: 'house', cat: 'genre', color: 'cyan' },
    { label: 'dark', cat: 'mood', color: 'pink' },
    { label: 'dreamy', cat: 'mood', color: 'pink' },
  ];
  const tagIds: Record<string, string> = {};
  tags.forEach((t, i) => {
    const id = `tag-${t.label}`;
    db.prepare(
      'INSERT INTO moodboard_nodes (id, board_id, node_type, tag_label, tag_category, tag_color, position_x, position_y) VALUES (?,?,?,?,?,?,?,?)',
    ).run(id, boardId, 'tag', t.label, t.cat, t.color, -300 + i * 60, -200 + i * 60);
    tagIds[t.label] = id;
  });

  // Connect songs to tags (especially phase tags for playlist generation)
  const rules: [string, string[]][] = [
    ['artbat', ['dark', 'techno', 'peak']],
    ['anyma', ['dreamy', 'buildup']],
    ['dom dolla', ['house', 'peak']],
    ['elderbrook', ['dreamy', 'buildup']],
    ['empire of the sun', ['dreamy', 'closer']],
    ['moby', ['dreamy', 'closer']],
    ['jack orley', ['house', 'opener']],
    ['jazzy', ['house', 'opener']],
    ['morten', ['techno', 'dark', 'peak']],
    ['hi-lo', ['techno', 'dark', 'peak']],
    ['jamie jones', ['house', 'peak']],
    ['rivo', ['dreamy', 'buildup']],
    ['pete tong', ['techno', 'peak']],
    ['enai', ['dreamy', 'buildup']],
    ['benny benassi', ['techno', 'peak']],
    ['sonique', ['house', 'opener']],
    ['rufus', ['dreamy', 'closer']],
  ];

  let edgeIdx = 0;
  for (const song of songNodes) {
    for (const [kw, labels] of rules) {
      if (song.lowerPath.includes(kw)) {
        for (const label of labels) {
          if (tagIds[label]) {
            db.prepare(
              'INSERT INTO moodboard_edges (id, board_id, source_node_id, target_node_id, edge_type, weight) VALUES (?,?,?,?,?,?)',
            ).run(`e-${edgeIdx++}`, boardId, song.id, tagIds[label], tags.find(t => t.label === label)!.cat, 0.8);
          }
        }
      }
    }
  }

  db.close();
}

test.describe('Playlist Panel', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ moodboardPage, page }) => {
    setupBoardForPlaylist();
    await moodboardPage.goto();
    // Wait for canvas to render so the moodboard is fully loaded
    await moodboardPage.waitForCanvasReady();
  });

  test('playlist panel is hidden by default', async ({ moodboardPage }) => {
    await expect(moodboardPage.playlistPanel).not.toBeVisible();
  });

  test('can toggle playlist panel open and closed', async ({ moodboardPage }) => {
    // Open
    await moodboardPage.togglePlaylistPanel();
    await moodboardPage.expectPlaylistVisible();

    // Close
    await moodboardPage.togglePlaylistPanel();
    await expect(moodboardPage.playlistPanel).not.toBeVisible();
  });

  test('generate button is visible when panel is open', async ({ moodboardPage }) => {
    await moodboardPage.togglePlaylistPanel();
    await expect(moodboardPage.playlistGenerateButton).toBeVisible();
  });

  test('shows empty state before generation', async ({ moodboardPage }) => {
    await moodboardPage.togglePlaylistPanel();
    await expect(moodboardPage.playlistPanel).toBeVisible();
    // The body should show the empty state message
    const emptyMsg = moodboardPage.page.locator('.playlist-empty');
    await expect(emptyMsg).toBeVisible();
    await expect(emptyMsg).toContainText('Generate a playlist');
  });

  test('can generate a playlist', async ({ moodboardPage }) => {
    await moodboardPage.togglePlaylistPanel();
    await moodboardPage.generatePlaylist();

    // Songs should appear
    await expect(moodboardPage.playlistItems.first()).toBeVisible({ timeout: 10_000 });
    const count = await moodboardPage.playlistItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('generated playlist shows songs grouped by phase', async ({ moodboardPage, page }) => {
    await moodboardPage.togglePlaylistPanel();
    await moodboardPage.generatePlaylist();

    // Wait for playlist to render
    await expect(moodboardPage.playlistItems.first()).toBeVisible({ timeout: 10_000 });

    // Phase header badges should be visible
    const phaseHeaders = page.locator('.playlist-phase-header');
    const phaseCount = await phaseHeaders.count();
    expect(phaseCount).toBeGreaterThan(0);

    // At least some known phases from the seed data should appear
    const phaseText = await page.locator('.playlist-phases').textContent();
    const knownPhases = ['opener', 'buildup', 'peak', 'closer'];
    const matchedPhases = knownPhases.filter(p =>
      phaseText?.toLowerCase().includes(p),
    );
    expect(matchedPhases.length).toBeGreaterThan(0);
  });

  test('playlist stats show song count', async ({ moodboardPage }) => {
    await moodboardPage.togglePlaylistPanel();
    await moodboardPage.generatePlaylist();

    // Wait for generation to complete
    await expect(moodboardPage.playlistItems.first()).toBeVisible({ timeout: 10_000 });

    // Stats footer should display total songs and phase count
    await expect(moodboardPage.playlistStats).toBeVisible();
    await expect(moodboardPage.playlistStats).toContainText(/Total:\s*\d+\s*songs/);
    await expect(moodboardPage.playlistStats).toContainText(/\d+\s*phase/);
  });

  test('can save a generated playlist', async ({ moodboardPage, page }) => {
    await moodboardPage.togglePlaylistPanel();
    await moodboardPage.generatePlaylist();
    await expect(moodboardPage.playlistItems.first()).toBeVisible({ timeout: 10_000 });

    // Save button should now be visible
    await expect(moodboardPage.playlistSaveButton).toBeVisible();

    const name = uniqueName('TestPlaylist');
    await moodboardPage.savePlaylist(name);

    // Success notification should appear
    await expect(page.getByText(/saved successfully/i)).toBeVisible({ timeout: 5_000 });
  });
});
