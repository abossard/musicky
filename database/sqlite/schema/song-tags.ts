import 'dotenv/config';
import { db } from '../db';

const client = db();

/**
 * SQLite Schema for Song Tags
 */
client.exec(`
  CREATE TABLE IF NOT EXISTS song_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    tag_label TEXT NOT NULL,
    tag_category TEXT NOT NULL CHECK(tag_category IN ('genre', 'phase', 'mood', 'topic', 'custom')),
    source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'id3_import', 'auto_discovered')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(file_path, tag_label, tag_category)
  );
`);

// Create indexes for performance
client.exec(`
  CREATE INDEX IF NOT EXISTS idx_song_tags_file ON song_tags(file_path);
  CREATE INDEX IF NOT EXISTS idx_song_tags_tag ON song_tags(tag_label, tag_category);
  CREATE INDEX IF NOT EXISTS idx_song_tags_category ON song_tags(tag_category);
`);

// SQL queries for song tags
export const insertSongTag = `
  INSERT OR IGNORE INTO song_tags (file_path, tag_label, tag_category, source)
  VALUES (?, ?, ?, ?);
`;

export const getSongTagByUnique = `
  SELECT id, file_path, tag_label, tag_category, source, created_at
  FROM song_tags
  WHERE file_path = ? AND tag_label = ? AND tag_category = ?;
`;

export const deleteSongTag = `
  DELETE FROM song_tags
  WHERE file_path = ? AND tag_label = ? AND tag_category = ?;
`;

export const getTagsForSong = `
  SELECT id, file_path, tag_label, tag_category, source, created_at
  FROM song_tags
  WHERE file_path = ?
  ORDER BY tag_category, tag_label;
`;

export const getTagsForSongByCategory = `
  SELECT id, file_path, tag_label, tag_category, source, created_at
  FROM song_tags
  WHERE file_path = ? AND tag_category = ?
  ORDER BY tag_label;
`;

export const getSongsForTag = `
  SELECT id, file_path, tag_label, tag_category, source, created_at
  FROM song_tags
  WHERE tag_label = ? AND tag_category = ?
  ORDER BY file_path;
`;

export const getAllTags = `
  SELECT tag_label, tag_category, COUNT(*) as count
  FROM song_tags
  GROUP BY tag_label, tag_category
  ORDER BY tag_category, tag_label;
`;

export const getAllTagsByCategory = `
  SELECT tag_label, tag_category, COUNT(*) as count
  FROM song_tags
  WHERE tag_category = ?
  GROUP BY tag_label, tag_category
  ORDER BY tag_label;
`;

export const getTagsInFolder = `
  SELECT tag_label, tag_category, COUNT(*) as count
  FROM song_tags
  WHERE file_path LIKE ?
  GROUP BY tag_label, tag_category
  ORDER BY tag_category, tag_label;
`;

export const getTagsInFolderByCategory = `
  SELECT tag_label, tag_category, COUNT(*) as count
  FROM song_tags
  WHERE file_path LIKE ? AND tag_category = ?
  GROUP BY tag_label, tag_category
  ORDER BY tag_label;
`;

export const clearSongTags = `
  DELETE FROM song_tags
  WHERE file_path = ?;
`;

export const clearSongTagsByCategory = `
  DELETE FROM song_tags
  WHERE file_path = ? AND tag_category = ?;
`;

export const searchTags = `
  SELECT tag_label, tag_category, COUNT(*) as count
  FROM song_tags
  WHERE tag_label LIKE ?
  GROUP BY tag_label, tag_category
  ORDER BY count DESC, tag_label
  LIMIT ?;
`;

export const searchTagsByCategory = `
  SELECT tag_label, tag_category, COUNT(*) as count
  FROM song_tags
  WHERE tag_label LIKE ? AND tag_category = ?
  GROUP BY tag_label, tag_category
  ORDER BY count DESC, tag_label
  LIMIT ?;
`;
