import { MP3MetadataManager, type MusickTagData, type MusickRelatedSong, MUSICK_TAG_PREFIX } from '../lib/mp3-metadata';
import {
  generateExportDiff,
  generateImportDiff,
  generateBulkExportDiff,
  generateBulkImportDiff,
  generateBulkVDJExportDiff,
  getMoodboardTagsForSong,
  getMoodboardRelatedSongs,
  type FileDiffSummary,
  type TagDiff,
} from '../lib/tag-sync-engine';
import { DEFAULT_VDJ_OPTIONS } from '../lib/mp3-metadata';
import {
  addTagEdit,
  getPendingTagEdits,
  getTagEditsForFile,
  getTagEditById,
  updateTagEditStatus,
  bulkUpdateTagEditStatus,
  addTagHistory,
  fetchTagHistory,
  clearPendingTagEditsByDirection,
  type PendingTagEdit,
  type TagEditHistory,
} from '../database/sqlite/queries/mp3-tag-edits';
import {
  getTagsForSong,
  addSongTag,
  clearSongTags,
  bulkSetSongTags,
  type TagCategory,
} from '../database/sqlite/queries/song-tags';
import {
  getConnectionsForSong,
  addSongConnection,
  clearConnectionsForSong,
  type ConnectionType,
} from '../database/sqlite/queries/song-connections';
import {
  getMP3CacheByPath,
  searchMP3Cache,
} from '../database/sqlite/queries/dj-sets';
import {
  createMoodboard,
  upsertNode,
  upsertEdge,
  isSongOnBoard,
  getNodes,
} from '../database/sqlite/queries/moodboard';
import { resolveRelatedSong as resolveRelated } from '../lib/scan-engine';
import { MP3Library } from '../lib/mp3-library';
import { readBaseFolder } from '../database/sqlite/queries/library-settings';

const mp3Manager = new MP3MetadataManager();
const library = new MP3Library();

// ─── Export: Dashboard → ID3 Tags ─────────────────────────────────────────

/**
 * Preview export: generate diffs for specified files (or whole library)
 * and create pending tag edits for review.
 * Reads from song_tags + song_connections (the graph model) as well as
 * moodboard edges to produce a complete export diff.
 */
export async function onPreviewExport(filePaths?: string[]): Promise<{
  summaries: FileDiffSummary[];
  editCount: number;
}> {
  // Clear previous pending exports
  clearPendingTagEditsByDirection('export');

  const paths = filePaths || await getLibraryFilePaths();

  // Generate diffs using the tag-sync-engine (moodboard-based) first
  const summaries = await generateBulkExportDiff(paths);

  // Supplement with song_tags/song_connections data for songs not on moodboards
  for (const fp of paths) {
    // Skip files already covered by moodboard diffs
    if (summaries.find(s => s.filePath === fp)) continue;

    const dbTags = getTagsForSong(fp);
    const dbConns = getConnectionsForSong(fp);
    if (dbTags.length === 0 && dbConns.length === 0) continue;

    // Build connection targets with title/artist from cache
    const connTargets = dbConns.map(c => {
      const otherPath = c.source_path === fp ? c.target_path : c.source_path;
      const cached = getMP3CacheByPath(otherPath);
      return {
        targetTitle: cached?.title || otherPath.split('/').pop()?.replace(/\.mp3$/i, '') || 'Unknown',
        targetArtist: cached?.artist || 'Unknown',
        type: c.connection_type,
        weight: c.weight,
      };
    });

    const proposedData = MP3MetadataManager.tagsToMusickData(
      dbTags.map(t => ({ label: t.tag_label, category: t.tag_category })),
      connTargets,
    );

    // Read current ID3 tags
    let currentTags: MusickTagData = {};
    try {
      currentTags = await mp3Manager.readMusickTags(fp) || {};
    } catch { /* skip unreadable files */ continue; }

    const diffs = buildFieldDiffs(fp, currentTags, proposedData, 'export');
    if (diffs.length > 0) {
      const cached = getMP3CacheByPath(fp);
      summaries.push({
        filePath: fp,
        title: cached?.title,
        artist: cached?.artist,
        diffs,
      });
    }
  }

  let editCount = 0;
  for (const summary of summaries) {
    for (const diff of summary.diffs) {
      addTagEdit(diff.filePath, diff.fieldName, diff.currentValue, diff.proposedValue, 'export');
      editCount++;
    }
  }

  return { summaries, editCount };
}

/**
 * Preview export for a single file.
 */
export async function onPreviewExportFile(filePath: string): Promise<{
  diffs: TagDiff[];
  editIds: number[];
}> {
  const diffs = await generateExportDiff(filePath);
  const editIds: number[] = [];

  for (const diff of diffs) {
    const id = addTagEdit(diff.filePath, diff.fieldName, diff.currentValue, diff.proposedValue, 'export');
    editIds.push(id);
  }

  return { diffs, editIds };
}

/**
 * Apply approved export edits — write tags to MP3 files.
 */
export async function onApplyExport(editIds: number[]): Promise<{
  success: number;
  failed: { id: number; error: string; filePath: string }[];
}> {
  let successCount = 0;
  const failed: { id: number; error: string; filePath: string }[] = [];

  // Group edits by file so we can batch-write
  const editsByFile = new Map<string, PendingTagEdit[]>();
  for (const id of editIds) {
    const edit = getTagEditById(id);
    if (!edit || edit.status !== 'pending') continue;
    const group = editsByFile.get(edit.filePath) || [];
    group.push(edit);
    editsByFile.set(edit.filePath, group);
  }

  for (const [filePath, edits] of editsByFile) {
    try {
      // Read current Musicky tags to merge
      const currentTags = await mp3Manager.readMusickTags(filePath) || {};
      const newTags: Partial<MusickTagData> = { ...currentTags };

      for (const edit of edits) {
        const field = edit.fieldName.startsWith(MUSICK_TAG_PREFIX)
          ? edit.fieldName.slice(MUSICK_TAG_PREFIX.length)
          : edit.fieldName;

        switch (field) {
          case 'genres':
          case 'phases':
          case 'moods':
          case 'topics':
          case 'tags':
            newTags[field] = edit.newValue.split(',').map(s => s.trim()).filter(Boolean);
            break;
          case 'related':
            try { newTags.related = JSON.parse(edit.newValue); } catch { /* skip */ }
            break;
          // 'genre' (standard field) is handled automatically by writeTags when genres is set
        }
      }

      await mp3Manager.writeTags(filePath, newTags);

      // Mark all edits for this file as applied
      for (const edit of edits) {
        updateTagEditStatus(edit.id, 'applied');
        addTagHistory(edit.filePath, edit.fieldName, edit.originalValue, edit.newValue, 'export');
        successCount++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      for (const edit of edits) {
        updateTagEditStatus(edit.id, 'failed');
        failed.push({ id: edit.id, error: errorMessage, filePath: edit.filePath });
      }
    }
  }

  return { success: successCount, failed };
}

/**
 * Reject export edits.
 */
export async function onRejectExport(editIds: number[]): Promise<void> {
  bulkUpdateTagEditStatus(editIds, 'rejected');
}

// ─── Import: ID3 Tags → Dashboard ────────────────────────────────────────

/**
 * Preview import: scan files for µ: tags and generate import proposals.
 * Compares ID3 µ: tags against both moodboard state AND song_tags/song_connections tables.
 */
export async function onPreviewImport(filePaths?: string[]): Promise<{
  summaries: FileDiffSummary[];
  editCount: number;
}> {
  clearPendingTagEditsByDirection('import');

  const paths = filePaths || await getLibraryFilePaths();

  // Use moodboard-based diffs first
  const summaries = await generateBulkImportDiff(paths);

  // Supplement: for songs not on a moodboard, compare ID3 vs song_tags table
  for (const fp of paths) {
    if (summaries.find(s => s.filePath === fp)) continue;

    let fileTags: MusickTagData | null;
    try {
      fileTags = await mp3Manager.readMusickTags(fp);
    } catch { continue; }
    if (!fileTags) continue;

    const dbTags = getTagsForSong(fp);
    const dbConns = getConnectionsForSong(fp);

    // Build current DB state as MusickTagData for comparison
    const connTargets = dbConns.map(c => {
      const otherPath = c.source_path === fp ? c.target_path : c.source_path;
      const cached = getMP3CacheByPath(otherPath);
      return {
        targetTitle: cached?.title || 'Unknown',
        targetArtist: cached?.artist || 'Unknown',
        type: c.connection_type,
        weight: c.weight,
      };
    });
    const dbMusickData = MP3MetadataManager.tagsToMusickData(
      dbTags.map(t => ({ label: t.tag_label, category: t.tag_category })),
      connTargets,
    );

    const diffs = buildFieldDiffs(fp, dbMusickData, fileTags, 'import');
    if (diffs.length > 0) {
      const cached = getMP3CacheByPath(fp);
      summaries.push({
        filePath: fp,
        title: cached?.title,
        artist: cached?.artist,
        diffs,
      });
    }
  }

  let editCount = 0;
  for (const summary of summaries) {
    for (const diff of summary.diffs) {
      addTagEdit(diff.filePath, diff.fieldName, diff.currentValue, diff.proposedValue, 'import');
      editCount++;
    }
  }

  return { summaries, editCount };
}

/**
 * Preview import for a single file.
 */
export async function onPreviewImportFile(filePath: string): Promise<{
  diffs: TagDiff[];
  editIds: number[];
}> {
  const diffs = await generateImportDiff(filePath);
  const editIds: number[] = [];

  for (const diff of diffs) {
    const id = addTagEdit(diff.filePath, diff.fieldName, diff.currentValue, diff.proposedValue, 'import');
    editIds.push(id);
  }

  return { diffs, editIds };
}

/**
 * Apply approved import edits — update song_tags and song_connections from file tags.
 * Groups edits by file and applies tag/connection changes as a batch.
 */
export async function onApplyImport(editIds: number[]): Promise<{
  success: number;
  failed: { id: number; error: string; filePath: string }[];
}> {
  let successCount = 0;
  const failed: { id: number; error: string; filePath: string }[] = [];

  // Group edits by file to batch writes
  const editsByFile = new Map<string, PendingTagEdit[]>();
  for (const id of editIds) {
    const edit = getTagEditById(id);
    if (!edit || edit.status !== 'pending') continue;
    const group = editsByFile.get(edit.filePath) || [];
    group.push(edit);
    editsByFile.set(edit.filePath, group);
  }

  for (const [filePath, edits] of editsByFile) {
    try {
      for (const edit of edits) {
        const field = edit.fieldName.startsWith(MUSICK_TAG_PREFIX)
          ? edit.fieldName.slice(MUSICK_TAG_PREFIX.length)
          : edit.fieldName;

        switch (field) {
          case 'genres':
          case 'phases':
          case 'moods':
          case 'topics':
          case 'tags': {
            const category = fieldToCategory(field);
            const labels = edit.newValue.split(',').map(s => s.trim()).filter(Boolean);
            // Clear existing tags in this category, then re-add
            clearSongTags(filePath, category);
            if (labels.length > 0) {
              bulkSetSongTags(filePath, labels.map(label => ({
                label,
                category,
                source: 'id3_import' as const,
              })));
            }
            break;
          }
          case 'related': {
            let related: { title: string; artist: string; type: string; weight: number }[];
            try { related = JSON.parse(edit.newValue); } catch { related = []; }
            if (related.length > 0) {
              // Resolve references to file paths and add connections
              const allCached = searchMP3Cache('', 10000);
              const knownSongs = allCached.map(c => ({
                filePath: c.file_path,
                title: c.title ?? undefined,
                artist: c.artist ?? undefined,
              }));
              for (const rel of related) {
                const targetPath = resolveRelated(rel.title, rel.artist, knownSongs);
                if (targetPath && targetPath !== filePath) {
                  addSongConnection(filePath, targetPath, rel.type as ConnectionType, rel.weight, 'id3_import');
                }
              }
            }
            break;
          }
          // 'genre' (standard field) — map to genre category tags
          case 'genre': {
            const labels = edit.newValue.split(',').map(s => s.trim()).filter(Boolean);
            clearSongTags(filePath, 'genre');
            if (labels.length > 0) {
              bulkSetSongTags(filePath, labels.map(label => ({
                label,
                category: 'genre' as TagCategory,
                source: 'id3_import' as const,
              })));
            }
            break;
          }
        }

        updateTagEditStatus(edit.id, 'applied');
        addTagHistory(edit.filePath, edit.fieldName, edit.originalValue, edit.newValue, 'import');
        successCount++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      for (const edit of edits) {
        updateTagEditStatus(edit.id, 'failed');
        failed.push({ id: edit.id, error: errorMessage, filePath: edit.filePath });
      }
    }
  }

  return { success: successCount, failed };
}

/**
 * Reject import edits.
 */
export async function onRejectImport(editIds: number[]): Promise<void> {
  bulkUpdateTagEditStatus(editIds, 'rejected');
}

// ─── Rebuild: Reconstruct Moodboard from µ: Tags ─────────────────────────

/** Category → color mapping for tag nodes */
const CATEGORY_COLORS: Record<string, string> = {
  genre: 'cyan', phase: 'violet', mood: 'pink', topic: 'gray', custom: 'gray',
};

export interface RebuildResult {
  boardId: number;
  boardName: string;
  songCount: number;
  tagCount: number;
  edgeCount: number;
  relatedEdgeCount: number;
  skippedFiles: string[];
}

/**
 * Rebuild a complete moodboard from µ: TXXX tags embedded in MP3 files.
 * Scans all files, creates a new board, adds song + tag nodes, and edges.
 * Also reconstructs song↔song "related" edges from µ:related data.
 */
export async function onRebuildFromTags(boardName?: string): Promise<RebuildResult> {
  const paths = await getLibraryFilePaths();
  const name = boardName || `Imported ${new Date().toLocaleDateString()}`;
  const board = createMoodboard(name);
  const boardId = board.id;

  // Track tag nodes already created (label|category → nodeId)
  const tagNodeMap = new Map<string, string>();
  const songNodeMap = new Map<string, string>(); // filePath → nodeId
  const skippedFiles: string[] = [];
  let edgeCount = 0;
  let relatedEdgeCount = 0;
  let eid = 0;

  // Phase 1: Create song nodes and tag nodes, connect them
  const cols = 6;
  const spacing = 170;
  let songIdx = 0;

  for (const filePath of paths) {
    let tags: MusickTagData | null;
    try {
      tags = await mp3Manager.readMusickTags(filePath);
    } catch {
      skippedFiles.push(filePath);
      continue;
    }
    if (!tags) {
      skippedFiles.push(filePath);
      continue;
    }

    // Create song node with grid layout
    const songId = `song-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const col = songIdx % cols;
    const row = Math.floor(songIdx / cols);
    upsertNode({
      id: songId,
      boardId,
      nodeType: 'song',
      songPath: filePath,
      positionX: col * spacing,
      positionY: row * spacing,
    });
    songNodeMap.set(filePath, songId);
    songIdx++;

    // Helper: ensure a tag node exists, connect song to it
    const connectTag = (label: string, category: string) => {
      const key = `${label}|${category}`;
      let tagNodeId = tagNodeMap.get(key);
      if (!tagNodeId) {
        tagNodeId = `tag-${label.replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`;
        const tagIdx = tagNodeMap.size;
        upsertNode({
          id: tagNodeId,
          boardId,
          nodeType: 'tag',
          tagLabel: label,
          tagCategory: category,
          tagColor: CATEGORY_COLORS[category] || 'gray',
          positionX: -250 + (tagIdx % 4) * 120,
          positionY: -200 + Math.floor(tagIdx / 4) * 100,
        });
        tagNodeMap.set(key, tagNodeId);
      }
      upsertEdge({
        id: `e-imp-${eid++}`,
        boardId,
        sourceNodeId: songId,
        targetNodeId: tagNodeId,
        edgeType: category,
        weight: 0.8,
      });
      edgeCount++;
    };

    // Connect genres, phases, moods, topics, custom tags
    for (const g of tags.genres || []) connectTag(g, 'genre');
    for (const p of tags.phases || []) connectTag(p, 'phase');
    for (const m of tags.moods || []) connectTag(m, 'mood');
    for (const t of tags.topics || []) connectTag(t, 'topic');
    for (const c of tags.tags || []) connectTag(c, 'custom');
  }

  // Phase 2: Reconstruct song→song "related" edges
  // We need to resolve {title, artist} → filePath via the MP3 cache
  for (const [filePath, songId] of songNodeMap) {
    let tags: MusickTagData | null;
    try { tags = await mp3Manager.readMusickTags(filePath); } catch { continue; }
    if (!tags?.related) continue;

    for (const rel of tags.related) {
      // Try to find the related song by searching the cache
      const targetPath = resolveRelatedSong(rel, songNodeMap);
      if (!targetPath) continue;

      const targetNodeId = songNodeMap.get(targetPath);
      if (!targetNodeId || targetNodeId === songId) continue;

      upsertEdge({
        id: `e-rel-${eid++}`,
        boardId,
        sourceNodeId: songId,
        targetNodeId,
        edgeType: rel.type || 'similarity',
        weight: rel.weight || 0.7,
      });
      relatedEdgeCount++;
    }
  }

  return {
    boardId,
    boardName: name,
    songCount: songNodeMap.size,
    tagCount: tagNodeMap.size,
    edgeCount,
    relatedEdgeCount,
    skippedFiles,
  };
}

/**
 * Resolve a {title, artist} reference to a filePath in the library.
 * Searches the MP3 cache for a fuzzy match.
 */
function resolveRelatedSong(
  rel: MusickRelatedSong,
  knownPaths: Map<string, string>
): string | null {
  // Try exact search in cache
  const results = searchMP3Cache(rel.title, 10);
  for (const r of results) {
    if (knownPaths.has(r.file_path)) {
      // Check artist match (fuzzy)
      const a = (r.artist || '').toLowerCase();
      const target = rel.artist.toLowerCase();
      if (a.includes(target) || target.includes(a)) return r.file_path;
    }
  }
  // Fallback: match just by title substring
  for (const r of results) {
    if (knownPaths.has(r.file_path)) return r.file_path;
  }
  return null;
}

// ─── Shared Queries ───────────────────────────────────────────────────────

/**
 * Get all pending tag edits (both export and import).
 */
export async function onGetPendingTagEdits(direction?: 'export' | 'import'): Promise<PendingTagEdit[]> {
  const all = getPendingTagEdits();
  if (direction) return all.filter(e => e.direction === direction);
  return all;
}

/**
 * Get tag edit history.
 */
export async function onGetTagEditHistory(): Promise<TagEditHistory[]> {
  return fetchTagHistory();
}

/**
 * Get pending tag edits for a specific file.
 */
export async function onGetTagEditsForFile(filePath: string): Promise<PendingTagEdit[]> {
  return getTagEditsForFile(filePath);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function getLibraryFilePaths(): Promise<string[]> {
  const base = readBaseFolder();
  if (!base) throw new Error('Base folder not set');
  const scan = await library.scan(base);
  return scan.files.map(f => f.filePath);
}

/** Map µ: field names to TagCategory */
function fieldToCategory(field: string): TagCategory {
  switch (field) {
    case 'genres': return 'genre';
    case 'phases': return 'phase';
    case 'moods':  return 'mood';
    case 'topics': return 'topic';
    case 'tags':   return 'custom';
    default:       return 'custom';
  }
}

/** Normalize a string array for comparison */
function normalizeList(arr?: string[]): string {
  if (!arr || arr.length === 0) return '';
  return [...arr].sort().join(', ');
}

/**
 * Build field-level TagDiff entries comparing two MusickTagData objects.
 * `current` is what's already stored, `proposed` is the new desired state.
 */
function buildFieldDiffs(
  filePath: string,
  current: MusickTagData,
  proposed: MusickTagData,
  direction: 'export' | 'import',
): TagDiff[] {
  const diffs: TagDiff[] = [];

  const comparisons: { field: string; cur: string[]; prop: string[] }[] = [
    { field: `${MUSICK_TAG_PREFIX}genres`, cur: current.genres || [], prop: proposed.genres || [] },
    { field: `${MUSICK_TAG_PREFIX}phases`, cur: current.phases || [], prop: proposed.phases || [] },
    { field: `${MUSICK_TAG_PREFIX}moods`,  cur: current.moods  || [], prop: proposed.moods  || [] },
    { field: `${MUSICK_TAG_PREFIX}topics`, cur: current.topics || [], prop: proposed.topics || [] },
    { field: `${MUSICK_TAG_PREFIX}tags`,   cur: current.tags   || [], prop: proposed.tags   || [] },
  ];

  for (const c of comparisons) {
    const curNorm = normalizeList(c.cur);
    const propNorm = normalizeList(c.prop);
    if (curNorm !== propNorm && propNorm !== '') {
      diffs.push({ filePath, fieldName: c.field, currentValue: curNorm, proposedValue: propNorm, direction });
    }
  }

  // Related songs
  const curRelated = JSON.stringify((current.related || []).sort((a, b) => `${a.title}${a.artist}`.localeCompare(`${b.title}${b.artist}`)));
  const propRelated = JSON.stringify((proposed.related || []).sort((a, b) => `${a.title}${a.artist}`.localeCompare(`${b.title}${b.artist}`)));
  if (curRelated !== propRelated && proposed.related && proposed.related.length > 0) {
    diffs.push({
      filePath,
      fieldName: `${MUSICK_TAG_PREFIX}related`,
      currentValue: curRelated === '[]' ? '' : curRelated,
      proposedValue: propRelated,
      direction,
    });
  }

  return diffs;
}

// ─── Conflict Resolution ─────────────────────────────────────────────────

export interface ConflictInfo {
  filePath: string;
  title?: string;
  artist?: string;
  field: string;
  dashboardValue: string;
  id3Value: string;
  direction: 'export' | 'import';
}

/**
 * Detect conflicts where dashboard (song_tags + song_connections) disagrees with ID3 µ: tags.
 * Returns a list of per-field conflicts with both values shown.
 */
export async function onGetConflicts(filePaths?: string[]): Promise<ConflictInfo[]> {
  const paths = filePaths || await getLibraryFilePaths();
  const conflicts: ConflictInfo[] = [];

  for (const fp of paths) {
    let id3Tags: MusickTagData;
    try {
      id3Tags = await mp3Manager.readMusickTags(fp) || {};
    } catch { continue; }

    // Build dashboard state from song_tags + song_connections
    const dbTags = getTagsForSong(fp);
    const dbConns = getConnectionsForSong(fp);
    const connTargets = dbConns.map(c => {
      const otherPath = c.source_path === fp ? c.target_path : c.source_path;
      const cached = getMP3CacheByPath(otherPath);
      return {
        targetTitle: cached?.title || 'Unknown',
        targetArtist: cached?.artist || 'Unknown',
        type: c.connection_type,
        weight: c.weight,
      };
    });
    const dbMusickData = MP3MetadataManager.tagsToMusickData(
      dbTags.map(t => ({ label: t.tag_label, category: t.tag_category })),
      connTargets,
    );

    const cached = getMP3CacheByPath(fp);

    const fieldPairs: { field: string; dbVal: string[]; id3Val: string[] }[] = [
      { field: `${MUSICK_TAG_PREFIX}genres`, dbVal: dbMusickData.genres || [], id3Val: id3Tags.genres || [] },
      { field: `${MUSICK_TAG_PREFIX}phases`, dbVal: dbMusickData.phases || [], id3Val: id3Tags.phases || [] },
      { field: `${MUSICK_TAG_PREFIX}moods`,  dbVal: dbMusickData.moods  || [], id3Val: id3Tags.moods  || [] },
      { field: `${MUSICK_TAG_PREFIX}topics`, dbVal: dbMusickData.topics || [], id3Val: id3Tags.topics || [] },
      { field: `${MUSICK_TAG_PREFIX}tags`,   dbVal: dbMusickData.tags   || [], id3Val: id3Tags.tags   || [] },
    ];

    for (const pair of fieldPairs) {
      const dbNorm = normalizeList(pair.dbVal);
      const id3Norm = normalizeList(pair.id3Val);
      if (dbNorm !== id3Norm && (dbNorm !== '' || id3Norm !== '')) {
        conflicts.push({
          filePath: fp,
          title: cached?.title ?? undefined,
          artist: cached?.artist ?? undefined,
          field: pair.field,
          dashboardValue: dbNorm,
          id3Value: id3Norm,
          direction: dbNorm && !id3Norm ? 'export' : 'import',
        });
      }
    }

    // Related songs conflict
    const dbRelStr = JSON.stringify((dbMusickData.related || []).sort((a, b) => `${a.title}${a.artist}`.localeCompare(`${b.title}${b.artist}`)));
    const id3RelStr = JSON.stringify((id3Tags.related || []).sort((a, b) => `${a.title}${a.artist}`.localeCompare(`${b.title}${b.artist}`)));
    if (dbRelStr !== id3RelStr && (dbRelStr !== '[]' || id3RelStr !== '[]')) {
      conflicts.push({
        filePath: fp,
        title: cached?.title ?? undefined,
        artist: cached?.artist ?? undefined,
        field: `${MUSICK_TAG_PREFIX}related`,
        dashboardValue: dbRelStr === '[]' ? '' : dbRelStr,
        id3Value: id3RelStr === '[]' ? '' : id3RelStr,
        direction: dbRelStr !== '[]' && id3RelStr === '[]' ? 'export' : 'import',
      });
    }
  }

  return conflicts;
}

// ─── VDJ Export: Moodboard → Standard ID3 Frames (TCON, COMM, TIT1) ──────

/**
 * Preview VDJ export: generate diffs showing what TCON, COMM, TIT1 would change.
 */
export async function onPreviewVDJExport(): Promise<FileDiffSummary[]> {
  return generateBulkVDJExportDiff();
}

/**
 * Apply VDJ export: write VDJ-compatible tags (TCON, COMM, TIT1, µ: TXXX) to files.
 */
export async function onApplyVDJExport(filePaths: string[]): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const filePath of filePaths) {
    try {
      const moodboardTags = getMoodboardTagsForSong(filePath);
      const relatedSongs = getMoodboardRelatedSongs(filePath);

      // Read existing metadata for energy/key (preserved from file)
      const metadata = await mp3Manager.readMetadata(filePath);

      await mp3Manager.writeVDJTags(filePath, {
        genres: moodboardTags.genres,
        phases: moodboardTags.phases,
        moods: moodboardTags.moods,
        tags: moodboardTags.custom,
        energyLevel: metadata.energyLevel,
        camelotKey: metadata.camelotKey,
        relatedSongs: relatedSongs.map(r => ({ artist: r.artist, title: r.title })),
      }, DEFAULT_VDJ_OPTIONS);

      // Log each written field to history
      const fieldsWritten = ['genre', 'comment', 'grouping'];
      for (const field of fieldsWritten) {
        addTagHistory(filePath, field, '', '(VDJ export)', 'export');
      }

      success++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${filePath}: ${msg}`);
    }
  }

  return { success, failed, errors };
}

/**
 * Debug: check what the server sees in the moodboard tables.
 */
export async function onDebugMoodboardState(): Promise<{
  nodeCount: number;
  edgeCount: number;
  songNodes: { id: string; songPath: string }[];
  tagNodes: { id: string; label: string; category: string }[];
  baseFolder: string | null;
}> {
  const { db } = await import('../database/sqlite/db');
  const nodeCount = (db().prepare('SELECT COUNT(*) as c FROM moodboard_nodes').get() as any).c;
  const edgeCount = (db().prepare('SELECT COUNT(*) as c FROM moodboard_edges').get() as any).c;
  const songNodes = db().prepare("SELECT id, song_path as songPath FROM moodboard_nodes WHERE node_type = 'song'").all() as any[];
  const tagNodes = db().prepare("SELECT id, tag_label as label, tag_category as category FROM moodboard_nodes WHERE node_type = 'tag'").all() as any[];
  return { nodeCount, edgeCount, songNodes, tagNodes, baseFolder: readBaseFolder() };
}
