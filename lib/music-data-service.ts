/**
 * Unified Music Data Service
 * 
 * Following "A Philosophy of Software Design" principles:
 * - Single responsibility: All music data operations in one place
 * - Deep modules: Hide complexity behind simple interface
 * - Information hiding: Internal implementation details are private
 */

import { MP3Metadata, PendingEdit } from './mp3-metadata';

export interface MusicLibraryData {
  files: MP3Metadata[];
  phases: string[];
  pendingEdits: PendingEdit[];
}

export interface DataLoadOptions {
  includeMetadata?: boolean;
  includePendingEdits?: boolean;
  includePhases?: boolean;
}

/**
 * Centralized service for all music library data operations.
 * Provides a simple, consistent interface hiding complex implementation details.
 */
export class MusicDataService {
  private cache: Partial<MusicLibraryData> = {};
  private loading = new Set<string>();

  /**
   * Load complete music library data with intelligent caching
   */
  async loadLibraryData(options: DataLoadOptions = {}): Promise<MusicLibraryData> {
    const {
      includeMetadata = true,
      includePendingEdits = true,
      includePhases = true
    } = options;

    try {
      const promises: Promise<any>[] = [];
      
      if (includeMetadata && !this.isLoading('files')) {
        promises.push(this.loadFiles());
      }
      
      if (includePhases && !this.isLoading('phases')) {
        promises.push(this.loadPhases());
      }
      
      if (includePendingEdits && !this.isLoading('pendingEdits')) {
        promises.push(this.loadPendingEdits());
      }

      await Promise.all(promises);

      return {
        files: this.cache.files || [],
        phases: this.cache.phases || [],
        pendingEdits: this.cache.pendingEdits || []
      };
    } catch (error) {
      this.clearCache();
      throw new Error(`Failed to load library data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh specific data types
   */
  async refresh(dataType: keyof MusicLibraryData): Promise<void> {
    delete this.cache[dataType];
    
    switch (dataType) {
      case 'files':
        await this.loadFiles();
        break;
      case 'phases':
        await this.loadPhases();
        break;
      case 'pendingEdits':
        await this.loadPendingEdits();
        break;
    }
  }

  /**
   * Update a single file in the cache
   */
  updateFile(updatedFile: MP3Metadata): void {
    if (this.cache.files) {
      this.cache.files = this.cache.files.map(file =>
        file.filePath === updatedFile.filePath ? updatedFile : file
      );
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache = {};
    this.loading.clear();
  }

  /**
   * Get cached data without network calls
   */
  getCachedData(): Partial<MusicLibraryData> {
    return { ...this.cache };
  }

  // Private implementation methods
  private async loadFiles(): Promise<void> {
    if (this.isLoading('files')) return;
    
    this.setLoading('files', true);
    try {
      const { onGetAllMP3Files } = await import('../components/MP3Library.telefunc');
      const result = await onGetAllMP3Files();
      this.cache.files = result.files;
    } finally {
      this.setLoading('files', false);
    }
  }

  private async loadPhases(): Promise<void> {
    if (this.isLoading('phases')) return;
    
    this.setLoading('phases', true);
    try {
      const { onGetPhases } = await import('../components/Settings.telefunc');
      this.cache.phases = await onGetPhases();
    } finally {
      this.setLoading('phases', false);
    }
  }

  private async loadPendingEdits(): Promise<void> {
    if (this.isLoading('pendingEdits')) return;
    
    this.setLoading('pendingEdits', true);
    try {
      const { onGetPendingEdits } = await import('../components/MP3Library.telefunc');
      this.cache.pendingEdits = await onGetPendingEdits();
    } finally {
      this.setLoading('pendingEdits', false);
    }
  }

  private isLoading(key: string): boolean {
    return this.loading.has(key);
  }

  private setLoading(key: string, loading: boolean): void {
    if (loading) {
      this.loading.add(key);
    } else {
      this.loading.delete(key);
    }
  }
}

// Singleton instance for app-wide use
export const musicDataService = new MusicDataService();