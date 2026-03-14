import { readdir, stat } from 'fs/promises';
import { join, basename, extname } from 'path';
import { parseFile } from 'music-metadata';
import { 
  insertMP3Cache, 
  searchMP3Cache, 
  getMP3CacheByPath,
  deleteMP3Cache,
  clearOldCache 
} from '../database/sqlite/queries/dj-sets';
import type { MP3CacheItem, MP3SearchResult } from '../database/sqlite/queries/dj-sets';

export class MusicSearchService {
  private static instance: MusicSearchService;
  private searchCache = new Map<string, MP3SearchResult[]>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private readonly supportedExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.aac'];

  private constructor() {
    // Clear old cache entries on startup
    clearOldCache();
  }

  static getInstance(): MusicSearchService {
    if (!MusicSearchService.instance) {
      MusicSearchService.instance = new MusicSearchService();
    }
    return MusicSearchService.instance;
  }

  async search(query: string, baseFolder: string, limit: number = 50): Promise<MP3SearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    // Check in-memory cache first
    const cacheKey = `${query.toLowerCase()}_${limit}`;
    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!;
    }

    // Search in database cache
    const dbResults = searchMP3Cache(query, limit);
    
    // If we have enough results from cache, return them
    if (dbResults.length >= Math.min(limit, 20)) {
      this.cacheSearchResults(cacheKey, dbResults);
      return dbResults;
    }

    // Fallback to filesystem search if cache is insufficient
    const fsResults = await this.searchFilesystem(query, baseFolder, limit);
    
    // Combine and deduplicate results
    const combinedResults = this.combineResults(dbResults, fsResults, limit);
    
    // Cache the results
    this.cacheSearchResults(cacheKey, combinedResults);
    
    return combinedResults;
  }

  async indexFolder(folderPath: string): Promise<void> {
    try {
      await this.indexFolderRecursive(folderPath);
    } catch (error) {
      console.error('Error indexing folder:', error);
    }
  }

  async invalidateCache(filePath: string): Promise<void> {
    deleteMP3Cache(filePath);
    // Clear in-memory cache
    this.searchCache.clear();
  }

  private async searchFilesystem(query: string, baseFolder: string, limit: number): Promise<MP3SearchResult[]> {
    const results: MP3SearchResult[] = [];
    const queryLower = query.toLowerCase();

    try {
      await this.searchInDirectory(baseFolder, queryLower, results, limit);
    } catch (error) {
      console.error('Filesystem search error:', error);
    }

    return results;
  }

  private async searchInDirectory(
    dirPath: string, 
    query: string, 
    results: MP3SearchResult[], 
    limit: number
  ): Promise<void> {
    if (results.length >= limit) return;

    try {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        if (results.length >= limit) break;
        
        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          await this.searchInDirectory(fullPath, query, results, limit);
        } else if (this.isSupportedFile(entry)) {
          const filename = basename(entry, extname(entry));
          
          if (filename.toLowerCase().includes(query)) {
            const metadata = await this.getOrCacheMetadata(fullPath);
            results.push({
              file_path: fullPath,
              filename: entry,
              artist: metadata.artist,
              title: metadata.title,
              album: metadata.album,
              duration: metadata.duration
            });
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  private async indexFolderRecursive(folderPath: string): Promise<void> {
    try {
      const entries = await readdir(folderPath);
      
      for (const entry of entries) {
        const fullPath = join(folderPath, entry);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          await this.indexFolderRecursive(fullPath);
        } else if (this.isSupportedFile(entry)) {
          await this.indexFile(fullPath, stats);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  private async indexFile(filePath: string, stats: any): Promise<void> {
    try {
      // Check if file is already cached and up to date
      const cached = getMP3CacheByPath(filePath);
      if (cached && cached.last_modified && 
          new Date(cached.last_modified).getTime() >= stats.mtime.getTime()) {
        return;
      }

      const metadata = await this.extractMetadata(filePath);
      
      insertMP3Cache({
        file_path: filePath,
        filename: basename(filePath),
        artist: metadata.artist,
        title: metadata.title,
        album: metadata.album,
        duration: metadata.duration,
        file_size: stats.size,
        last_modified: stats.mtime.toISOString()
      });
    } catch (error) {
      console.error(`Error indexing file ${filePath}:`, error);
    }
  }

  private async getOrCacheMetadata(filePath: string): Promise<MP3CacheItem> {
    const cached = getMP3CacheByPath(filePath);
    if (cached) {
      return cached;
    }

    const metadata = await this.extractMetadata(filePath);
    const stats = await stat(filePath);
    
    const cacheItem: MP3CacheItem = {
      file_path: filePath,
      filename: basename(filePath),
      artist: metadata.artist,
      title: metadata.title,
      album: metadata.album,
      duration: metadata.duration,
      file_size: stats.size,
      last_modified: stats.mtime.toISOString()
    };

    insertMP3Cache(cacheItem);
    return cacheItem;
  }

  private async extractMetadata(filePath: string): Promise<{
    artist?: string;
    title?: string;
    album?: string;
    duration?: number;
  }> {
    try {
      const metadata = await parseFile(filePath);
      return {
        artist: metadata.common.artist,
        title: metadata.common.title,
        album: metadata.common.album,
        duration: metadata.format.duration ? Math.round(metadata.format.duration) : undefined
      };
    } catch (error) {
      // Return filename-based metadata if parsing fails
      const filename = basename(filePath, extname(filePath));
      return {
        title: filename
      };
    }
  }

  private isSupportedFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  private combineResults(dbResults: MP3SearchResult[], fsResults: MP3SearchResult[], limit: number): MP3SearchResult[] {
    const seen = new Set<string>();
    const combined: MP3SearchResult[] = [];

    // Add database results first (they're likely higher quality)
    for (const result of dbResults) {
      if (combined.length >= limit) break;
      if (!seen.has(result.file_path)) {
        seen.add(result.file_path);
        combined.push(result);
      }
    }

    // Add filesystem results
    for (const result of fsResults) {
      if (combined.length >= limit) break;
      if (!seen.has(result.file_path)) {
        seen.add(result.file_path);
        combined.push(result);
      }
    }

    return combined;
  }

  private cacheSearchResults(key: string, results: MP3SearchResult[]): void {
    this.searchCache.set(key, results);
    
    // Clean up old cache entries
    setTimeout(() => {
      this.searchCache.delete(key);
    }, this.cacheTimeout);
  }
}