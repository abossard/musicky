import { MusicSearchService } from '../lib/music-search-service';
import { onGetBaseFolder } from './MP3Library.telefunc';
import type { MP3SearchResult } from '../database/sqlite/queries/dj-sets';

export async function onSearchMusic(query: string, limit: number = 50): Promise<MP3SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  // Get the base folder from library settings
  const baseFolder = await onGetBaseFolder();
  if (!baseFolder) {
    throw new Error('Music library folder not configured. Please set up your music library first.');
  }
  
  const searchService = MusicSearchService.getInstance();
  return searchService.search(query.trim(), baseFolder, limit);
}

export async function onIndexMusicFolder(): Promise<void> {
  const baseFolder = await onGetBaseFolder();
  if (!baseFolder) {
    throw new Error('Music library folder not configured. Please set up your music library first.');
  }
  
  const searchService = MusicSearchService.getInstance();
  await searchService.indexFolder(baseFolder);
}

export async function onInvalidateCache(filePath: string): Promise<void> {
  if (!filePath || filePath.trim().length === 0) {
    throw new Error('File path is required');
  }
  
  const searchService = MusicSearchService.getInstance();
  await searchService.invalidateCache(filePath.trim());
}