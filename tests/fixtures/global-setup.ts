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

  // Pre-populate the MP3 cache with test music files
  db.prepare('DELETE FROM mp3_file_cache').run();

  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO mp3_file_cache (file_path, filename, artist, title, album, duration, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const testFiles = [
    { file: 'Kevin_MacLeod_-_Carefree.mp3', artist: 'Kevin MacLeod', title: 'Carefree', album: 'Royalty Free', duration: 163 },
    { file: 'Kevin_MacLeod_-_Monkeys_Spinning_Monkeys.mp3', artist: 'Kevin MacLeod', title: 'Monkeys Spinning Monkeys', album: 'Royalty Free', duration: 121 },
    { file: 'Kevin_MacLeod_-_Wallpaper.mp3', artist: 'Kevin MacLeod', title: 'Wallpaper', album: 'Royalty Free', duration: 222 },
    { file: 'Chill_Electronic_-_Lakey_Inspired.mp3', artist: 'Lakey Inspired', title: 'Chill Electronic', album: null, duration: 60 },
    { file: 'Jazz_Standards_-_Blue_Dot_Sessions.mp3', artist: 'Blue Dot Sessions', title: 'Jazz Standards', album: null, duration: 60 },
  ];

  const insertAll = db.transaction(() => {
    for (const t of testFiles) {
      const filePath = path.join(testMusicFolder, t.file);
      const fileSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
      insertStmt.run(filePath, t.file, t.artist, t.title, t.album, t.duration, fileSize);
    }
  });
  insertAll();

  db.close();
  console.log(`[test-setup] Done — cached ${testFiles.length} test MP3 files`);
}

export default globalSetup;
