/**
 * Simplified Music Library Hook
 * 
 * Following "Grokking Simplicity" principles:
 * - Separate calculations from actions
 * - Stratified design with clear layers
 * - Minimal, focused API
 */

import { useState, useCallback, useEffect } from 'react';
import { musicDataService, type MusicLibraryData } from './music-data-service';
import { MP3Metadata, PendingEdit } from './mp3-metadata';

export interface MusicLibraryState {
  data: MusicLibraryData;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface MusicLibraryActions {
  loadData: () => Promise<void>;
  refreshData: (dataType?: keyof MusicLibraryData) => Promise<void>;
  updateFile: (file: MP3Metadata) => void;
  clearError: () => void;
}

const initialState: MusicLibraryState = {
  data: {
    files: [],
    phases: [],
    pendingEdits: []
  },
  loading: false,
  error: null,
  lastUpdated: null
};

/**
 * Simplified hook for music library data management.
 * Provides a clean, focused API hiding implementation complexity.
 */
export function useMusicLibrary(): MusicLibraryState & MusicLibraryActions {
  const [state, setState] = useState<MusicLibraryState>(initialState);

  // Pure calculation: Create error handler
  const createErrorHandler = useCallback((operation: string) => {
    return (error: unknown): string => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return `${operation} failed: ${message}`;
    };
  }, []);

  // Action: Load all data
  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await musicDataService.loadLibraryData();
      setState(prev => ({
        ...prev,
        data,
        loading: false,
        lastUpdated: new Date()
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: createErrorHandler('Data loading')(error)
      }));
    }
  }, [createErrorHandler]);

  // Action: Refresh specific data type
  const refreshData = useCallback(async (dataType?: keyof MusicLibraryData) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      if (dataType) {
        await musicDataService.refresh(dataType);
        const cachedData = musicDataService.getCachedData();
        setState(prev => ({
          ...prev,
          data: { ...prev.data, ...cachedData },
          loading: false,
          lastUpdated: new Date()
        }));
      } else {
        // Refresh all data
        await loadData();
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: createErrorHandler('Data refresh')(error)
      }));
    }
  }, [loadData, createErrorHandler]);

  // Action: Update single file (optimistic update)
  const updateFile = useCallback((file: MP3Metadata) => {
    // Update local state immediately
    setState(prev => ({
      ...prev,
      data: {
        ...prev.data,
        files: prev.data.files.map(f => 
          f.filePath === file.filePath ? file : f
        )
      },
      lastUpdated: new Date()
    }));
    
    // Update service cache
    musicDataService.updateFile(file);
  }, []);

  // Action: Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Effect: Auto-load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    ...state,
    loadData,
    refreshData,
    updateFile,
    clearError
  };
}

/**
 * Specialized hook for pending edits management
 * Provides focused functionality for edit operations
 */
export function usePendingEdits() {
  const { data, refreshData, loading, error } = useMusicLibrary();
  
  const applyEdit = useCallback(async (editId: number) => {
    try {
      const { onApplyPendingEdit } = await import('../components/MP3Library.telefunc');
      const result = await onApplyPendingEdit(editId);
      
      if (result.success) {
        await refreshData('pendingEdits');
        await refreshData('files'); // Files may have changed
      } else {
        throw new Error(result.error || 'Failed to apply edit');
      }
    } catch (error) {
      throw new Error(`Apply edit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [refreshData]);

  const rejectEdit = useCallback(async (editId: number) => {
    try {
      const { onRejectPendingEdit } = await import('../components/MP3Library.telefunc');
      const result = await onRejectPendingEdit(editId);
      
      if (result.success) {
        await refreshData('pendingEdits');
      } else {
        throw new Error(result.error || 'Failed to reject edit');
      }
    } catch (error) {
      throw new Error(`Reject edit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [refreshData]);

  return {
    pendingEdits: data.pendingEdits,
    loading,
    error,
    applyEdit,
    rejectEdit,
    refreshEdits: () => refreshData('pendingEdits')
  };
}