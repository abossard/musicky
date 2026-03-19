import 'dotenv/config';
import { db } from '../db';

const client = db();

/**
 * SQLite Schema for Song Connections
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS song_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path TEXT NOT NULL,
    target_path TEXT NOT NULL,
    connection_type TEXT NOT NULL CHECK(connection_type IN ('similarity', 'transition', 'remix', 'custom')),
    weight REAL DEFAULT 1.0 CHECK(weight >= 0 AND weight <= 1),
    source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'id3_import', 'auto_discovered')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_path, target_path, connection_type)
  );
`);

// Create indexes for performance
client.exec(`
  CREATE INDEX IF NOT EXISTS idx_song_connections_source ON song_connections(source_path);
  CREATE INDEX IF NOT EXISTS idx_song_connections_target ON song_connections(target_path);
  CREATE INDEX IF NOT EXISTS idx_song_connections_type ON song_connections(connection_type);
`);

// SQL queries for song connections
export const addSongConnection = `
  INSERT INTO song_connections (source_path, target_path, connection_type, weight, source)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(source_path, target_path, connection_type)
  DO UPDATE SET weight = excluded.weight, source = excluded.source;
`;

export const getSongConnectionById = `
  SELECT id, source_path, target_path, connection_type, weight, source, created_at
  FROM song_connections
  WHERE id = ?;
`;

export const removeSongConnection = `
  DELETE FROM song_connections
  WHERE id = ?;
`;

export const removeSongConnectionByPaths = `
  DELETE FROM song_connections
  WHERE source_path = ? AND target_path = ? AND connection_type = ?;
`;

export const updateConnectionWeight = `
  UPDATE song_connections
  SET weight = ?
  WHERE id = ?;
`;

export const getConnectionsForSong = `
  SELECT id, source_path, target_path, connection_type, weight, source, created_at
  FROM song_connections
  WHERE source_path = ? OR target_path = ?
  ORDER BY weight DESC;
`;

export const getOutgoingConnections = `
  SELECT id, source_path, target_path, connection_type, weight, source, created_at
  FROM song_connections
  WHERE source_path = ?
  ORDER BY weight DESC;
`;

export const getIncomingConnections = `
  SELECT id, source_path, target_path, connection_type, weight, source, created_at
  FROM song_connections
  WHERE target_path = ?
  ORDER BY weight DESC;
`;

export const getConnectionBetween = `
  SELECT id, source_path, target_path, connection_type, weight, source, created_at
  FROM song_connections
  WHERE (source_path = ? AND target_path = ?) OR (source_path = ? AND target_path = ?)
  ORDER BY connection_type;
`;

export const getAllConnections = `
  SELECT id, source_path, target_path, connection_type, weight, source, created_at
  FROM song_connections
  ORDER BY created_at DESC;
`;

export const getAllConnectionsByType = `
  SELECT id, source_path, target_path, connection_type, weight, source, created_at
  FROM song_connections
  WHERE connection_type = ?
  ORDER BY created_at DESC;
`;

export const getConnectedSongsOutgoing = `
  SELECT target_path AS file_path, connection_type, weight, 'outgoing' AS direction
  FROM song_connections
  WHERE source_path = ?;
`;

export const getConnectedSongsIncoming = `
  SELECT source_path AS file_path, connection_type, weight, 'incoming' AS direction
  FROM song_connections
  WHERE target_path = ?;
`;

export const clearConnectionsForSong = `
  DELETE FROM song_connections
  WHERE source_path = ? OR target_path = ?;
`;
