import 'dotenv/config';
import { db } from '../db';

const client = db();

/**
 * Generalized tag edit system — supports any ID3 field, not just comments.
 * Handles both export (DB→file) and import (file→DB) directions.
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS mp3_pending_tag_edits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    field_name TEXT NOT NULL,
    original_value TEXT,
    new_value TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'export' CHECK (direction IN ('export', 'import')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'rejected'))
  );
`);

client.exec(`
  CREATE INDEX IF NOT EXISTS idx_tag_edits_status ON mp3_pending_tag_edits(status);
`);

client.exec(`
  CREATE INDEX IF NOT EXISTS idx_tag_edits_file ON mp3_pending_tag_edits(file_path, status);
`);

client.exec(`
  CREATE TABLE IF NOT EXISTS mp3_tag_edit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'export',
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reverted INTEGER DEFAULT 0 CHECK (reverted IN (0, 1))
  );
`);

export const insertTagEdit = `
  INSERT INTO mp3_pending_tag_edits (file_path, field_name, original_value, new_value, direction)
  VALUES (?, ?, ?, ?, ?);
`;

export const getTagEditsByStatus = `
  SELECT id, file_path, field_name, original_value, new_value, direction, created_at, status
  FROM mp3_pending_tag_edits
  WHERE status = ?
  ORDER BY created_at DESC;
`;

export const getTagEditsByFile = `
  SELECT id, file_path, field_name, original_value, new_value, direction, created_at, status
  FROM mp3_pending_tag_edits
  WHERE file_path = ? AND status = 'pending'
  ORDER BY field_name;
`;

export const updateTagEditStatus = `
  UPDATE mp3_pending_tag_edits SET status = ? WHERE id = ?;
`;

export const deleteTagEdit = `
  DELETE FROM mp3_pending_tag_edits WHERE id = ?;
`;

export const insertTagHistory = `
  INSERT INTO mp3_tag_edit_history (file_path, field_name, old_value, new_value, direction)
  VALUES (?, ?, ?, ?, ?);
`;

export const getTagHistory = `
  SELECT id, file_path, field_name, old_value, new_value, direction, applied_at, reverted
  FROM mp3_tag_edit_history
  ORDER BY applied_at DESC;
`;

export const markTagHistoryReverted = `
  UPDATE mp3_tag_edit_history SET reverted = 1 WHERE id = ?;
`;
