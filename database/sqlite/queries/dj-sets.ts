import { db } from '../db';
import * as queries from '../schema/dj-sets';

const client = db();

export interface DJSet {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DJSetItem {
  id: number;
  set_id: number;
  file_path: string;
  position: number;
  added_at: string;
}

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

// DJ Sets operations
export function createDJSet(name: string, description?: string): DJSet {
  const result = client.prepare(queries.createDJSet).run(name, description || null);
  return getDJSetById(result.lastInsertRowid as number)!;
}

export function getDJSets(): DJSet[] {
  return client.prepare(queries.getDJSets).all() as DJSet[];
}

export function getDJSetById(id: number): DJSet | null {
  return client.prepare(queries.getDJSetById).get(id) as DJSet | null;
}

export function updateDJSet(id: number, name: string, description?: string): void {
  client.prepare(queries.updateDJSet).run(name, description || null, id);
}

export function deleteDJSet(id: number): void {
  client.prepare(queries.deleteDJSet).run(id);
}

// DJ Set Items operations
export function addSongToSet(setId: number, filePath: string, position: number): void {
  client.prepare(queries.addSongToSet).run(setId, filePath, position);
}

export function getSetItems(setId: number): DJSetItem[] {
  return client.prepare(queries.getSetItems).all(setId) as DJSetItem[];
}

export function removeSongFromSet(itemId: number): void {
  client.prepare(queries.removeSongFromSet).run(itemId);
}

export function reorderSetItems(itemUpdates: { id: number; position: number }[]): void {
  const stmt = client.prepare(queries.reorderSetItems);
  
  const transaction = client.transaction((updates: { id: number; position: number }[]) => {
    for (const update of updates) {
      stmt.run(update.position, update.id);
    }
  });
  
  transaction(itemUpdates);
}

// MP3 Cache operations
export function insertMP3Cache(item: MP3CacheItem): void {
  client.prepare(queries.insertMP3Cache).run(
    item.file_path,
    item.filename,
    item.artist || null,
    item.title || null,
    item.album || null,
    item.duration || null,
    item.file_size || null,
    item.last_modified || null,
    item.key || null,
    item.camelot_key || null,
    item.bpm || null,
    item.energy_level || null,
    item.label || null
  );
}

export function searchMP3Cache(query: string, limit: number = 50): MP3SearchResult[] {
  const searchTerm = `%${query}%`;
  const priorityTerm = `${query}%`;
  
  return client.prepare(queries.searchMP3Cache).all(
    searchTerm, searchTerm, searchTerm, // Main search
    priorityTerm, priorityTerm, // Priority ranking
    limit
  ) as MP3SearchResult[];
}

export function getMP3CacheByPath(filePath: string): MP3CacheItem | null {
  return client.prepare(queries.getMP3CacheByPath).get(filePath) as MP3CacheItem | null;
}

export function deleteMP3Cache(filePath: string): void {
  client.prepare(queries.deleteMP3Cache).run(filePath);
}

export function clearOldCache(): void {
  client.prepare(queries.clearOldCache).run();
}