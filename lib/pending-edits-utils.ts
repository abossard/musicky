import { 
  onGetPendingEdits, 
  onApplyPendingEdits, 
  onDeletePendingEdit, 
  onUpdatePendingEdit,
  onGetLastApplyError,
  onClearLastApplyError,
  onTestMP3CommentWriting,
  onTestPendingEditWorkflow
} from '../components/MP3MetadataViewer.telefunc';
import type { PendingEdit } from './mp3-metadata';

// Pure async operations
export const fetchPendingEdits = async (): Promise<PendingEdit[]> => {
  return await onGetPendingEdits();
};

export const fetchLastError = async () => {
  return await onGetLastApplyError();
};

export const applyEdits = async (selectedIds?: number[]) => {
  return await onApplyPendingEdits(selectedIds);
};

export const deleteEdit = async (id: number) => {
  return await onDeletePendingEdit(id);
};

export const updateEdit = async (id: number, comment: string) => {
  return await onUpdatePendingEdit(id, comment);
};

export const clearLastError = async () => {
  return await onClearLastApplyError();
};

export const runCommentTest = async (filePath: string) => {
  return await onTestMP3CommentWriting(filePath);
};

export const runWorkflowTest = async (filePath: string) => {
  return await onTestPendingEditWorkflow(filePath);
};

// Array utility functions
export const toggleSelection = (selectedIds: number[], id: number): number[] => {
  return selectedIds.includes(id)
    ? selectedIds.filter(selectedId => selectedId !== id)
    : [...selectedIds, id];
};

export const selectAll = (items: PendingEdit[]): number[] => {
  return items.map(item => item.id);
};

export const selectNone = (): number[] => [];

export const removeFromSelection = (selectedIds: number[], id: number): number[] => {
  return selectedIds.filter(selectedId => selectedId !== id);
};

export const getSelectedEdits = (edits: PendingEdit[], selectedIds: number[]): PendingEdit[] => {
  return edits.filter(edit => selectedIds.includes(edit.id));
};

// CSS class utilities
export const getStatusClasses = (status: string): string => {
  const baseClasses = 'font-medium';
  const statusMap = {
    pending: 'text-yellow-600',
    applied: 'text-green-600',
    failed: 'text-red-600'
  };
  return `${baseClasses} ${statusMap[status as keyof typeof statusMap] || 'text-gray-600'}`;
};

export const getTestResultClasses = (success: boolean): string => {
  return success 
    ? 'bg-green-100 border-green-200 text-green-800' 
    : 'bg-red-100 border-red-200 text-red-800';
};

export const getButtonClasses = (variant: 'primary' | 'secondary' | 'danger' | 'success', disabled = false): string => {
  const baseClasses = 'px-3 py-1 text-sm rounded transition-colors';
  const disabledClasses = 'disabled:bg-gray-400 disabled:cursor-not-allowed';
  
  const variantMap = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-500 text-white hover:bg-gray-600',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-green-600 text-white hover:bg-green-700'
  };
  
  return `${baseClasses} ${variantMap[variant]} ${disabled ? disabledClasses : ''}`;
};

// Error formatting utilities
export const formatApplyErrors = (failed: Array<{ filePath: string; error: string }>): string => {
  const failedMessages = failed.map(f => `${f.filePath}: ${f.error}`).join('\n');
  return `Some edits failed:\n${failedMessages}`;
};

export const formatError = (err: unknown): string => {
  return err instanceof Error ? err.message : 'An unknown error occurred';
};

// Test result utilities
export const formatTestResults = (results: Array<{ name: string; success: boolean; error?: string; details?: any }>) => {
  return results.map(result => ({
    ...result,
    icon: result.success ? '✅' : '❌',
    classes: getTestResultClasses(result.success)
  }));
};