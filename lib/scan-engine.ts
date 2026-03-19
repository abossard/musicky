import { MP3MetadataManager, type MusickTagData } from './mp3-metadata';
import * as fs from 'fs';
import * as path from 'path';

// --- Types ---

export interface ScanResult {
  totalFiles: number;
  newFiles: number;
  updatedFiles: number;
  removedFiles: number;
  tagsDiscovered: number;
  connectionsDiscovered: number;
  errors: { filePath: string; error: string }[];
}

export interface ScannedSong {
  filePath: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  tags: { label: string; category: 'genre' | 'phase' | 'mood' | 'topic' | 'custom' }[];
  relatedSongs: { title: string; artist: string; type: string; weight: number }[];
}

export interface ScanDiff {
  newSongs: ScannedSong[];
  changedSongs: { song: ScannedSong; changes: string[] }[];
  removedPaths: string[];
  newTags: { filePath: string; label: string; category: string }[];
  newConnections: { sourcePath: string; targetTitle: string; targetArtist: string; type: string; weight: number }[];
}

// --- Functions ---

/** Recursively find all MP3 files in a directory */
export async function findMP3Files(basePath: string): Promise<string[]> {
  const results: string[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')) {
        results.push(fullPath);
      }
    }
  }

  walk(basePath);
  return results;
}

/** Scan a single MP3 file and extract its graph-relevant data */
export async function scanSingleFile(
  filePath: string,
  metadataManager: MP3MetadataManager,
): Promise<ScannedSong> {
  const meta = await metadataManager.readMetadata(filePath);

  const genreTags = parseGenreTag(meta.genre);
  const tags: ScannedSong['tags'] = genreTags.map((g) => ({ label: g, category: 'genre' as const }));

  // Merge µ: custom tags
  if (meta.muspiTag) {
    tags.push(...extractTags(meta.muspiTag));
  }

  const relatedSongs = (meta.muspiTag?.related ?? []).map((r) => ({
    title: r.title,
    artist: r.artist,
    type: r.type,
    weight: r.weight,
  }));

  return {
    filePath: meta.filePath,
    title: meta.title,
    artist: meta.artist,
    album: meta.album,
    duration: meta.duration,
    tags,
    relatedSongs,
  };
}

/** Scan an entire folder and return all scanned songs */
export async function scanFolder(
  basePath: string,
  metadataManager: MP3MetadataManager,
  onProgress?: (current: number, total: number) => void,
): Promise<{ songs: ScannedSong[]; errors: { filePath: string; error: string }[] }> {
  const files = await findMP3Files(basePath);
  const songs: ScannedSong[] = [];
  const errors: { filePath: string; error: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length);
    try {
      const song = await scanSingleFile(files[i], metadataManager);
      songs.push(song);
    } catch (err) {
      errors.push({
        filePath: files[i],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { songs, errors };
}

/** Extract tags from MusickTagData into normalized tag array */
export function extractTags(
  musickTags: {
    genres?: string[];
    phases?: string[];
    moods?: string[];
    topics?: string[];
    tags?: string[];
  } | null | undefined,
): { label: string; category: 'genre' | 'phase' | 'mood' | 'topic' | 'custom' }[] {
  if (!musickTags) return [];

  const result: { label: string; category: 'genre' | 'phase' | 'mood' | 'topic' | 'custom' }[] = [];

  const mapping: [keyof Pick<MusickTagData, 'genres' | 'phases' | 'moods' | 'topics' | 'tags'>, 'genre' | 'phase' | 'mood' | 'topic' | 'custom'][] = [
    ['genres', 'genre'],
    ['phases', 'phase'],
    ['moods', 'mood'],
    ['topics', 'topic'],
    ['tags', 'custom'],
  ];

  for (const [field, category] of mapping) {
    const values = musickTags[field];
    if (values) {
      for (const v of values) {
        const trimmed = v.trim();
        if (trimmed) {
          result.push({ label: trimmed, category });
        }
      }
    }
  }

  return result;
}

/** Try to resolve a related song reference (title+artist) to a file path using fuzzy matching */
export function resolveRelatedSong(
  relatedTitle: string,
  relatedArtist: string,
  knownSongs: { filePath: string; title?: string; artist?: string }[],
): string | null {
  const normTitle = relatedTitle.toLowerCase().trim();
  const normArtist = relatedArtist.toLowerCase().trim();

  // Exact title+artist match
  for (const song of knownSongs) {
    if (
      song.title?.toLowerCase().trim() === normTitle &&
      song.artist?.toLowerCase().trim() === normArtist
    ) {
      return song.filePath;
    }
  }

  // Partial: title match only (different artist or missing artist)
  for (const song of knownSongs) {
    if (song.title?.toLowerCase().trim() === normTitle) {
      return song.filePath;
    }
  }

  // Partial: title contained in or contains the known title
  for (const song of knownSongs) {
    const songTitle = song.title?.toLowerCase().trim();
    if (songTitle && (songTitle.includes(normTitle) || normTitle.includes(songTitle))) {
      return song.filePath;
    }
  }

  return null;
}

/** Resolve all related song references, returning connections with resolved file paths */
export function resolveAllConnections(
  songs: ScannedSong[],
): { sourcePath: string; targetPath: string; type: string; weight: number }[] {
  const known = songs.map((s) => ({
    filePath: s.filePath,
    title: s.title,
    artist: s.artist,
  }));

  const connections: { sourcePath: string; targetPath: string; type: string; weight: number }[] = [];

  for (const song of songs) {
    for (const rel of song.relatedSongs) {
      const targetPath = resolveRelatedSong(rel.title, rel.artist, known);
      if (targetPath && targetPath !== song.filePath) {
        connections.push({
          sourcePath: song.filePath,
          targetPath,
          type: rel.type,
          weight: rel.weight,
        });
      }
    }
  }

  return connections;
}

/** Compute diff between cached data and a fresh scan */
export function computeScanDiff(
  cachedPaths: string[],
  scannedSongs: ScannedSong[],
  existingTags: { file_path: string; tag_label: string; tag_category: string }[],
): ScanDiff {
  const cachedSet = new Set(cachedPaths);
  const scannedMap = new Map<string, ScannedSong>();
  for (const song of scannedSongs) {
    scannedMap.set(song.filePath, song);
  }

  const newSongs: ScannedSong[] = [];
  const changedSongs: { song: ScannedSong; changes: string[] }[] = [];

  // Build a lookup of existing tags per file
  const existingTagsByFile = new Map<string, Set<string>>();
  for (const t of existingTags) {
    let set = existingTagsByFile.get(t.file_path);
    if (!set) {
      set = new Set();
      existingTagsByFile.set(t.file_path, set);
    }
    set.add(`${t.tag_category}:${t.tag_label}`);
  }

  const newTags: ScanDiff['newTags'] = [];
  const newConnections: ScanDiff['newConnections'] = [];

  for (const song of scannedSongs) {
    if (!cachedSet.has(song.filePath)) {
      newSongs.push(song);
      // All tags from new songs are new
      for (const tag of song.tags) {
        newTags.push({ filePath: song.filePath, label: tag.label, category: tag.category });
      }
      // All connections from new songs are new
      for (const rel of song.relatedSongs) {
        newConnections.push({
          sourcePath: song.filePath,
          targetTitle: rel.title,
          targetArtist: rel.artist,
          type: rel.type,
          weight: rel.weight,
        });
      }
    } else {
      // Existing file — detect tag changes
      const existingSet = existingTagsByFile.get(song.filePath) ?? new Set();
      const changes: string[] = [];

      for (const tag of song.tags) {
        const key = `${tag.category}:${tag.label}`;
        if (!existingSet.has(key)) {
          changes.push(`+tag:${key}`);
          newTags.push({ filePath: song.filePath, label: tag.label, category: tag.category });
        }
      }

      // Detect removed tags
      const scannedTagKeys = new Set(song.tags.map((t) => `${t.category}:${t.label}`));
      for (const key of existingSet) {
        if (!scannedTagKeys.has(key)) {
          changes.push(`-tag:${key}`);
        }
      }

      if (changes.length > 0) {
        changedSongs.push({ song, changes });
      }

      // Connections from existing songs are still reported as new
      for (const rel of song.relatedSongs) {
        newConnections.push({
          sourcePath: song.filePath,
          targetTitle: rel.title,
          targetArtist: rel.artist,
          type: rel.type,
          weight: rel.weight,
        });
      }
    }
  }

  // Removed = in cache but not in scan
  const scannedPathSet = new Set(scannedSongs.map((s) => s.filePath));
  const removedPaths = cachedPaths.filter((p) => !scannedPathSet.has(p));

  return { newSongs, changedSongs, removedPaths, newTags, newConnections };
}

/** Convert standard genre ID3 tag to tag entries, splitting on "/" and "," */
export function parseGenreTag(genre: string | string[] | undefined): string[] {
  if (!genre) return [];

  const raw = Array.isArray(genre) ? genre : [genre];
  const result: string[] = [];

  for (const g of raw) {
    // Split on "/" or ","
    const parts = g.split(/[\/,]/).map((s) => s.trim()).filter(Boolean);
    result.push(...parts);
  }

  return result;
}
