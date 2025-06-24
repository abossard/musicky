import { MP3Library, type MP3LibraryScan, type MP3EditHistory } from '../lib/mp3-library';
import { saveBaseFolder, readBaseFolder, readPhases } from '../database/sqlite/queries/library-settings';
import { fetchHistory, markHistoryReverted } from '../database/sqlite/queries/mp3-history';
import { getAllPendingEdits, updatePendingEditStatus, removePendingEdit } from '../database/sqlite/queries/mp3-edits';
import { MP3MetadataManager } from '../lib/mp3-metadata';
import type { PendingEdit } from '../lib/mp3-metadata';

const library = new MP3Library();
const mp3Manager = new MP3MetadataManager();

export async function onSetBaseFolder(path: string): Promise<void> {
  saveBaseFolder(path);
}

export async function onGetBaseFolder(): Promise<string | null> {
  return readBaseFolder();
}

export async function onScanLibrary(): Promise<MP3LibraryScan> {
  const base = readBaseFolder();
  if (!base) throw new Error('Base folder not set');
  return library.scan(base);
}

export async function onFilterLibrary(include: string[] = [], exclude: string[] = []): Promise<MP3LibraryScan> {
  const scan = await onScanLibrary();
  const files = library.filterByTags(scan.files, include, exclude);
  const tags = Array.from(new Set(scan.tags));
  return { files, tags };
}

export async function onGetHistory(): Promise<MP3EditHistory[]> {
  return fetchHistory();
}

export async function onRevertHistory(id: number): Promise<void> {
  const history = fetchHistory().find(h => h.id === id);
  if (!history) throw new Error('History not found');
  await mp3Manager.writeComment(history.filePath, history.oldComment || '');
  markHistoryReverted(id);
}

export async function onGetPendingEdits(): Promise<PendingEdit[]> {
  return getAllPendingEdits();
}

export async function onApplyPendingEdit(editId: number): Promise<{ success: boolean; error?: string }> {
  console.log(`[MP3Library] Applying single pending edit: ${editId}`);
  
  try {
    const edits = getAllPendingEdits();
    const edit = edits.find(e => e.id === editId);
    
    if (!edit) {
      return { success: false, error: 'Edit not found' };
    }
    
    if (edit.status !== 'pending') {
      return { success: false, error: 'Edit is not in pending status' };
    }
    
    console.log(`[MP3Library] Applying edit to file: ${edit.filePath}`);
    console.log(`[MP3Library] Comment change: "${edit.originalComment}" -> "${edit.newComment}"`);
    
    // Write the comment to the file
    await mp3Manager.writeComment(edit.filePath, edit.newComment);
    
    // Update status to applied
    updatePendingEditStatus(editId, 'applied');
    
    console.log(`[MP3Library] Successfully applied edit ${editId}`);
    return { success: true };
  } catch (error) {
    console.error(`[MP3Library] Error applying edit ${editId}:`, error);
    updatePendingEditStatus(editId, 'failed');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function onRejectPendingEdit(editId: number): Promise<{ success: boolean; error?: string }> {
  console.log(`[MP3Library] Rejecting pending edit: ${editId}`);
  
  try {
    const edits = getAllPendingEdits();
    const edit = edits.find(e => e.id === editId);
    
    if (!edit) {
      return { success: false, error: 'Edit not found' };
    }
    
    if (edit.status !== 'pending') {
      return { success: false, error: 'Edit is not in pending status' };
    }
    
    // Remove the pending edit
    removePendingEdit(editId);
    
    console.log(`[MP3Library] Successfully rejected edit ${editId}`);
    return { success: true };
  } catch (error) {
    console.error(`[MP3Library] Error rejecting edit ${editId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function onGetAllMP3Files(): Promise<MP3LibraryScan> {
  const base = readBaseFolder();
  if (!base) throw new Error('Base folder not set');
  return library.scan(base);
}

export async function onUpdateFilePhases(filePath: string, phases: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    // Read current metadata to get existing comment
    const metadata = await mp3Manager.readMetadata(filePath);
    const currentComment = metadata.comment || '';
    
    // Parse existing hashtags and non-phase content
    const availablePhases = readPhases();
    const existingTags = currentComment.match(/#\w+/g) || [];
    const nonPhaseTags = existingTags.filter(tag => !availablePhases.includes(tag.slice(1)));
    const nonTagContent = currentComment.replace(/#\w+/g, '').trim();
    
    // Build new comment with selected phases and existing non-phase content
    const phaseTags = phases.map(phase => `#${phase}`);
    const newCommentParts = [];
    
    if (nonTagContent) {
      newCommentParts.push(nonTagContent);
    }
    
    // Add non-phase tags back
    newCommentParts.push(...nonPhaseTags);
    
    // Add selected phase tags
    newCommentParts.push(...phaseTags);
    
    const newComment = newCommentParts.join(' ').trim();
    
    // Write the updated comment
    await mp3Manager.writeComment(filePath, newComment);
    
    return { success: true };
  } catch (error) {
    console.error(`Error updating phases for ${filePath}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
