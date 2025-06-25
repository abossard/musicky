import 'dotenv/config';
import { db } from '../db';

const client = db();

/**
 * SQLite Schema for library settings
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS library_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    base_folder TEXT,
    phases TEXT
  );
`);

// Add phases column if it doesn't exist (for existing databases)
try {
  client.exec(`ALTER TABLE library_settings ADD COLUMN phases TEXT;`);
} catch (error) {
  // Column might already exist, ignore the error
}

// Add keep_play_head column if it doesn't exist (for existing databases)
try {
  client.exec(`ALTER TABLE library_settings ADD COLUMN keep_play_head INTEGER DEFAULT 0;`);
} catch (error) {
  // Column might already exist, ignore the error
}

export const setBaseFolder = `
  INSERT INTO library_settings (id, base_folder)
  VALUES (1, ?)
  ON CONFLICT(id) DO UPDATE SET base_folder = excluded.base_folder;
`;

export const getBaseFolder = `
  SELECT base_folder FROM library_settings WHERE id = 1;
`;

export const setPhases = `
  INSERT INTO library_settings (id, phases)
  VALUES (1, ?)
  ON CONFLICT(id) DO UPDATE SET phases = excluded.phases;
`;

export const getPhases = `
  SELECT phases FROM library_settings WHERE id = 1;
`;

export const setKeepPlayHead = `
  INSERT INTO library_settings (id, keep_play_head)
  VALUES (1, ?)
  ON CONFLICT(id) DO UPDATE SET keep_play_head = excluded.keep_play_head;
`;

export const getKeepPlayHead = `
  SELECT keep_play_head FROM library_settings WHERE id = 1;
`;
