import { db } from '../db';

const client = db();

client.exec(`
  CREATE TABLE IF NOT EXISTS phase_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phase_name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phase_name, version)
  );
`);

client.exec(`
  CREATE INDEX IF NOT EXISTS idx_phase_versions_name ON phase_versions(phase_name);
`);

// SQL queries for phase versions
export const getPhaseVersions = `
  SELECT id, phase_name, version, is_active, created_at
  FROM phase_versions
  WHERE phase_name = ?
  ORDER BY version DESC;
`;

export const getActiveVersion = `
  SELECT id, phase_name, version, is_active, created_at
  FROM phase_versions
  WHERE phase_name = ? AND is_active = 1
  ORDER BY version DESC
  LIMIT 1;
`;

export const deactivateVersion = `
  UPDATE phase_versions
  SET is_active = 0
  WHERE phase_name = ? AND is_active = 1;
`;

export const insertVersion = `
  INSERT INTO phase_versions (phase_name, version, is_active)
  VALUES (?, ?, 1);
`;

export const renameSongTags = `
  UPDATE song_tags
  SET tag_label = ?
  WHERE tag_label = ? AND tag_category = 'phase';
`;

export const getSongsWithTag = `
  SELECT file_path
  FROM song_tags
  WHERE tag_label = ? AND tag_category = 'phase';
`;

export const insertSongTag = `
  INSERT OR IGNORE INTO song_tags (file_path, tag_label, tag_category, source)
  VALUES (?, ?, 'phase', 'manual');
`;

export const getAllActiveVersions = `
  SELECT phase_name, version
  FROM phase_versions
  WHERE is_active = 1
  ORDER BY phase_name;
`;
