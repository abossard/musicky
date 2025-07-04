/**
 * Business Logic Layer
 * 
 * Following "Grokking Simplicity" principles:
 * - Pure functions for calculations
 * - Clear separation of actions from calculations
 * - Stratified design with focused responsibilities
 */

import { MP3Metadata } from './mp3-metadata';

/**
 * Pure calculation: Extract phases from comment string
 */
export function extractPhases(comment: string): string[] {
  const hashtagRegex = /#(\w+)/g;
  const phases = [];
  let match;
  
  while ((match = hashtagRegex.exec(comment)) !== null) {
    phases.push(match[1].toLowerCase());
  }
  
  return [...new Set(phases)];
}

/**
 * Pure calculation: Toggle phase in comment string
 */
export function togglePhaseInComment(comment: string, phase: string): string {
  const hashtag = `#${phase}`;
  const currentPhases = extractPhases(comment);
  
  if (currentPhases.includes(phase.toLowerCase())) {
    // Remove the phase
    return comment.replace(new RegExp(`\\s*${hashtag}\\b`, 'gi'), '').trim();
  } else {
    // Add the phase
    return comment ? `${comment} ${hashtag}` : hashtag;
  }
}

/**
 * Pure calculation: Check if file has pending edits
 */
export function hasPendingEdits(filePath: string, pendingEdits: any[]): boolean {
  return pendingEdits.some(edit => edit.filePath === filePath);
}

/**
 * Action: Toggle phase for a file (impure - involves file operations)
 */
export async function togglePhaseForFile(filePath: string, phase: string): Promise<MP3Metadata> {
  try {
    // Get current file data
    const { onGetSingleMP3File } = await import('../components/MP3Library.telefunc');
    const result = await onGetSingleMP3File(filePath);
    
    if (!result.success || !result.file) {
      throw new Error(result.error || 'Failed to get file data');
    }
    
    const currentFile = result.file;
    const currentComment = currentFile.comment || '';
    
    // Calculate new comment (pure function)
    const newComment = togglePhaseInComment(currentComment, phase);
    
    // Update file phases
    const { onUpdateFilePhases } = await import('../components/MP3Library.telefunc');
    const phases = extractPhases(newComment);
    const updateResult = await onUpdateFilePhases(filePath, phases);
    
    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update file phases');
    }
    
    // Return updated file data
    return {
      ...currentFile,
      comment: newComment
    };
  } catch (error) {
    throw new Error(`Phase toggle failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Pure calculation: Format file size
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return '--';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Pure calculation: Format duration
 */
export function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Pure calculation: Get effective comment for display
 */
export function getEffectiveComment(file: MP3Metadata, pendingEdits: any[]): string {
  const pendingEdit = pendingEdits.find(edit => edit.filePath === file.filePath);
  return pendingEdit ? pendingEdit.newComment : (file.comment || '');
}

/**
 * Pure calculation: Determine row style based on file state
 */
export function getRowStyle(file: MP3Metadata, pendingEdits: any[], isCurrentTrack: boolean): string {
  let classes = [];
  
  if (isCurrentTrack) {
    classes.push('current-track');
  }
  
  if (hasPendingEdits(file.filePath, pendingEdits)) {
    classes.push('has-pending-edits');
  }
  
  return classes.join(' ');
}

/**
 * Action: Batch update phases for multiple files
 */
export async function batchUpdatePhases(operations: Array<{filePath: string, phase: string}>): Promise<MP3Metadata[]> {
  const results: MP3Metadata[] = [];
  
  for (const op of operations) {
    try {
      const updatedFile = await togglePhaseForFile(op.filePath, op.phase);
      results.push(updatedFile);
    } catch (error) {
      console.error(`Failed to update ${op.filePath}:`, error);
      // Continue with other operations
    }
  }
  
  return results;
}