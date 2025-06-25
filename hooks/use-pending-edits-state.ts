import { useReducer, useCallback } from 'react';
import type { PendingEdit } from '../lib/mp3-metadata';

// State interface
interface PendingEditsState {
  pendingEdits: PendingEdit[];
  selectedEdits: number[];
  editingId: number | null;
  editingComment: string;
  lastError: { timestamp: Date; error: string; filePath?: string } | null;
  testResults: Array<{ name: string; success: boolean; error?: string; details?: any }>;
  flags: {
    loading: boolean;
    applying: boolean;
    testing: boolean;
  };
}

// Action types
type PendingEditsAction =
  | { type: 'SET_PENDING_EDITS'; payload: PendingEdit[] }
  | { type: 'SET_SELECTED_EDITS'; payload: number[] }
  | { type: 'TOGGLE_EDIT_SELECTION'; payload: number }
  | { type: 'SELECT_ALL_EDITS' }
  | { type: 'SELECT_NO_EDITS' }
  | { type: 'REMOVE_FROM_SELECTION'; payload: number }
  | { type: 'START_EDITING'; payload: { id: number; comment: string } }
  | { type: 'UPDATE_EDITING_COMMENT'; payload: string }
  | { type: 'STOP_EDITING' }
  | { type: 'SET_LAST_ERROR'; payload: { timestamp: Date; error: string; filePath?: string } | null }
  | { type: 'SET_TEST_RESULTS'; payload: Array<{ name: string; success: boolean; error?: string; details?: any }> }
  | { type: 'CLEAR_TEST_RESULTS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_APPLYING'; payload: boolean }
  | { type: 'SET_TESTING'; payload: boolean };

// Initial state
const initialState: PendingEditsState = {
  pendingEdits: [],
  selectedEdits: [],
  editingId: null,
  editingComment: '',
  lastError: null,
  testResults: [],
  flags: {
    loading: true,
    applying: false,
    testing: false,
  },
};

// Pure reducer function
function pendingEditsReducer(state: PendingEditsState, action: PendingEditsAction): PendingEditsState {
  switch (action.type) {
    case 'SET_PENDING_EDITS':
      return { ...state, pendingEdits: action.payload };
    
    case 'SET_SELECTED_EDITS':
      return { ...state, selectedEdits: action.payload };
    
    case 'TOGGLE_EDIT_SELECTION':
      const isSelected = state.selectedEdits.includes(action.payload);
      return {
        ...state,
        selectedEdits: isSelected
          ? state.selectedEdits.filter(id => id !== action.payload)
          : [...state.selectedEdits, action.payload]
      };
    
    case 'SELECT_ALL_EDITS':
      return { ...state, selectedEdits: state.pendingEdits.map(edit => edit.id) };
    
    case 'SELECT_NO_EDITS':
      return { ...state, selectedEdits: [] };
    
    case 'REMOVE_FROM_SELECTION':
      return {
        ...state,
        selectedEdits: state.selectedEdits.filter(id => id !== action.payload)
      };
    
    case 'START_EDITING':
      return {
        ...state,
        editingId: action.payload.id,
        editingComment: action.payload.comment
      };
    
    case 'UPDATE_EDITING_COMMENT':
      return { ...state, editingComment: action.payload };
    
    case 'STOP_EDITING':
      return { ...state, editingId: null, editingComment: '' };
    
    case 'SET_LAST_ERROR':
      return { ...state, lastError: action.payload };
    
    case 'SET_TEST_RESULTS':
      return { ...state, testResults: action.payload };
    
    case 'CLEAR_TEST_RESULTS':
      return { ...state, testResults: [] };
    
    case 'SET_LOADING':
      return { ...state, flags: { ...state.flags, loading: action.payload } };
    
    case 'SET_APPLYING':
      return { ...state, flags: { ...state.flags, applying: action.payload } };
    
    case 'SET_TESTING':
      return { ...state, flags: { ...state.flags, testing: action.payload } };
    
    default:
      return state;
  }
}

// Custom hook with functional state management
export function usePendingEditsState() {
  const [state, dispatch] = useReducer(pendingEditsReducer, initialState);

  // Action creators (pure functions)
  const actions = {
    setPendingEdits: useCallback((edits: PendingEdit[]) => 
      dispatch({ type: 'SET_PENDING_EDITS', payload: edits }), []),
    
    setSelectedEdits: useCallback((ids: number[]) => 
      dispatch({ type: 'SET_SELECTED_EDITS', payload: ids }), []),
    
    toggleEditSelection: useCallback((id: number) => 
      dispatch({ type: 'TOGGLE_EDIT_SELECTION', payload: id }), []),
    
    selectAllEdits: useCallback(() => 
      dispatch({ type: 'SELECT_ALL_EDITS' }), []),
    
    selectNoEdits: useCallback(() => 
      dispatch({ type: 'SELECT_NO_EDITS' }), []),
    
    removeFromSelection: useCallback((id: number) => 
      dispatch({ type: 'REMOVE_FROM_SELECTION', payload: id }), []),
    
    startEditing: useCallback((id: number, comment: string) => 
      dispatch({ type: 'START_EDITING', payload: { id, comment } }), []),
    
    updateEditingComment: useCallback((comment: string) => 
      dispatch({ type: 'UPDATE_EDITING_COMMENT', payload: comment }), []),
    
    stopEditing: useCallback(() => 
      dispatch({ type: 'STOP_EDITING' }), []),
    
    setLastError: useCallback((error: { timestamp: Date; error: string; filePath?: string } | null) => 
      dispatch({ type: 'SET_LAST_ERROR', payload: error }), []),
    
    setTestResults: useCallback((results: Array<{ name: string; success: boolean; error?: string; details?: any }>) => 
      dispatch({ type: 'SET_TEST_RESULTS', payload: results }), []),
    
    clearTestResults: useCallback(() => 
      dispatch({ type: 'CLEAR_TEST_RESULTS' }), []),
    
    setLoading: useCallback((loading: boolean) => 
      dispatch({ type: 'SET_LOADING', payload: loading }), []),
    
    setApplying: useCallback((applying: boolean) => 
      dispatch({ type: 'SET_APPLYING', payload: applying }), []),
    
    setTesting: useCallback((testing: boolean) => 
      dispatch({ type: 'SET_TESTING', payload: testing }), []),
  };

  // Computed values (derived state)
  const computed = {
    allSelected: state.selectedEdits.length === state.pendingEdits.length && state.pendingEdits.length > 0,
    someSelected: state.selectedEdits.length > 0,
    selectedCount: state.selectedEdits.length,
    totalCount: state.pendingEdits.length,
  };

  return { state, actions, computed };
}