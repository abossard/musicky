import { MP3MetadataManager, type MusickTagData, MUSICK_TAG_PREFIX } from '../lib/mp3-metadata';
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
 * This is more complex than export because it needs to create moodboard nodes/edges.
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
      // For import, the `proposedValue` is what came from the file tags.
      // We need to update the dashboard state (moodboard, cache, etc.)
      // For now, we mark as applied — the UI can use this data to prompt
      // the user to create moodboard connections.
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
