import 'dotenv/config';
import { db } from '../db';

const client = db();

/**
 * SQLite Schema for edit history
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS mp3_edit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    old_comment TEXT,
    new_comment TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reverted INTEGER DEFAULT 0 CHECK (reverted IN (0,1))
  );
`);

export const insertHistory = `
  INSERT INTO mp3_edit_history (file_path, old_comment, new_comment)
  VALUES (?, ?, ?);
`;

export const getHistory = `
  SELECT id, file_path, old_comment, new_comment, applied_at, reverted
  FROM mp3_edit_history
  ORDER BY applied_at DESC;
`;

export const markReverted = `
  UPDATE mp3_edit_history SET reverted = 1 WHERE id = ?;
`;
