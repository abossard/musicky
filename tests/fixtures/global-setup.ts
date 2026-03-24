import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import sqlite from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Camelot key conversion for test setup (subset of lib/camelot.ts) */
const MINOR_TO_CAMELOT: Record<string, string> = {
  'Ab': '1A', 'G#': '1A', 'Eb': '2A', 'D#': '2A', 'Bb': '3A', 'A#': '3A',
  'F': '4A', 'C': '5A', 'G': '6A', 'D': '7A', 'A': '8A', 'E': '9A',
  'B': '10A', 'F#': '11A', 'Gb': '11A', 'C#': '12A', 'Db': '12A',
};
const MAJOR_TO_CAMELOT: Record<string, string> = {
  'B': '1B', 'F#': '2B', 'Gb': '2B', 'C#': '3B', 'Db': '3B', 'Ab': '4B', 'G#': '4B',
  'Eb': '5B', 'D#': '5B', 'Bb': '6B', 'A#': '6B', 'F': '7B', 'C': '8B',
  'G': '9B', 'D': '10B', 'A': '11B', 'E': '12B',
};
function testStandardToCamelot(key: string): string | null {
  if (!key) return null;
  const minor = key.endsWith('m');
  const root = minor ? key.slice(0, -1) : key;
  return minor ? (MINOR_TO_CAMELOT[root] ?? null) : (MAJOR_TO_CAMELOT[root] ?? null);
}

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

  // Ensure mp3_file_cache has MIK columns (migrate existing databases)
  const cols = db.pragma('table_info(mp3_file_cache)').map((c: any) => c.name as string);
  if (!cols.includes('key')) db.exec('ALTER TABLE mp3_file_cache ADD COLUMN key TEXT');
  if (!cols.includes('camelot_key')) db.exec('ALTER TABLE mp3_file_cache ADD COLUMN camelot_key TEXT');
  if (!cols.includes('bpm')) db.exec('ALTER TABLE mp3_file_cache ADD COLUMN bpm REAL');
  if (!cols.includes('energy_level')) db.exec('ALTER TABLE mp3_file_cache ADD COLUMN energy_level INTEGER');
  if (!cols.includes('label')) db.exec('ALTER TABLE mp3_file_cache ADD COLUMN label TEXT');

  // Pre-populate the MP3 cache by scanning test-music recursively
  db.prepare('DELETE FROM mp3_file_cache').run();

  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO mp3_file_cache (file_path, filename, artist, title, album, duration, file_size, key, camelot_key, bpm, energy_level, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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

  // Assign test MIK data based on file index for variety
  const testKeys = ['Am', 'Cm', 'Gm', 'Dm', 'F', 'C', 'Em', 'Bm', 'F#m', 'A#m', 'Ebm', 'G#'];
  const testBpms = [120, 122, 124, 125, 126, 128, 130, 132, 118, 115, 127, 129];
  const testEnergies = [3, 4, 5, 6, 6, 7, 7, 8, 8, 9, 5, 6];

  // Write TKEY + TXXX:EnergyLevel + TBPM to test MP3s using node-id3
  let NodeID3: any;
  try {
    NodeID3 = await import('node-id3').then(m => m.default || m);
  } catch {
    console.warn('[test-setup] node-id3 not available, skipping MIK tag writes');
  }

  const insertAll = db.transaction(() => {
    for (let i = 0; i < mp3Files.length; i++) {
      const filePath = mp3Files[i];
      const filename = path.basename(filePath);
      const fileSize = fs.statSync(filePath).size;
      const parsed = parseFilename(filename);
      const key = testKeys[i % testKeys.length];
      const camelotKey = testStandardToCamelot(key);
      const bpm = testBpms[i % testBpms.length];
      const energy = testEnergies[i % testEnergies.length];

      insertStmt.run(
        filePath, filename, parsed.artist || null, parsed.title || null,
        null, null, fileSize, key, camelotKey, bpm, energy, null
      );
    }
  });
  insertAll();

  // Write MIK-style tags to actual test MP3 files (outside DB transaction)
  if (NodeID3) {
    let written = 0;
    for (let i = 0; i < mp3Files.length; i++) {
      const filePath = mp3Files[i];
      const key = testKeys[i % testKeys.length];
      const bpm = testBpms[i % testBpms.length];
      const energy = testEnergies[i % testEnergies.length];
      try {
        NodeID3.update({
          initialKey: key,
          bpm: String(bpm),
          userDefinedText: [
            { description: 'EnergyLevel', value: String(energy) },
          ],
        }, filePath);
        written++;
      } catch (e: any) {
        console.warn(`[test-setup] Failed to write MIK tags to ${path.basename(filePath)}: ${e.message}`);
      }
    }
    console.log(`[test-setup] Wrote MIK tags to ${written}/${mp3Files.length} files`);
  }

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
