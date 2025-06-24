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
import { testMP3CommentWriting, testPendingEditWorkflow, type TestResult } from '../lib/mp3-test-utils';

let lastApplyError: { timestamp: Date; error: string; filePath?: string } | null = null;

/**
 * Get the last error from applying edits
 */
export async function onGetLastApplyError(): Promise<{ timestamp: Date; error: string; filePath?: string } | null> {
  return lastApplyError;
}

/**
 * Clear the last error
 */
export async function onClearLastApplyError(): Promise<void> {
  lastApplyError = null;
}

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
  console.log('[MP3] Starting to apply pending edits...', { editIds });
  
  const pendingEdits = getAllPendingEdits();
  console.log('[MP3] Found pending edits:', pendingEdits.length);
  
  const editsToApply = editIds 
    ? pendingEdits.filter(edit => editIds.includes(edit.id))
    : pendingEdits;
  
  console.log('[MP3] Edits to apply:', editsToApply.length, editsToApply);
  
  let successCount = 0;
  const failed: { id: number; error: string; filePath: string }[] = [];
  
  for (const edit of editsToApply) {
    console.log(`[MP3] Processing edit ${edit.id} for file: ${edit.filePath}`);
    console.log(`[MP3] Comment change: "${edit.originalComment}" -> "${edit.newComment}"`);
    
    try {
      // Validate file exists and is accessible
      console.log(`[MP3] Validating file: ${edit.filePath}`);
      if (!MP3MetadataManager.validateMP3File(edit.filePath)) {
        throw new Error(`Invalid MP3 file: ${edit.filePath}`);
      }
      
      // Try to write the comment
      console.log(`[MP3] Writing comment to file: ${edit.filePath}`);
      await mp3Manager.writeComment(edit.filePath, edit.newComment);
      console.log(`[MP3] Successfully wrote comment to file: ${edit.filePath}`);
      
      // Add to history
      console.log(`[MP3] Adding to history for file: ${edit.filePath}`);
      addHistory(edit.filePath, edit.originalComment, edit.newComment);
      
      // Update status
      console.log(`[MP3] Updating status to 'applied' for edit ${edit.id}`);
      updatePendingEditStatus(edit.id, 'applied');
      
      successCount++;
      console.log(`[MP3] Successfully processed edit ${edit.id}. Total success: ${successCount}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MP3] Failed to process edit ${edit.id}:`, error);
      console.error(`[MP3] Error details:`, {
        editId: edit.id,
        filePath: edit.filePath,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      updatePendingEditStatus(edit.id, 'failed');
      failed.push({
        id: edit.id,
        error: errorMessage,
        filePath: edit.filePath
      });

      // Track the last error
      lastApplyError = {
        timestamp: new Date(),
        error: errorMessage,
        filePath: edit.filePath
      };
    }
  }
  
  console.log('[MP3] Apply operation completed:', { 
    success: successCount, 
    failed: failed.length,
    failedDetails: failed 
  });
  
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

/**
 * Run tests for MP3 comment writing functionality
 */
export async function onTestMP3CommentWriting(filePath: string): Promise<TestResult[]> {
  console.log('[MP3Test] Starting MP3 comment writing tests for:', filePath);
  const results = await testMP3CommentWriting(filePath);
  console.log('[MP3Test] Test results:', results);
  return results;
}

/**
 * Run tests for the complete pending edit workflow
 */
export async function onTestPendingEditWorkflow(filePath: string): Promise<TestResult[]> {
  console.log('[MP3Test] Starting pending edit workflow tests for:', filePath);
  const results = await testPendingEditWorkflow(filePath);
  console.log('[MP3Test] Test results:', results);
  return results;
}
