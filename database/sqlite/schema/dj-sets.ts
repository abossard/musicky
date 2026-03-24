import 'dotenv/config';
import { db } from '../db';

const client = db();

/**
 * SQLite Schema for DJ Sets
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS dj_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * SQLite Schema for DJ Set Items
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS dj_set_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    position INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (set_id) REFERENCES dj_sets(id) ON DELETE CASCADE
  );
`);

/**
 * SQLite Schema for MP3 File Cache
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS mp3_file_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    artist TEXT,
    title TEXT,
    album TEXT,
    duration INTEGER,
    file_size INTEGER,
    last_modified DATETIME,
    indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    key TEXT,
    camelot_key TEXT,
    bpm REAL,
    energy_level INTEGER,
    label TEXT
  );
`);

// Add new columns if they don't exist (for existing databases)
const cacheColumns = (client.pragma('table_info(mp3_file_cache)') as { name: string }[]).map(c => c.name);
if (!cacheColumns.includes('key')) client.exec('ALTER TABLE mp3_file_cache ADD COLUMN key TEXT');
if (!cacheColumns.includes('camelot_key')) client.exec('ALTER TABLE mp3_file_cache ADD COLUMN camelot_key TEXT');
if (!cacheColumns.includes('bpm')) client.exec('ALTER TABLE mp3_file_cache ADD COLUMN bpm REAL');
if (!cacheColumns.includes('energy_level')) client.exec('ALTER TABLE mp3_file_cache ADD COLUMN energy_level INTEGER');
if (!cacheColumns.includes('label')) client.exec('ALTER TABLE mp3_file_cache ADD COLUMN label TEXT');

// Create indexes for performance
client.exec(`
  CREATE INDEX IF NOT EXISTS idx_dj_set_items_set_id ON dj_set_items(set_id);
  CREATE INDEX IF NOT EXISTS idx_dj_set_items_position ON dj_set_items(set_id, position);
  CREATE INDEX IF NOT EXISTS idx_mp3_cache_search ON mp3_file_cache(artist, title, filename);
  CREATE INDEX IF NOT EXISTS idx_mp3_cache_path ON mp3_file_cache(file_path);
`);

// SQL queries for DJ sets
export const createDJSet = `
  INSERT INTO dj_sets (name, description)
  VALUES (?, ?);
`;

export const getDJSets = `
  SELECT id, name, description, created_at, updated_at
  FROM dj_sets
  ORDER BY updated_at DESC;
`;

export const getDJSetById = `
  SELECT id, name, description, created_at, updated_at
  FROM dj_sets
  WHERE id = ?;
`;

export const updateDJSet = `
  UPDATE dj_sets
  SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?;
`;

export const deleteDJSet = `
  DELETE FROM dj_sets
  WHERE id = ?;
`;

// SQL queries for DJ set items
export const addSongToSet = `
  INSERT INTO dj_set_items (set_id, file_path, position)
  VALUES (?, ?, ?);
`;

export const getSetItems = `
  SELECT id, set_id, file_path, position, added_at
  FROM dj_set_items
  WHERE set_id = ?
  ORDER BY position;
`;

export const removeSongFromSet = `
  DELETE FROM dj_set_items
  WHERE id = ?;
`;

export const updateItemPosition = `
  UPDATE dj_set_items
  SET position = ?
  WHERE id = ?;
`;

export const reorderSetItems = `
  UPDATE dj_set_items
  SET position = ?
  WHERE id = ?;
`;

// SQL queries for MP3 file cache
export const insertMP3Cache = `
  INSERT OR REPLACE INTO mp3_file_cache 
  (file_path, filename, artist, title, album, duration, file_size, last_modified, key, camelot_key, bpm, energy_level, label)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

export const searchMP3Cache = `
  SELECT file_path, filename, artist, title, album, duration, key, camelot_key, bpm, energy_level, label
  FROM mp3_file_cache
  WHERE (artist LIKE ? OR title LIKE ? OR filename LIKE ?)
  ORDER BY 
    CASE 
      WHEN title LIKE ? THEN 1
      WHEN artist LIKE ? THEN 2
      ELSE 3
    END,
    artist, title
  LIMIT ?;
`;

export const getMP3CacheByPath = `
  SELECT file_path, filename, artist, title, album, duration, last_modified, key, camelot_key, bpm, energy_level, label
  FROM mp3_file_cache
  WHERE file_path = ?;
`;

export const deleteMP3Cache = `
  DELETE FROM mp3_file_cache
  WHERE file_path = ?;
`;

export const clearOldCache = `
  DELETE FROM mp3_file_cache
  WHERE indexed_at < datetime('now', '-7 days');
`;