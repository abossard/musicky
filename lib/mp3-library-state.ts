import { useReducer } from 'react';
import { MP3Metadata, PendingEdit } from './mp3-metadata';

export interface MP3LibraryState {
  mp3Files: MP3Metadata[];
  phases: string[];
  pendingEdits: PendingEdit[];
  loading: boolean;
  error: string | null;
  updatingFiles: Set<string>;
  editActions: { [key: number]: 'apply' | 'reject' };
}

export type MP3LibraryAction =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_DATA'; mp3Files: MP3Metadata[]; phases: string[]; pendingEdits: PendingEdit[] }
  | { type: 'SET_MP3_FILES'; mp3Files: MP3Metadata[] }
  | { type: 'SET_PENDING_EDITS'; pendingEdits: PendingEdit[] }
  | { type: 'UPDATE_FILE'; file: MP3Metadata }
  | { type: 'SET_FILE_UPDATING'; filePath: string; updating: boolean }
  | { type: 'SET_EDIT_ACTION'; editId: number; action?: 'apply' | 'reject' }
  | { type: 'CLEAR_ERROR' };

export const initialMP3LibraryState: MP3LibraryState = {
  mp3Files: [],
  phases: [],
  pendingEdits: [],
  loading: true,
  error: null,
  updatingFiles: new Set(),
  editActions: {}
};

export function mp3LibraryReducer(state: MP3LibraryState, action: MP3LibraryAction): MP3LibraryState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    
    case 'SET_ERROR':
      return { ...state, error: action.error };
    
    case 'SET_DATA':
      return {
        ...state,
        mp3Files: action.mp3Files,
        phases: action.phases,
        pendingEdits: action.pendingEdits,
        loading: false,
        error: null
      };
    
    case 'SET_MP3_FILES':
      return { ...state, mp3Files: action.mp3Files };
    
    case 'SET_PENDING_EDITS':
      return { ...state, pendingEdits: action.pendingEdits };
    
    case 'UPDATE_FILE':
      return {
        ...state,
        mp3Files: state.mp3Files.map(file =>
          file.filePath === action.file.filePath ? action.file : file
        )
      };
    
    case 'SET_FILE_UPDATING':
      const newUpdatingFiles = new Set(state.updatingFiles);
      if (action.updating) {
        newUpdatingFiles.add(action.filePath);
      } else {
        newUpdatingFiles.delete(action.filePath);
      }
      return { ...state, updatingFiles: newUpdatingFiles };
    
    case 'SET_EDIT_ACTION':
      if (action.action) {
        return {
          ...state,
          editActions: { ...state.editActions, [action.editId]: action.action }
        };
      } else {
        const newEditActions = { ...state.editActions };
        delete newEditActions[action.editId];
        return { ...state, editActions: newEditActions };
      }
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    default:
      return state;
  }
}

export const useMP3LibraryState = () => {
  return useReducer(mp3LibraryReducer, initialMP3LibraryState);
};