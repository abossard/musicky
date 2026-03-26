import * as mm from 'music-metadata';
// import NodeID3 from 'node-id3';
import { promises as fs } from 'fs';
import path from 'path';
import { artworkCache } from './artwork-cache';
import { standardToCamelot } from './camelot';
import { extractMusickTagsFromFrames, extractMIKAttributes, extractCommentText } from './mp3-parsing';

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
  key?: string;            // Musical key from TKEY (standard notation, e.g. "Gm", "C#m")
  camelotKey?: string;     // Camelot notation converted from key (e.g. "6A", "12A")
  bpm?: number;            // BPM from TBPM frame
  energyLevel?: number;    // Energy level (1-10) from TXXX:EnergyLevel (Mixed In Key)
  label?: string;          // Record label from TXXX:LABEL
  grouping?: string;       // TIT1 / Content Group Description (VDJ grouping)
}

/** Options controlling which standard ID3 frames are written for VDJ compatibility */
export interface VDJExportOptions {
  writeGenre: boolean;        // Write TCON with semicolons
  writeComment: boolean;      // Write structured COMM
  writeGrouping: boolean;     // Write TIT1 with energy/mood/phase
  writeMusickTags: boolean;   // Write µ: TXXX frames (always recommended)
  preserveExistingComment: boolean;  // Prepend to existing COMM (default: true)
  preserveKey: boolean;       // Don't touch TKEY (default: true)
  preserveEnergy: boolean;    // Don't touch TXXX:EnergyLevel (default: true)
  commentFormat: 'structured' | 'minimal';
}

export const DEFAULT_VDJ_OPTIONS: VDJExportOptions = {
  writeGenre: true,
  writeComment: true,
  writeGrouping: true,
  writeMusickTags: true,
  preserveExistingComment: true,
  preserveKey: true,
  preserveEnergy: true,
  commentFormat: 'structured',
};

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
      
      // Extract native frames once, then use pure calculations
      const nativeFrames = metadata.native['ID3v2.4'] || metadata.native['ID3v2.3'] || metadata.native['ID3v2.2'] || [];
      const muspiTag = extractMusickTagsFromFrames(nativeFrames);
      const { energyLevel, label } = extractMIKAttributes(nativeFrames);

      const result: MP3Metadata = {
        filePath,
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
        albumartist: metadata.common.albumartist,
        year: metadata.common.year,
        genre: metadata.common.genre,
        track: metadata.common.track,
        comment: extractCommentText(metadata.common.comment),
        duration: metadata.format.duration,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        format: metadata.format.container,
        fileSize: stats.size,
        muspiTag: muspiTag || undefined,
        key: metadata.common.key || undefined,
        camelotKey: metadata.common.key ? (standardToCamelot(metadata.common.key) ?? undefined) : undefined,
        bpm: metadata.common.bpm || undefined,
        energyLevel,
        label,
        grouping: metadata.common.grouping || undefined,
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
      
      // Write only the comment tag — use include filter to avoid GEOB/APIC issues
      const success = NodeID3.update(tags, filePath, { include: ['COMM'] });
      
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
   * Write Musicky TXXX tags to an MP3 file.
   * Preserves existing non-Musicky TXXX frames and other ID3 data.
   */
  async writeTags(filePath: string, tags: Partial<MusickTagData>): Promise<void> {
    try {
      await fs.access(filePath);
      const NodeID3 = await getNodeID3();

      // Read only TXXX frames to preserve non-Musicky custom tags
      // Use include filter to avoid reading problematic GEOB/APIC frames
      let existingTags: any = {};
      try {
        existingTags = NodeID3.read(filePath, { noRaw: true, include: ['userDefinedText'] }) || {};
      } catch {
        // If read fails, proceed with empty — we'll just write our tags
      }
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

      // Use include filter to avoid re-serializing problematic GEOB/APIC frames
      const success = NodeID3.update(updatePayload, filePath, { include: ['TXXX', 'TCON'] });
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
   * Write VDJ-compatible ID3 tags (TCON, COMM, TIT1) alongside Musicky TXXX frames.
   * Never overwrites TKEY, TBPM, or TXXX:EnergyLevel.
   */
  async writeVDJTags(
    filePath: string,
    data: {
      genres?: string[];
      phases?: string[];
      moods?: string[];
      energyLevel?: number;
      camelotKey?: string;
      relatedSongs?: { artist: string; title: string }[];
      tags?: string[];
    },
    options: VDJExportOptions = DEFAULT_VDJ_OPTIONS
  ): Promise<void> {
    try {
      await fs.access(filePath);
      const NodeID3 = await getNodeID3();

      // Read existing tags to preserve data we must not overwrite
      const existingTags = NodeID3.read(filePath, { noRaw: true }) || {};

      const updatePayload: any = {};

      // 1. TCON (Genre) — semicolon-separated for VDJ
      if (options.writeGenre && data.genres && data.genres.length > 0) {
        updatePayload.genre = data.genres.join('; ');
      }

      // 2. COMM (Comment) — structured or minimal
      if (options.writeComment) {
        const parts: string[] = [];

        if (options.commentFormat === 'structured') {
          if (data.phases?.length)  parts.push(`[Phase:${data.phases.join(',')}]`);
          if (data.energyLevel != null) parts.push(`[Energy:${data.energyLevel}]`);
          if (data.camelotKey)      parts.push(`[Key:${data.camelotKey}]`);
          if (data.moods?.length)   parts.push(`[Mood:${data.moods.join(',')}]`);
          if (data.relatedSongs?.length) {
            const rel = data.relatedSongs.map(s => `${s.artist} - ${s.title}`).join(', ');
            parts.push(`[Related:${rel}]`);
          }
          if (data.tags?.length)    parts.push(`[Tags:${data.tags.join(',')}]`);
        } else {
          // minimal
          if (data.phases?.length)      parts.push(`Phase:${data.phases[0]}`);
          if (data.energyLevel != null) parts.push(`E:${data.energyLevel}`);
          if (data.camelotKey)          parts.push(`Key:${data.camelotKey}`);
        }

        if (parts.length > 0) {
          let commentText = parts.join(' ');

          if (options.preserveExistingComment) {
            let existing = '';
            if (existingTags.comment) {
              const c = existingTags.comment;
              existing = typeof c === 'string' ? c : (c.text ?? '');
            }
            if (existing) {
              commentText = `${commentText} | ${existing}`;
            }
          }

          updatePayload.comment = { language: 'eng', text: commentText };
        }
      }

      // 3. TIT1 (Grouping / Content Group) — quick-scan format
      if (options.writeGrouping) {
        const groupParts: string[] = [];
        if (data.energyLevel != null) groupParts.push(`E${data.energyLevel}`);
        if (data.moods?.length)       groupParts.push(data.moods.join(','));
        if (data.phases?.length)      groupParts.push(data.phases.join(','));
        if (data.camelotKey)          groupParts.push(data.camelotKey);

        if (groupParts.length > 0) {
          updatePayload.contentGroupDescription = groupParts.join(' // ');
        }
      }

      // 4. µ: TXXX frames via existing writeTags()
      if (options.writeMusickTags) {
        // Delegate to writeTags which handles TXXX preservation
        await this.writeTags(filePath, {
          genres: data.genres,
          phases: data.phases,
          moods: data.moods,
          tags: data.tags,
          related: data.relatedSongs?.map(s => ({
            title: s.title,
            artist: s.artist,
            type: 'similarity',
            weight: 1.0,
          })),
        });
      }

      // Build TXXX preservation for the VDJ payload (keep all existing TXXX intact)
      if (existingTags.userDefinedText) {
        const arr = Array.isArray(existingTags.userDefinedText)
          ? existingTags.userDefinedText
          : [existingTags.userDefinedText];
        updatePayload.userDefinedText = arr;
      }

      // Safety: never include TKEY or TBPM in the update
      delete updatePayload.initialKey;
      delete updatePayload.bpm;

      // Only call update if we have standard frames to write
      const hasStandardFrames = updatePayload.genre || updatePayload.comment || updatePayload.contentGroupDescription;
      if (hasStandardFrames) {
        // Use include filter to avoid re-serializing problematic GEOB/APIC frames
        const success = NodeID3.update(updatePayload, filePath, { include: ['TXXX', 'TCON', 'COMM', 'TIT1'] });
        if (!success) {
          throw new Error('NodeID3.update returned false — failed to write VDJ tags');
        }
      }

      console.log(`[MP3Manager] Successfully wrote VDJ tags to: ${filePath}`);
    } catch (error) {
      const errorMsg = `Failed to write VDJ tags: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`[MP3Manager] Error in writeVDJTags:`, error);
      throw new Error(errorMsg);
    }
  }

  /**
   * Read only the Musicky TXXX tags from an MP3 file (lightweight, no artwork)
   */
  async readMusickTags(filePath: string): Promise<MusickTagData | null> {
    const metadata = await mm.parseFile(filePath);
    const nativeFrames = metadata.native['ID3v2.4'] || metadata.native['ID3v2.3'] || metadata.native['ID3v2.2'] || [];
    return extractMusickTagsFromFrames(nativeFrames);
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
   * Convert song_tags + song_connections database entries into MusickTagData for ID3 writing.
   */
  static tagsToMusickData(
    tags: { label: string; category: string }[],
    connections: { targetTitle: string; targetArtist: string; type: string; weight: number }[],
  ): MusickTagData {
    const data: MusickTagData = { version: 1 };

    const byCategory: Record<string, string[]> = {};
    for (const t of tags) {
      const cat = t.category.toLowerCase();
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t.label);
    }

    if (byCategory['genre']?.length)  data.genres  = [...new Set(byCategory['genre'])].sort();
    if (byCategory['phase']?.length)  data.phases  = [...new Set(byCategory['phase'])].sort();
    if (byCategory['mood']?.length)   data.moods   = [...new Set(byCategory['mood'])].sort();
    if (byCategory['topic']?.length)  data.topics  = [...new Set(byCategory['topic'])].sort();
    if (byCategory['custom']?.length) data.tags    = [...new Set(byCategory['custom'])].sort();

    if (connections.length > 0) {
      data.related = connections.map(c => ({
        title: c.targetTitle,
        artist: c.targetArtist,
        type: c.type,
        weight: c.weight,
      }));
    }

    return data;
  }

  /**
   * Convert MusickTagData read from ID3 back to normalized tags + related entries.
   */
  static musickDataToTags(
    data: MusickTagData,
  ): {
    tags: { label: string; category: 'genre' | 'phase' | 'mood' | 'topic' | 'custom' }[];
    related: { title: string; artist: string; type: string; weight: number }[];
  } {
    const tags: { label: string; category: 'genre' | 'phase' | 'mood' | 'topic' | 'custom' }[] = [];

    const mapping: [keyof Pick<MusickTagData, 'genres' | 'phases' | 'moods' | 'topics' | 'tags'>, 'genre' | 'phase' | 'mood' | 'topic' | 'custom'][] = [
      ['genres', 'genre'],
      ['phases', 'phase'],
      ['moods', 'mood'],
      ['topics', 'topic'],
      ['tags', 'custom'],
    ];

    for (const [field, category] of mapping) {
      const values = data[field];
      if (values) {
        for (const v of values) {
          const trimmed = v.trim();
          if (trimmed) tags.push({ label: trimmed, category });
        }
      }
    }

    const related = (data.related ?? []).map(r => ({
      title: r.title,
      artist: r.artist,
      type: r.type,
      weight: r.weight,
    }));

    return { tags, related };
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
