import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onGetDJSets, onGetDJSet } from '../components/DJSets.telefunc';
import { onBulkAddSongsToSet } from '../components/DJSetItems.telefunc';
import type { DJSet } from '../database/sqlite/queries/dj-sets';

interface DJSetContextType {
  // DJ Set Mode
  isDJSetMode: boolean;
  setDJSetMode: (enabled: boolean) => void;
  
  // Current active set
  activeSet: DJSet | null;
  setActiveSet: (set: DJSet | null) => void;
  
  // Available sets
  availableSets: DJSet[];
  refreshSets: () => void;
  
  // Selection state
  selectedFiles: string[];
  setSelectedFiles: (files: string[]) => void;
  toggleFileSelection: (filePath: string) => void;
  clearSelection: () => void;
  
  // Actions
  addSelectedToSet: (insertAfterPosition?: number) => Promise<void>;
  
  // Loading state
  loading: boolean;
}

const DJSetContext = createContext<DJSetContextType | undefined>(undefined);

export function useDJSetContext() {
  const context = useContext(DJSetContext);
  if (!context) {
    throw new Error('useDJSetContext must be used within a DJSetProvider');
  }
  return context;
}

interface DJSetProviderProps {
  children: ReactNode;
}

export function DJSetProvider({ children }: DJSetProviderProps) {
  const [isDJSetMode, setDJSetMode] = useState(false);
  const [activeSet, setActiveSet] = useState<DJSet | null>(null);
  const [availableSets, setAvailableSets] = useState<DJSet[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load available sets on mount
  useEffect(() => {
    refreshSets();
  }, []);

  // Clear selection when DJ Set mode is disabled
  useEffect(() => {
    if (!isDJSetMode) {
      setSelectedFiles([]);
    }
  }, [isDJSetMode]);

  const refreshSets = async () => {
    try {
      const sets = await onGetDJSets();
      setAvailableSets(sets);
    } catch (error) {
      console.error('Error loading DJ sets:', error);
    }
  };

  const toggleFileSelection = (filePath: string) => {
    setSelectedFiles(prev => 
      prev.includes(filePath) 
        ? prev.filter(f => f !== filePath)
        : [...prev, filePath]
    );
  };

  const clearSelection = () => {
    setSelectedFiles([]);
  };

  const addSelectedToSet = async (insertAfterPosition: number = -1) => {
    if (!activeSet || selectedFiles.length === 0) {
      return;
    }

    try {
      setLoading(true);
      await onBulkAddSongsToSet(activeSet.id, selectedFiles, insertAfterPosition);
      clearSelection();
    } catch (error) {
      console.error('Error adding songs to set:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSetActiveSet = async (set: DJSet | null) => {
    setActiveSet(set);
    clearSelection();
  };

  const value: DJSetContextType = {
    isDJSetMode,
    setDJSetMode,
    activeSet,
    setActiveSet: handleSetActiveSet,
    availableSets,
    refreshSets,
    selectedFiles,
    setSelectedFiles,
    toggleFileSelection,
    clearSelection,
    addSelectedToSet,
    loading
  };

  return (
    <DJSetContext.Provider value={value}>
      {children}
    </DJSetContext.Provider>
  );
}