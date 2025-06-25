import { MP3Metadata, PendingEdit } from './mp3-metadata';
import { formatGenre, formatTrack } from './format-utils';
import { isEmpty, isNonEmpty } from './validation-utils';

// Phase extraction utilities
export const extractPhases = (comment: string, availablePhases: string[]): string[] => {
  const hashtags = comment.match(/#\w+/g) || [];
  return hashtags
    .map(tag => tag.slice(1))
    .filter(tag => availablePhases.includes(tag));
};

// Pending edit utilities
export const findPendingEdit = (pendingEdits: PendingEdit[], filePath: string): PendingEdit | undefined => {
  return pendingEdits.find(edit => edit.filePath === filePath && edit.status === 'pending');
};

export const getEffectiveComment = (pendingEdits: PendingEdit[], filePath: string, originalComment: string): string => {
  const pendingEdit = findPendingEdit(pendingEdits, filePath);
  return pendingEdit ? pendingEdit.newComment : originalComment;
};

export const getEffectivePhases = (pendingEdits: PendingEdit[], availablePhases: string[], filePath: string, originalComment: string): string[] => {
  const effectiveComment = getEffectiveComment(pendingEdits, filePath, originalComment);
  return extractPhases(effectiveComment, availablePhases);
};

// Phase toggle utilities
export const togglePhase = (currentPhases: string[], phase: string, checked: boolean): string[] => {
  return checked 
    ? [...new Set([...currentPhases, phase])] // Use Set to prevent duplicates
    : currentPhases.filter(p => p !== phase);
};

// File utilities
export const getFileName = (filePath: string): string => {
  return filePath.split('/').pop() || filePath;
};

export const getDisplayTitle = (metadata: MP3Metadata): string => {
  return metadata.title || getFileName(metadata.filePath);
};

export const getDisplayArtist = (metadata: MP3Metadata): string => {
  return metadata.artist || '—';
};

export const getDisplayGenre = (metadata: MP3Metadata): string => {
  return formatGenre(metadata.genre);
};

export const getDisplayTrack = (metadata: MP3Metadata): string => {
  return formatTrack(metadata.track);
};

// State update utilities
export const updateFileInList = (files: MP3Metadata[], updatedFile: MP3Metadata): MP3Metadata[] => {
  return files.map(file => 
    file.filePath === updatedFile.filePath ? updatedFile : file
  );
};

export const toggleFileInSet = (set: Set<string>, filePath: string, add: boolean): Set<string> => {
  const newSet = new Set(set);
  if (add) {
    newSet.add(filePath);
  } else {
    newSet.delete(filePath);
  }
  return newSet;
};

export const updateEditAction = (actions: { [key: number]: 'apply' | 'reject' }, editId: number, action?: 'apply' | 'reject'): { [key: number]: 'apply' | 'reject' } => {
  if (action) {
    return { ...actions, [editId]: action };
  } else {
    const newActions = { ...actions };
    delete newActions[editId];
    return newActions;
  }
};

// Row styling utilities
export const getRowClassName = (
  file: MP3Metadata,
  pendingEdits: PendingEdit[],
  updatingFiles: Set<string>,
  currentTrackPath?: string
): string => {
  const classes: string[] = [];
  
  if (updatingFiles.has(file.filePath)) classes.push('updating');
  if (findPendingEdit(pendingEdits, file.filePath)) classes.push('has-pending');
  if (currentTrackPath === file.filePath) classes.push('current-track');
  
  return classes.join(' ');
};