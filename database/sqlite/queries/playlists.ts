import { db } from '../db';
import * as queries from '../schema/playlists';

const client = db();

export interface Playlist {
  id: number;
  name: string;
  description: string | null;
  generation_params: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaylistItem {
  id: number;
  playlist_id: number;
  file_path: string;
  position: number;
  phase: string | null;
  added_at: string;
}

export interface GenerationParams {
  algorithm: string;
  phase_order: string[];
  mood_weight: number;
  connection_weight: number;
  generated_at: string;
}

// Playlist operations
export function createPlaylist(name: string, description?: string, generationParams?: GenerationParams): Playlist {
  const paramsJson = generationParams ? JSON.stringify(generationParams) : null;
  const result = client.prepare(queries.createPlaylist).run(name, description || null, paramsJson);
  return getPlaylist(result.lastInsertRowid as number)!;
}

export function getPlaylists(): Playlist[] {
  return client.prepare(queries.getPlaylists).all() as Playlist[];
}

export function getPlaylist(id: number): Playlist | null {
  return client.prepare(queries.getPlaylistById).get(id) as Playlist | null;
}

export function updatePlaylist(id: number, name: string, description?: string): void {
  client.prepare(queries.updatePlaylist).run(name, description || null, id);
}

export function deletePlaylist(id: number): void {
  client.prepare(queries.deletePlaylist).run(id);
}

// Playlist Items operations
export function getPlaylistItems(playlistId: number): PlaylistItem[] {
  return client.prepare(queries.getPlaylistItems).all(playlistId) as PlaylistItem[];
}

export function addPlaylistItem(playlistId: number, filePath: string, position: number, phase?: string): PlaylistItem {
  const result = client.prepare(queries.addPlaylistItem).run(playlistId, filePath, position, phase || null);
  const id = result.lastInsertRowid as number;
  return { id, playlist_id: playlistId, file_path: filePath, position, phase: phase || null, added_at: new Date().toISOString() };
}

export function removePlaylistItem(playlistId: number, itemId: number): void {
  client.prepare(queries.removePlaylistItem).run(playlistId, itemId);
}

export function reorderPlaylistItems(playlistId: number, itemIds: number[]): void {
  const stmt = client.prepare(queries.updateItemPosition);

  const transaction = client.transaction((ids: number[]) => {
    for (let i = 0; i < ids.length; i++) {
      stmt.run(i, ids[i]);
    }
  });

  transaction(itemIds);
}

// Bulk operations for playlist generation
export function setPlaylistItems(playlistId: number, items: { filePath: string; position: number; phase?: string }[]): void {
  const deleteStmt = client.prepare(queries.deletePlaylistItems);
  const insertStmt = client.prepare(queries.addPlaylistItem);

  const transaction = client.transaction((entries: { filePath: string; position: number; phase?: string }[]) => {
    deleteStmt.run(playlistId);
    for (const item of entries) {
      insertStmt.run(playlistId, item.filePath, item.position, item.phase || null);
    }
  });

  transaction(items);
}

// Get playlist with items
export function getPlaylistWithItems(id: number): { playlist: Playlist; items: PlaylistItem[] } | null {
  const playlist = getPlaylist(id);
  if (!playlist) return null;
  const items = getPlaylistItems(id);
  return { playlist, items };
}
