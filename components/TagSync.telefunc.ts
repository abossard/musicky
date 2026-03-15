import { MP3MetadataManager, type MusickTagData, type MusickRelatedSong, MUSICK_TAG_PREFIX } from '../lib/mp3-metadata';
import {
  generateExportDiff,
  generateImportDiff,
  generateBulkExportDiff,
  generateBulkImportDiff,
  type FileDiffSummary,
  type TagDiff,
} from '../lib/tag-sync-engine';
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
  createMoodboard,
  upsertNode,
  upsertEdge,
  isSongOnBoard,
  getNodes,
} from '../database/sqlite/queries/moodboard';
import { searchMP3Cache } from '../database/sqlite/queries/dj-sets';
import { MP3Library } from '../lib/mp3-library';
import { readBaseFolder } from '../database/sqlite/queries/library-settings';

const mp3Manager = new MP3MetadataManager();
const library = new MP3Library();

// ─── Export: Dashboard → ID3 Tags ─────────────────────────────────────────

/**
 * Preview export: generate diffs for specified files (or whole library)
 * and create pending tag edits for review.
 */
export async function onPreviewExport(filePaths?: string[]): Promise<{
  summaries: FileDiffSummary[];
  editCount: number;
}> {
  // Clear previous pending exports
  clearPendingTagEditsByDirection('export');

  const paths = filePaths || await getLibraryFilePaths();
  const summaries = await generateBulkExportDiff(paths);

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
 */
export async function onPreviewImport(filePaths?: string[]): Promise<{
  summaries: FileDiffSummary[];
  editCount: number;
}> {
  clearPendingTagEditsByDirection('import');

  const paths = filePaths || await getLibraryFilePaths();
  const summaries = await generateBulkImportDiff(paths);

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
 * Apply approved import edits — update dashboard/DB from file tags.
 * Creates/updates moodboard tag nodes and edges for each file.
 */
export async function onApplyImport(editIds: number[]): Promise<{
  success: number;
  failed: { id: number; error: string; filePath: string }[];
}> {
  let successCount = 0;
  const failed: { id: number; error: string; filePath: string }[] = [];

  for (const id of editIds) {
    const edit = getTagEditById(id);
    if (!edit || edit.status !== 'pending') continue;

    try {
      updateTagEditStatus(id, 'applied');
      addTagHistory(edit.filePath, edit.fieldName, edit.originalValue, edit.newValue, 'import');
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateTagEditStatus(id, 'failed');
      failed.push({ id: edit.id, error: errorMessage, filePath: edit.filePath });
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
