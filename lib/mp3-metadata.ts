import * as mm from 'music-metadata';
// import NodeID3 from 'node-id3';
import { promises as fs } from 'fs';
import path from 'path';
import { artworkCache } from './artwork-cache';

// Try dynamic import for node-id3 to handle CommonJS/ESM issues
const getNodeID3 = async () => {
  try {
    const NodeID3 = await import('node-id3');
    return NodeID3.default || NodeID3;
  } catch (error) {
    console.error('[MP3Manager] Failed to import NodeID3:', error);
    throw new Error('Failed to load node-id3 library');
  }
};

export interface AlbumArtwork {
  mime: string;
  type: {
    id: number;
    name: string;
  };
  description?: string;
  imageBuffer: Buffer;
}

/** Musicky-managed tag data stored in TXXX frames with µ: prefix */
export interface MusickTagData {
  genres?: string[];
  phases?: string[];
  moods?: string[];
  topics?: string[];
  tags?: string[];
  related?: MusickRelatedSong[];
  version?: number;
}

export interface MusickRelatedSong {
  title: string;
  artist: string;
  type: string;   // edge type: 'similarity' | 'genre' | 'phase' | 'mood' | 'topic' | 'custom'
  weight: number;  // 0.0 – 1.0
}

/** Prefix for all Musicky TXXX frame descriptions */
export const MUSICK_TAG_PREFIX = 'µ:';

/** Known Musicky TXXX field names (without prefix) */
export const MUSICK_TAG_FIELDS = ['genres', 'phases', 'moods', 'topics', 'tags', 'related', 'version'] as const;
export type MusickTagField = typeof MUSICK_TAG_FIELDS[number];

export interface MP3Metadata {
  filePath: string;
  title?: string;
  artist?: string;
  album?: string;
  albumartist?: string;
  year?: number;
  genre?: string[];
  track?: {
    no: number | null;
    of: number | null;
  };
  comment?: string;
  duration?: number;
  bitrate?: number;
  sampleRate?: number;
  format?: string;
  fileSize?: number;
  artwork?: AlbumArtwork;
  artworkDataUrl?: string; // Base64 data URL for frontend display
  muspiTag?: MusickTagData; // Musicky-managed TXXX tag data
}

export interface PendingEdit {
  id: number;
  filePath: string;
  originalComment: string | null;
  newComment: string;
  createdAt: string;
  status: 'pending' | 'applied' | 'failed';
}

export class MP3MetadataManager {
  /**
   * Read MP3 metadata from a file
   */
  async readMetadata(filePath: string): Promise<MP3Metadata> {
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Get file stats
      const stats = await fs.stat(filePath);
      
      // Read metadata using music-metadata
      const metadata = await mm.parseFile(filePath);
      
      // Extract Musicky TXXX tags from native ID3v2 frames
      const muspiTag = this.extractMusickTags(metadata);

      const result: MP3Metadata = {
        filePath,
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        albumartist: metadata.common.albumartist,
        year: metadata.common.year,
        genre: metadata.common.genre,
        track: metadata.common.track,
        comment: this.extractCommentText(metadata.common.comment),
        duration: metadata.format.duration,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        format: metadata.format.container,
        fileSize: stats.size,
        muspiTag: muspiTag || undefined,
      };
      
      // Try to get artwork from cache first
      try {
        await artworkCache.init(); // Ensure cache is initialized
        
        const cached = await artworkCache.get(filePath, {
          size: stats.size,
          mtime: stats.mtime
        });
        
        if (cached) {
          // Use cached artwork
          result.artwork = cached.artwork;
          result.artworkDataUrl = cached.dataUrl;
        } else {
          // Extract artwork and cache it
          const artworkInfo = await this.extractArtworkUncached(filePath);
          if (artworkInfo) {
            const dataUrl = this.createDataUrl(artworkInfo);
            result.artwork = artworkInfo;
            result.artworkDataUrl = dataUrl;
            
            // Cache the artwork
            await artworkCache.set(filePath, {
              size: stats.size,
              mtime: stats.mtime
            }, artworkInfo, dataUrl);
          }
        }
      } catch (artworkError) {
        console.warn(`[MP3Manager] Failed to extract/cache artwork from ${filePath}:`, artworkError);
        // Continue without artwork - not a critical error
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to read MP3 metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Write comment to MP3 file
   */
  async writeComment(filePath: string, comment: string): Promise<void> {
    
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Get file stats for additional validation
      const stats = await fs.stat(filePath);
      console.log(`[MP3Manager] File stats:`, {
        size: stats.size,
        isFile: stats.isFile(),
        mode: stats.mode.toString(8)
      });
      
      // Dynamically import NodeID3
      const NodeID3 = await getNodeID3();
      
      // Prepare ID3 tags with only the comment field
      const tags: any = {
        comment: {
          language: 'eng',
          text: comment
        }
      };
      
      // Write only the comment tag
      const success = NodeID3.update(tags, filePath);
      
      console.log(`[MP3Manager] NodeID3.update result:`, success);
      
      if (!success) {
        const errorMsg = 'NodeID3.update returned false - failed to write comment to MP3 file';
        console.error(`[MP3Manager] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      console.log(`[MP3Manager] Successfully wrote comment to: ${filePath}`);
    } catch (error) {
      const errorMsg = `Failed to write MP3 comment: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[MP3Manager] Error in writeComment:`, error);
      console.error(`[MP3Manager] Error details:`, {
        filePath,
        comment,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(errorMsg);
    }
  }
  
  /**
   * Extract comment text from metadata comment objects
   */
  private extractCommentText(comments?: any[]): string | undefined {
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      return undefined;
    }
    
    // Comments can be strings or objects with {language, descriptor, text}
    const firstComment = comments[0];
    if (typeof firstComment === 'string') {
      return firstComment;
    }
    
    // If it's an object, extract the text property
    if (typeof firstComment === 'object' && firstComment.text) {
      return firstComment.text;
    }
    
    return undefined;
  }

  /**
   * Extract Musicky µ: TXXX tags from music-metadata native frames
   */
  private extractMusickTags(metadata: mm.IAudioMetadata): MusickTagData | null {
    const nativeFrames = metadata.native['ID3v2.4'] || metadata.native['ID3v2.3'] || metadata.native['ID3v2.2'];
    if (!nativeFrames) return null;

    const txxxFrames = nativeFrames.filter(
      (f: { id: string; value: any }) => f.id === 'TXXX' && typeof f.value === 'object' && f.value.description?.startsWith(MUSICK_TAG_PREFIX)
    );

    if (txxxFrames.length === 0) return null;

    const tagData: MusickTagData = {};
    for (const frame of txxxFrames) {
      const frameVal = frame.value as { description: string; text?: string; value?: string };
      const key = frameVal.description.slice(MUSICK_TAG_PREFIX.length) as MusickTagField;
      const val: string = frameVal.text ?? frameVal.value ?? '';

      switch (key) {
        case 'genres':
        case 'phases':
        case 'moods':
        case 'topics':
        case 'tags':
          tagData[key] = val.split(',').map((s: string) => s.trim()).filter(Boolean);
          break;
        case 'related':
          try { tagData.related = JSON.parse(val); } catch { /* ignore malformed */ }
          break;
        case 'version':
          tagData.version = parseInt(val, 10) || 1;
          break;
      }
    }

    return Object.keys(tagData).length > 0 ? tagData : null;
  }

  /**
   * Write Musicky TXXX tags to an MP3 file.
   * Preserves existing non-Musicky TXXX frames and other ID3 data.
   */
  async writeTags(filePath: string, tags: Partial<MusickTagData>): Promise<void> {
    try {
      await fs.access(filePath);
      const NodeID3 = await getNodeID3();

      // Read existing tags to preserve non-Musicky TXXX frames
      const existingTags = NodeID3.read(filePath, { noRaw: true }) || {};
      const existingTxxx: { description: string; value: string }[] = [];
      if (existingTags.userDefinedText) {
        const arr = Array.isArray(existingTags.userDefinedText)
          ? existingTags.userDefinedText
          : [existingTags.userDefinedText];
        for (const t of arr) {
          if (!t.description?.startsWith(MUSICK_TAG_PREFIX)) {
            existingTxxx.push(t);
          }
        }
      }

      // Build Musicky TXXX frames
      const musickTxxx: { description: string; value: string }[] = [];

      const addList = (field: string, values?: string[]) => {
        if (values && values.length > 0) {
          musickTxxx.push({ description: `${MUSICK_TAG_PREFIX}${field}`, value: values.join(', ') });
        }
      };

      addList('genres', tags.genres);
      addList('phases', tags.phases);
      addList('moods', tags.moods);
      addList('topics', tags.topics);
      addList('tags', tags.tags);

      if (tags.related && tags.related.length > 0) {
        musickTxxx.push({ description: `${MUSICK_TAG_PREFIX}related`, value: JSON.stringify(tags.related) });
      }

      // Always write version
      musickTxxx.push({ description: `${MUSICK_TAG_PREFIX}version`, value: '1' });

      const allTxxx = [...existingTxxx, ...musickTxxx];

      // Build the update payload
      const updatePayload: any = {
        userDefinedText: allTxxx,
      };

      // Also write standard genre frame for compatibility with other players
      if (tags.genres && tags.genres.length > 0) {
        updatePayload.genre = tags.genres.join(', ');
      }

      const success = NodeID3.update(updatePayload, filePath);
      if (!success) {
        throw new Error('NodeID3.update returned false — failed to write tags');
      }

      console.log(`[MP3Manager] Successfully wrote Musicky tags to: ${filePath}`);
    } catch (error) {
      const errorMsg = `Failed to write Musicky tags: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[MP3Manager] Error in writeTags:`, error);
      throw new Error(errorMsg);
    }
  }

  /**
   * Read only the Musicky TXXX tags from an MP3 file (lightweight, no artwork)
   */
  async readMusickTags(filePath: string): Promise<MusickTagData | null> {
    const metadata = await mm.parseFile(filePath);
    return this.extractMusickTags(metadata);
  }

  /**
   * Extract artwork from MP3 file using node-id3
   */
  private async extractArtworkUncached(filePath: string): Promise<AlbumArtwork | null> {
    try {
      const NodeID3 = await getNodeID3();
      
      // Read only the APIC (image) tag to avoid loading all metadata
      const tags = NodeID3.read(filePath, {
        include: ['APIC'],
        noRaw: true
      });
      
      if (tags && tags.image) {
        const imageData = tags.image;
        
        // Handle both single image and array of images
        const artwork = Array.isArray(imageData) ? imageData[0] : imageData;
        
        if (artwork && artwork.imageBuffer) {
          return {
            mime: artwork.mime || 'image/jpeg',
            type: artwork.type || { id: 3, name: 'front cover' },
            description: artwork.description,
            imageBuffer: artwork.imageBuffer
          };
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`[MP3Manager] Failed to extract artwork with node-id3:`, error);
      return null;
    }
  }
  
  /**
   * Create data URL from artwork for frontend display
   */
  private createDataUrl(artwork: AlbumArtwork): string {
    const base64 = artwork.imageBuffer.toString('base64');
    return `data:${artwork.mime};base64,${base64}`;
  }

  /**
   * Format file size in human-readable format
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }
  
  /**
   * Format duration in mm:ss format
   */
  static formatDuration(seconds?: number): string {
    if (!seconds) return '—';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Format track number
   */
  static formatTrack(track?: { no: number | null; of: number | null }): string {
    if (!track || !track.no) return '—';
    
    if (track.of) {
      return `${track.no}/${track.of}`;
    }
    
    return track.no.toString();
  }
  
  /**
   * Get file extension and validate it's an MP3
   */
  static validateMP3File(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.mp3';
  }
}
