/**
 * Domain types for Musicky — the single source of truth for types
 * shared between server (telefunc) and client (React components).
 *
 * Frontend code should import from here, NOT from database/sqlite/.
 */

/** Tag categories */
export type TagCategory = 'genre' | 'phase' | 'mood' | 'topic' | 'custom';

/** Song info for display */
export interface SongInfo {
  filePath: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  key?: string;
  camelotKey?: string;
  bpm?: number;
  energyLevel?: number;
  label?: string;
}

/** Tag info for display */
export interface TagInfo {
  label: string;
  category: TagCategory;
  count?: number;
}

/** Connection between songs */
export interface SongConnection {
  sourceFilePath: string;
  targetFilePath: string;
  connectionType: string;
  weight: number;
}

// ---------------------------------------------------------------------------
// Re-exported DB-compatible shapes used by existing frontend components.
// These mirror the database query result interfaces so that frontend code
// can import them from this module instead of reaching into database/.
// ---------------------------------------------------------------------------

/** MP3 cache item — matches the shape returned by dj-sets queries */
export interface MP3CacheItem {
  file_path: string;
  filename: string;
  artist?: string;
  title?: string;
  album?: string;
  duration?: number;
  file_size?: number;
  last_modified?: string;
  key?: string;
  camelot_key?: string;
  bpm?: number;
  energy_level?: number;
  label?: string;
}

/** MP3 search result — subset of cache item for search display */
export interface MP3SearchResult {
  file_path: string;
  filename: string;
  artist?: string;
  title?: string;
  album?: string;
  duration?: number;
  key?: string;
  camelot_key?: string;
  bpm?: number;
  energy_level?: number;
  label?: string;
}

/** A pending tag edit awaiting review */
export interface PendingTagEdit {
  id: number;
  filePath: string;
  fieldName: string;
  originalValue: string | null;
  newValue: string;
  direction: 'export' | 'import';
  createdAt: string;
  status: 'pending' | 'applied' | 'failed' | 'rejected';
}

/** Historical record of an applied tag edit */
export interface TagEditHistory {
  id: number;
  filePath: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string;
  direction: string;
  appliedAt: string;
  reverted: boolean;
}
