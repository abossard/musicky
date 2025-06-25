import { useEffect, useCallback } from 'react';
import { MP3LibraryAction } from './mp3-library-state';
import {
  onGetAllMP3Files,
  onUpdateFilePhases,
  onGetPendingEdits,
  onApplyPendingEdit,
  onRejectPendingEdit,
  onGetSingleMP3File
} from '../components/MP3Library.telefunc';
import { onGetPhases, onGetKeepPlayHead } from '../components/Settings.telefunc';
import { getEffectiveComment, extractPhases, togglePhase } from './mp3-data-utils';

export const useDataLoader = (dispatch: React.Dispatch<MP3LibraryAction>) => {
  const loadData = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', loading: true });
      dispatch({ type: 'SET_ERROR', error: null });
      
      const [scanResult, availablePhases, edits] = await Promise.all([
        onGetAllMP3Files(),
        onGetPhases(),
        onGetPendingEdits()
      ]);
      
      dispatch({
        type: 'SET_DATA',
        mp3Files: scanResult.files,
        phases: availablePhases,
        pendingEdits: edits
      });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to load MP3 library'
      });
      dispatch({ type: 'SET_LOADING', loading: false });
    }
  }, [dispatch]);

  const refreshPendingEdits = useCallback(async () => {
    try {
      const edits = await onGetPendingEdits();
      dispatch({ type: 'SET_PENDING_EDITS', pendingEdits: edits });
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to refresh pending edits'
      });
    }
  }, [dispatch]);

  const updateSingleFile = useCallback(async (filePath: string) => {
    try {
      const result = await onGetSingleMP3File(filePath);
      
      if (result.success && result.file) {
        dispatch({ type: 'UPDATE_FILE', file: result.file });
      } else {
        dispatch({
          type: 'SET_ERROR',
          error: result.error || 'Failed to update file metadata'
        });
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to update file metadata'
      });
    }
  }, [dispatch]);

  return { loadData, refreshPendingEdits, updateSingleFile };
};

export const usePhaseActions = (
  state: { mp3Files: any[]; phases: string[]; pendingEdits: any[] },
  dispatch: React.Dispatch<MP3LibraryAction>,
  { refreshPendingEdits }: { refreshPendingEdits: () => Promise<void> }
) => {
  const handlePhaseToggle = useCallback(async (filePath: string, phase: string, checked: boolean) => {
    dispatch({ type: 'SET_FILE_UPDATING', filePath, updating: true });
    
    try {
      const file = state.mp3Files.find(f => f.filePath === filePath);
      if (!file) return;
      
      const effectiveComment = getEffectiveComment(state.pendingEdits, filePath, file.comment || '');
      const currentPhases = extractPhases(effectiveComment, state.phases);
      const newPhases = togglePhase(currentPhases, phase, checked);
      
      const result = await onUpdateFilePhases(filePath, newPhases);
      
      if (result.success) {
        await refreshPendingEdits();
      } else {
        dispatch({
          type: 'SET_ERROR',
          error: result.error || 'Failed to update phases'
        });
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to update phases'
      });
    } finally {
      dispatch({ type: 'SET_FILE_UPDATING', filePath, updating: false });
    }
  }, [state.mp3Files, state.phases, state.pendingEdits, dispatch, refreshPendingEdits]);

  return { handlePhaseToggle };
};

export const useEditActions = (
  state: { pendingEdits: any[] },
  dispatch: React.Dispatch<MP3LibraryAction>,
  { refreshPendingEdits, updateSingleFile }: { 
    refreshPendingEdits: () => Promise<void>; 
    updateSingleFile: (filePath: string) => Promise<void>; 
  }
) => {
  const handleApplyEdit = useCallback(async (editId: number) => {
    dispatch({ type: 'SET_EDIT_ACTION', editId, action: 'apply' });
    try {
      const edit = state.pendingEdits.find(e => e.id === editId);
      if (!edit) {
        dispatch({ type: 'SET_ERROR', error: 'Edit not found' });
        return;
      }
      
      const result = await onApplyPendingEdit(editId);
      if (result.success) {
        await Promise.all([
          refreshPendingEdits(),
          updateSingleFile(edit.filePath)
        ]);
      } else {
        dispatch({
          type: 'SET_ERROR',
          error: result.error || 'Failed to apply edit'
        });
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to apply edit'
      });
    } finally {
      dispatch({ type: 'SET_EDIT_ACTION', editId });
    }
  }, [state.pendingEdits, dispatch, refreshPendingEdits, updateSingleFile]);

  const handleRejectEdit = useCallback(async (editId: number) => {
    dispatch({ type: 'SET_EDIT_ACTION', editId, action: 'reject' });
    try {
      const result = await onRejectPendingEdit(editId);
      if (result.success) {
        await refreshPendingEdits();
      } else {
        dispatch({
          type: 'SET_ERROR',
          error: result.error || 'Failed to reject edit'
        });
      }
    } catch (err) {
      dispatch({
        type: 'SET_ERROR',
        error: err instanceof Error ? err.message : 'Failed to reject edit'
      });
    } finally {
      dispatch({ type: 'SET_EDIT_ACTION', editId });
    }
  }, [dispatch, refreshPendingEdits]);

  return { handleApplyEdit, handleRejectEdit };
};

export const useKeepPlayHeadLoader = (audioQueue: any) => {
  useEffect(() => {
    const loadKeepPlayHeadSetting = async () => {
      try {
        const keepPlayHead = await onGetKeepPlayHead();
        audioQueue.setKeepPlayHead(keepPlayHead);
      } catch (error) {
        console.error('Failed to load keep play head setting:', error);
      }
    };
    loadKeepPlayHeadSetting();
  }, [audioQueue]);
};