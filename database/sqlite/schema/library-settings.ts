import 'dotenv/config';
import { db } from '../db';

const client = db();

/**
 * SQLite Schema for library settings
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS library_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    base_folder TEXT
  );
`);

export const setBaseFolder = `
  INSERT INTO library_settings (id, base_folder)
  VALUES (1, ?)
  ON CONFLICT(id) DO UPDATE SET base_folder = excluded.base_folder;
`;

export const getBaseFolder = `
  SELECT base_folder FROM library_settings WHERE id = 1;
`;
