import 'dotenv/config';
import { db } from '../db';

const client = db();

/**
 * SQLite Schema for Playlists
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    generation_params TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * SQLite Schema for Playlist Items
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS playlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    position INTEGER NOT NULL,
    phase TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
  );
`);

// Create indexes for performance
client.exec(`
  CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id);
  CREATE INDEX IF NOT EXISTS idx_playlist_items_position ON playlist_items(playlist_id, position);
`);

// SQL queries for playlists
export const createPlaylist = `
  INSERT INTO playlists (name, description, generation_params)
  VALUES (?, ?, ?);
`;

export const getPlaylists = `
  SELECT id, name, description, generation_params, created_at, updated_at
  FROM playlists
  ORDER BY updated_at DESC;
`;

export const getPlaylistById = `
  SELECT id, name, description, generation_params, created_at, updated_at
  FROM playlists
  WHERE id = ?;
`;

export const updatePlaylist = `
  UPDATE playlists
  SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?;
`;

export const deletePlaylist = `
  DELETE FROM playlists
  WHERE id = ?;
`;

// SQL queries for playlist items
export const addPlaylistItem = `
  INSERT INTO playlist_items (playlist_id, file_path, position, phase)
  VALUES (?, ?, ?, ?);
`;

export const getPlaylistItems = `
  SELECT id, playlist_id, file_path, position, phase, added_at
  FROM playlist_items
  WHERE playlist_id = ?
  ORDER BY position;
`;

export const removePlaylistItem = `
  DELETE FROM playlist_items
  WHERE playlist_id = ? AND id = ?;
`;

export const updateItemPosition = `
  UPDATE playlist_items
  SET position = ?
  WHERE id = ?;
`;

export const deletePlaylistItems = `
  DELETE FROM playlist_items
  WHERE playlist_id = ?;
`;
