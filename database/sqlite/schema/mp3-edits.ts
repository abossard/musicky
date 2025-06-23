import "dotenv/config";
import { db } from "../db";

const client = db();

/**
 * SQLite Schema for MP3 pending edits
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS mp3_pending_edits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    original_comment TEXT,
    new_comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed'))
  );
`);

export const insertPendingEdit = `
  INSERT INTO mp3_pending_edits (file_path, original_comment, new_comment)
  VALUES (?, ?, ?);
`;

export const getPendingEdits = `
  SELECT id, file_path, original_comment, new_comment, created_at, status
  FROM mp3_pending_edits
  WHERE status = 'pending'
  ORDER BY created_at DESC;
`;

export const getAllPendingEdits = `
  SELECT id, file_path, original_comment, new_comment, created_at, status
  FROM mp3_pending_edits
  ORDER BY created_at DESC;
`;

export const updateEditStatus = `
  UPDATE mp3_pending_edits
  SET status = ?
  WHERE id = ?;
`;

export const deletePendingEdit = `
  DELETE FROM mp3_pending_edits
  WHERE id = ?;
`;

export const updatePendingEdit = `
  UPDATE mp3_pending_edits
  SET new_comment = ?
  WHERE id = ?;
`;
