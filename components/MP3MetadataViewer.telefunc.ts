import { MP3MetadataManager, type MP3Metadata, type PendingEdit } from '../lib/mp3-metadata';
import {
  addPendingEdit,
  getAllPendingEdits,
  updatePendingEditStatus,
  removePendingEdit,
  modifyPendingEdit,
  getPendingEditById
} from '../database/sqlite/queries/mp3-edits';
import { addHistory, fetchHistory, markHistoryReverted } from '../database/sqlite/queries/mp3-history';

const mp3Manager = new MP3MetadataManager();

/**
 * Read MP3 metadata from a file
 */
export async function onReadMP3Metadata(filePath: string): Promise<MP3Metadata> {
  if (!MP3MetadataManager.validateMP3File(filePath)) {
    throw new Error('File is not a valid MP3 file');
  }
  
  return await mp3Manager.readMetadata(filePath);
}

/**
 * Save a pending comment edit
 */
export async function onSavePendingEdit(
  filePath: string,
  originalComment: string | null,
  newComment: string
): Promise<void> {
  if (!MP3MetadataManager.validateMP3File(filePath)) {
    throw new Error('File is not a valid MP3 file');
  }
  
  if (!newComment.trim()) {
    throw new Error('New comment cannot be empty');
  }
  
  addPendingEdit(filePath, originalComment, newComment);
}

/**
 * Get all pending edits
 */
export async function onGetPendingEdits(): Promise<PendingEdit[]> {
  return getAllPendingEdits();
}

/**
 * Apply pending edits to MP3 files
 */
export async function onApplyPendingEdits(editIds?: number[]): Promise<{
  success: number;
  failed: { id: number; error: string; filePath: string }[];
}> {
  const pendingEdits = getAllPendingEdits();
  const editsToApply = editIds 
    ? pendingEdits.filter(edit => editIds.includes(edit.id))
    : pendingEdits;
  
  let successCount = 0;
  const failed: { id: number; error: string; filePath: string }[] = [];
  
  for (const edit of editsToApply) {
    try {
      await mp3Manager.writeComment(edit.filePath, edit.newComment);
      addHistory(edit.filePath, edit.originalComment, edit.newComment);
      updatePendingEditStatus(edit.id, 'applied');
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updatePendingEditStatus(edit.id, 'failed');
      failed.push({
        id: edit.id,
        error: errorMessage,
        filePath: edit.filePath
      });
    }
  }
  
  return { success: successCount, failed };
}

/**
 * Delete a pending edit
 */
export async function onDeletePendingEdit(id: number): Promise<void> {
  removePendingEdit(id);
}

/**
 * Update a pending edit's comment
 */
export async function onUpdatePendingEdit(id: number, newComment: string): Promise<void> {
  if (!newComment.trim()) {
    throw new Error('Comment cannot be empty');
  }

  modifyPendingEdit(id, newComment);
}

export async function onUndoAppliedEdit(id: number): Promise<void> {
  const edit = getPendingEditById(id);
  if (!edit) throw new Error('Edit not found');
  if (edit.status !== 'applied') throw new Error('Edit is not applied');

  await mp3Manager.writeComment(edit.filePath, edit.originalComment || '');

  const history = fetchHistory().find(
    h => h.filePath === edit.filePath && h.newComment === edit.newComment && !h.reverted
  );
  if (history) {
    markHistoryReverted(history.id);
  }

  updatePendingEditStatus(id, 'pending');
}
