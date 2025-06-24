import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { AlbumArtwork } from './mp3-metadata';

export interface CachedArtwork {
  dataUrl: string;
  artwork: AlbumArtwork;
  hash: string;
  lastModified: number;
  fileSize: number;
}

export class ArtworkCache {
  private memoryCache = new Map<string, CachedArtwork>();
  private cacheDir: string;
  private maxMemoryItems = 100; // Limit memory cache size
  private maxCacheAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  constructor(cacheDir = '.artwork-cache') {
    this.cacheDir = path.resolve(cacheDir);
  }

  /**
   * Initialize cache directory
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.warn('[ArtworkCache] Failed to create cache directory:', error);
    }
  }

  /**
   * Generate cache key from file path and metadata
   */
  private generateCacheKey(filePath: string, fileStats: { size: number; mtime: Date }): string {
    const hash = crypto.createHash('md5');
    hash.update(filePath);
    hash.update(fileStats.size.toString());
    hash.update(fileStats.mtime.getTime().toString());
    return hash.digest('hex');
  }

  /**
   * Generate artwork hash for change detection
   */
  private generateArtworkHash(artwork: AlbumArtwork): string {
    const hash = crypto.createHash('md5');
    hash.update(artwork.imageBuffer);
    hash.update(artwork.mime || '');
    return hash.digest('hex');
  }

  /**
   * Get cache file path
   */
  private getCacheFilePath(cacheKey: string): string {
    return path.join(this.cacheDir, `${cacheKey}.json`);
  }

  /**
   * Get cached artwork
   */
  async get(filePath: string, fileStats: { size: number; mtime: Date }): Promise<CachedArtwork | null> {
    const cacheKey = this.generateCacheKey(filePath, fileStats);

    // Check memory cache first
    if (this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey)!;
      // Verify cache is still valid
      if (Date.now() - cached.lastModified < this.maxCacheAge) {
        return cached;
      } else {
        this.memoryCache.delete(cacheKey);
      }
    }

    // Check file cache
    try {
      const cacheFilePath = this.getCacheFilePath(cacheKey);
      const cacheData = await fs.readFile(cacheFilePath, 'utf-8');
      const cached: CachedArtwork = JSON.parse(cacheData);

      // Verify cache is still valid
      if (Date.now() - cached.lastModified < this.maxCacheAge) {
        // Add to memory cache
        this.addToMemoryCache(cacheKey, cached);
        return cached;
      } else {
        // Cache expired, remove file
        await fs.unlink(cacheFilePath).catch(() => {});
      }
    } catch (error) {
      // Cache miss or error, continue
    }

    return null;
  }

  /**
   * Set cached artwork
   */
  async set(
    filePath: string, 
    fileStats: { size: number; mtime: Date },
    artwork: AlbumArtwork,
    dataUrl: string
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(filePath, fileStats);
    const artworkHash = this.generateArtworkHash(artwork);

    const cached: CachedArtwork = {
      dataUrl,
      artwork: {
        ...artwork,
        imageBuffer: Buffer.from([]) // Don't store buffer in cache files
      },
      hash: artworkHash,
      lastModified: Date.now(),
      fileSize: fileStats.size
    };

    // Add to memory cache
    this.addToMemoryCache(cacheKey, {
      ...cached,
      artwork // Keep full artwork with buffer in memory
    });

    // Save to file cache (without buffer to save space)
    try {
      const cacheFilePath = this.getCacheFilePath(cacheKey);
      await fs.writeFile(cacheFilePath, JSON.stringify(cached), 'utf-8');
    } catch (error) {
      console.warn('[ArtworkCache] Failed to save cache file:', error);
    }
  }

  /**
   * Add item to memory cache with LRU eviction
   */
  private addToMemoryCache(key: string, cached: CachedArtwork): void {
    // Remove oldest items if cache is full
    if (this.memoryCache.size >= this.maxMemoryItems) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(key, cached);
  }

  /**
   * Clear expired cache entries
   */
  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const cached: CachedArtwork = JSON.parse(data);

          if (now - cached.lastModified > this.maxCacheAge) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          // Invalid cache file, remove it
          await fs.unlink(filePath).catch(() => {});
        }
      }
    } catch (error) {
      console.warn('[ArtworkCache] Cleanup failed:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        await fs.unlink(path.join(this.cacheDir, file)).catch(() => {});
      }
    } catch (error) {
      console.warn('[ArtworkCache] Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { memoryItems: number; cacheDir: string } {
    return {
      memoryItems: this.memoryCache.size,
      cacheDir: this.cacheDir
    };
  }
}

// Global cache instance
export const artworkCache = new ArtworkCache();
