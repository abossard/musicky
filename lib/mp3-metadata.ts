import * as mm from 'music-metadata';
import * as NodeID3 from 'node-id3';
import { promises as fs } from 'fs';
import path from 'path';

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
      
      // Prepare ID3 tags with only the comment field
      const tags: NodeID3.Tags = {
        comment: {
          language: 'eng',
          shortText: '',
          text: comment
        }
      };
      
      // Write only the comment tag
      const success = NodeID3.update(tags, filePath);
      
      if (!success) {
        throw new Error('Failed to write comment to MP3 file');
      }
    } catch (error) {
      throw new Error(`Failed to write MP3 comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
