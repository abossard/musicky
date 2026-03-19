import { test, expect, uniqueName } from '../fixtures/app-fixture';
import path from 'path';
import sqlite from 'better-sqlite3';

function resetCanvasState() {
  const db = sqlite(path.resolve('sqlite.db'));
  db.exec('DELETE FROM canvas_positions');
  db.exec('DELETE FROM song_connections');
  db.close();
}

/**
 * Seed the canvas with songs and tags (including phase tags)
 * so the playlist generator has data to work with.
 * Uses canvas_positions + song_tags (the tables the canvas actually reads).
 */
function setupBoardForPlaylist() {
  const db = sqlite(path.resolve('sqlite.db'));
  // Clear canvas state
  db.prepare('DELETE FROM canvas_positions').run();

  const songs = db
    .prepare('SELECT file_path, filename, artist, title FROM mp3_file_cache ORDER BY file_path')
    .all() as { file_path: string; filename: string; artist: string | null; title: string | null }[];

  // Place songs on canvas via canvas_positions
  const insertPos = db.prepare(
    'INSERT OR REPLACE INTO canvas_positions (node_id, position_x, position_y) VALUES (?,?,?)',
  );
  songs.forEach((s, i) => {
    insertPos.run(`song:${s.file_path}`, (i % 7) * 160, Math.floor(i / 7) * 160);
  });

  // Phase + genre + mood tags placed on canvas
  const tags = [
    { label: 'opener', cat: 'phase' },
    { label: 'buildup', cat: 'phase' },
    { label: 'peak', cat: 'phase' },
    { label: 'closer', cat: 'phase' },
    { label: 'techno', cat: 'genre' },
    { label: 'house', cat: 'genre' },
    { label: 'dark', cat: 'mood' },
    { label: 'dreamy', cat: 'mood' },
  ];
  tags.forEach((t, i) => {
    insertPos.run(`tag:${t.cat}:${t.label}`, -300 + i * 60, -200 + i * 60);
  });

  // Connect songs to tags via song_tags table
  const rules: [string, string, string][] = [
    ['artbat', 'dark', 'mood'],
    ['artbat', 'techno', 'genre'],
    ['artbat', 'peak', 'phase'],
    ['anyma', 'dreamy', 'mood'],
    ['anyma', 'buildup', 'phase'],
    ['dom dolla', 'house', 'genre'],
    ['dom dolla', 'peak', 'phase'],
    ['elderbrook', 'dreamy', 'mood'],
    ['elderbrook', 'buildup', 'phase'],
    ['empire of the sun', 'dreamy', 'mood'],
    ['empire of the sun', 'closer', 'phase'],
    ['moby', 'dreamy', 'mood'],
    ['moby', 'closer', 'phase'],
    ['jack orley', 'house', 'genre'],
    ['jack orley', 'opener', 'phase'],
    ['jazzy', 'house', 'genre'],
    ['jazzy', 'opener', 'phase'],
    ['morten', 'techno', 'genre'],
    ['morten', 'dark', 'mood'],
    ['morten', 'peak', 'phase'],
    ['hi-lo', 'techno', 'genre'],
    ['hi-lo', 'dark', 'mood'],
    ['hi-lo', 'peak', 'phase'],
    ['jamie jones', 'house', 'genre'],
    ['jamie jones', 'peak', 'phase'],
    ['rivo', 'dreamy', 'mood'],
    ['rivo', 'buildup', 'phase'],
    ['pete tong', 'techno', 'genre'],
    ['pete tong', 'peak', 'phase'],
    ['enai', 'dreamy', 'mood'],
    ['enai', 'buildup', 'phase'],
    ['benny benassi', 'techno', 'genre'],
    ['benny benassi', 'peak', 'phase'],
    ['sonique', 'house', 'genre'],
    ['sonique', 'opener', 'phase'],
    ['rufus', 'dreamy', 'mood'],
    ['rufus', 'closer', 'phase'],
  ];

  const insertTag = db.prepare(
    'INSERT OR IGNORE INTO song_tags (file_path, tag_label, tag_category, source) VALUES (?,?,?,?)',
  );
  for (const song of songs) {
    const lowerPath = song.file_path.toLowerCase();
    for (const [kw, label, category] of rules) {
      if (lowerPath.includes(kw)) {
        insertTag.run(song.file_path, label, category, 'manual');
      }
    }
  }

  // The playlist generator reads from song_connections to find songs.
  // Create similarity connections between songs to ensure they appear.
  db.exec(`CREATE TABLE IF NOT EXISTS song_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path TEXT NOT NULL,
    target_path TEXT NOT NULL,
    connection_type TEXT DEFAULT 'similarity',
    weight REAL DEFAULT 0.5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_path, target_path)
  )`);
  db.prepare('DELETE FROM song_connections').run();

  const insertConn = db.prepare(
    'INSERT OR IGNORE INTO song_connections (source_path, target_path, connection_type, weight) VALUES (?,?,?,?)',
  );
  // Create chain connections between consecutive songs
  for (let i = 0; i < songs.length - 1; i++) {
    insertConn.run(songs[i].file_path, songs[i + 1].file_path, 'similarity', 0.7);
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

  test.afterAll(() => {
    resetCanvasState();
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
