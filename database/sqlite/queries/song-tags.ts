import { db } from '../db';
import * as queries from '../schema/song-tags';

const client = db();

export type TagCategory = 'genre' | 'phase' | 'mood' | 'topic' | 'custom';
export type TagSource = 'manual' | 'id3_import' | 'auto_discovered';

export interface SongTag {
  id: number;
  file_path: string;
  tag_label: string;
  tag_category: TagCategory;
  source: TagSource;
  created_at: string;
}

export interface TagCount {
  tag_label: string;
  tag_category: TagCategory;
  count: number;
}

// Add a tag to a song (upsert - ignore if exists)
export function addSongTag(filePath: string, tagLabel: string, category: TagCategory, source: TagSource = 'manual'): SongTag | null {
  client.prepare(queries.insertSongTag).run(filePath, tagLabel, category, source);
  return client.prepare(queries.getSongTagByUnique).get(filePath, tagLabel, category) as SongTag | null;
}

// Remove a specific tag from a song
export function removeSongTag(filePath: string, tagLabel: string, category: TagCategory): void {
  client.prepare(queries.deleteSongTag).run(filePath, tagLabel, category);
}

// Get all tags for a song
export function getTagsForSong(filePath: string): SongTag[] {
  return client.prepare(queries.getTagsForSong).all(filePath) as SongTag[];
}

// Get all tags for all songs in a single query
export function getAllSongTags(): SongTag[] {
  return client.prepare('SELECT * FROM song_tags ORDER BY file_path').all() as SongTag[];
}

// Get all tags for a song filtered by category
export function getTagsForSongByCategory(filePath: string, category: TagCategory): SongTag[] {
  return client.prepare(queries.getTagsForSongByCategory).all(filePath, category) as SongTag[];
}

// Get all songs that have a specific tag
export function getSongsForTag(tagLabel: string, category: TagCategory): SongTag[] {
  return client.prepare(queries.getSongsForTag).all(tagLabel, category) as SongTag[];
}

// Get all unique tags (optionally filtered by category)
export function getAllTags(category?: TagCategory): TagCount[] {
  if (category) {
    return client.prepare(queries.getAllTagsByCategory).all(category) as TagCount[];
  }
  return client.prepare(queries.getAllTags).all() as TagCount[];
}

// Get all unique tags for songs in a specific folder (base path prefix match)
export function getTagsInFolder(basePath: string, category?: TagCategory): TagCount[] {
  const prefix = `${basePath}%`;
  if (category) {
    return client.prepare(queries.getTagsInFolderByCategory).all(prefix, category) as TagCount[];
  }
  return client.prepare(queries.getTagsInFolder).all(prefix) as TagCount[];
}

// Bulk add tags for a song (within a transaction)
export function bulkSetSongTags(filePath: string, tags: { label: string; category: TagCategory; source?: TagSource }[]): void {
  const insertStmt = client.prepare(queries.insertSongTag);

  const transaction = client.transaction((items: { label: string; category: TagCategory; source?: TagSource }[]) => {
    for (const tag of items) {
      insertStmt.run(filePath, tag.label, tag.category, tag.source || 'manual');
    }
  });

  transaction(tags);
}

// Remove all tags for a song (used before bulk re-import)
export function clearSongTags(filePath: string, category?: TagCategory): void {
  if (category) {
    client.prepare(queries.clearSongTagsByCategory).run(filePath, category);
  } else {
    client.prepare(queries.clearSongTags).run(filePath);
  }
}

// Search tags by label prefix
export function searchTags(query: string, category?: TagCategory, limit: number = 20): TagCount[] {
  const searchTerm = `${query}%`;
  if (category) {
    return client.prepare(queries.searchTagsByCategory).all(searchTerm, category, limit) as TagCount[];
  }
  return client.prepare(queries.searchTags).all(searchTerm, limit) as TagCount[];
}
