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
        fileSize: stats.size
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
