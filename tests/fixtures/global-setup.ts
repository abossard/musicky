import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sqlite from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright global setup: configure the test music folder and pre-populate
 * the MP3 cache so song search works immediately in tests.
 */
async function globalSetup() {
  const dbPath = process.env.DATABASE_URL || path.join(__dirname, '..', '..', 'sqlite.db');
  const testMusicFolder = path.resolve(__dirname, '..', '..', 'test-music');

  console.log(`[test-setup] Setting base folder to: ${testMusicFolder}`);
  console.log(`[test-setup] Using database: ${dbPath}`);

  const db = sqlite(dbPath);

  // Set the base folder to test-music
  const row = db.prepare('SELECT id FROM library_settings LIMIT 1').get() as any;
  if (row) {
    db.prepare('UPDATE library_settings SET base_folder = ? WHERE id = ?').run(testMusicFolder, row.id);
  } else {
    db.prepare('INSERT INTO library_settings (base_folder) VALUES (?)').run(testMusicFolder);
  }

  // Pre-populate the MP3 cache by scanning test-music recursively
  db.prepare('DELETE FROM mp3_file_cache').run();

  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO mp3_file_cache (file_path, filename, artist, title, album, duration, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // Recursively find all MP3 files
  function findMp3s(dir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findMp3s(full));
      } else if (entry.name.toLowerCase().endsWith('.mp3')) {
        results.push(full);
      }
    }
    return results;
  }

  const mp3Files = findMp3s(testMusicFolder);

  // Parse title/artist from filename as fallback (e.g. "Artist - Title (Mix).mp3")
  function parseFilename(filename: string): { artist: string; title: string } {
    const name = filename.replace(/\.mp3$/i, '');
    const parts = name.split(' - ');
    if (parts.length >= 2) {
      return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
    }
    return { artist: '', title: name };
  }

  const insertAll = db.transaction(() => {
    for (const filePath of mp3Files) {
      const filename = path.basename(filePath);
      const fileSize = fs.statSync(filePath).size;
      const parsed = parseFilename(filename);
      insertStmt.run(filePath, filename, parsed.artist || null, parsed.title || null, null, null, fileSize);
    }
  });
  insertAll();

  // Clear stale moodboard data so tests start fresh
  db.prepare('DELETE FROM moodboard_edges').run();
  db.prepare('DELETE FROM moodboard_nodes').run();
  db.prepare('DELETE FROM moodboards').run();

  // Ensure new schema tables exist (may not if migrations haven't run yet)
  db.exec(`CREATE TABLE IF NOT EXISTS song_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    tag_label TEXT NOT NULL,
    tag_category TEXT NOT NULL CHECK(tag_category IN ('genre', 'phase', 'mood', 'topic', 'custom')),
    source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'id3_import', 'auto_discovered')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_path, tag_label, tag_category)
  )`);

  // Clear new schema tables for clean state
  db.exec('DELETE FROM phase_edges');
  db.exec('DELETE FROM song_tags');
  db.exec('DELETE FROM song_connections');
  db.exec('DELETE FROM canvas_positions');
  db.exec('DELETE FROM canvas_state');

  // Seed default phase edges: opener → buildup → peak → cooldown → closer
  const defaultPhaseFlow: [string, string][] = [
    ['opener', 'buildup'],
    ['buildup', 'peak'],
    ['peak', 'cooldown'],
    ['cooldown', 'closer'],
  ];
  const insertPhaseEdge = db.prepare(
    'INSERT OR IGNORE INTO phase_edges (from_phase, to_phase, weight) VALUES (?, ?, ?)'
  );
  for (const [from, to] of defaultPhaseFlow) {
    insertPhaseEdge.run(from, to, 1.0);
  }

  // Seed default song tags for some test songs
  const insertSongTag = db.prepare(
    'INSERT OR IGNORE INTO song_tags (file_path, tag_label, tag_category, source) VALUES (?, ?, ?, ?)'
  );
  const cachedSongs = db.prepare('SELECT file_path FROM mp3_file_cache ORDER BY file_path').all() as { file_path: string }[];
  const tagRules: [string, string, string][] = [
    // [keyword in filename, tag_label, tag_category]
    ['artbat', 'techno', 'genre'],
    ['artbat', 'dark', 'mood'],
    ['artbat', 'peak', 'phase'],
    ['anyma', 'progressive', 'genre'],
    ['anyma', 'dreamy', 'mood'],
    ['anyma', 'buildup', 'phase'],
    ['dom dolla', 'house', 'genre'],
    ['dom dolla', 'energetic', 'mood'],
    ['dom dolla', 'peak', 'phase'],
  ];
  for (const song of cachedSongs) {
    const lowerPath = song.file_path.toLowerCase();
    for (const [keyword, label, category] of tagRules) {
      if (lowerPath.includes(keyword)) {
        insertSongTag.run(song.file_path, label, category, 'manual');
      }
    }
  }

  // Clear tag sync tables (use IF EXISTS since they may not exist on first run)
  db.exec('CREATE TABLE IF NOT EXISTS mp3_pending_tag_edits (id INTEGER PRIMARY KEY AUTOINCREMENT, file_path TEXT NOT NULL, field_name TEXT NOT NULL, original_value TEXT, new_value TEXT NOT NULL, direction TEXT NOT NULL DEFAULT \'export\', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT \'pending\')');
  db.exec('CREATE TABLE IF NOT EXISTS mp3_tag_edit_history (id INTEGER PRIMARY KEY AUTOINCREMENT, file_path TEXT NOT NULL, field_name TEXT NOT NULL, old_value TEXT, new_value TEXT NOT NULL, direction TEXT NOT NULL DEFAULT \'export\', applied_at DATETIME DEFAULT CURRENT_TIMESTAMP, reverted INTEGER DEFAULT 0)');
  db.exec('DELETE FROM mp3_pending_tag_edits');
  db.exec('DELETE FROM mp3_tag_edit_history');

  db.close();
  console.log(`[test-setup] Done — cached ${mp3Files.length} MP3 files from ${testMusicFolder}`);
}

export default globalSetup;
