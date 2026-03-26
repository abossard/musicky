// Typed finite state machine for SetView keyboard navigation.
// Discriminated unions make impossible states (e.g. locked with empty selection) unrepresentable.

// States — each mode carries exactly the data it needs
export type NavigationState =
  | { mode: 'idle' }
  | { mode: 'focused'; column: number; index: number }
  | { mode: 'selected'; column: number; index: number; songs: ReadonlySet<string> }
  | { mode: 'locked'; column: number; index: number; songs: ReadonlySet<string> };

// Actions
export type NavigationAction =
  | { type: 'FOCUS'; column: number; index: number }
  | { type: 'SELECT'; filePath: string; column: number; index: number }
  | { type: 'EXTEND_SELECT'; filePath: string; column: number; index: number }
  | { type: 'LOCK' }
  | { type: 'UNLOCK' }
  | { type: 'CLEAR' }
  | { type: 'UPDATE_POSITION'; column: number; index: number };

export function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'FOCUS':
      if (state.mode === 'locked') return state;
      return { mode: 'focused', column: action.column, index: action.index };

    case 'SELECT':
      if (state.mode === 'locked') return state;
      return {
        mode: 'selected',
        column: action.column,
        index: action.index,
        songs: new Set([action.filePath]),
      };

    case 'EXTEND_SELECT': {
      if (state.mode === 'locked') return state;
      const existing = state.mode === 'selected' ? state.songs : new Set<string>();
      return {
        mode: 'selected',
        column: action.column,
        index: action.index,
        songs: new Set([...existing, action.filePath]),
      };
    }

    case 'LOCK':
      if (state.mode !== 'selected' || state.songs.size === 0) return state;
      return { mode: 'locked', column: state.column, index: state.index, songs: state.songs };

    case 'UNLOCK':
      if (state.mode !== 'locked') return state;
      return { mode: 'selected', column: state.column, index: state.index, songs: state.songs };

    case 'CLEAR':
      return { mode: 'idle' };

    case 'UPDATE_POSITION':
      if (state.mode === 'idle') return state;
      return { ...state, column: action.column, index: action.index };

    default:
      return state;
  }
}

// Helper selectors
export function getSelectedSongs(state: NavigationState): ReadonlySet<string> {
  return state.mode === 'selected' || state.mode === 'locked' ? state.songs : new Set();
}

export function isLocked(state: NavigationState): boolean {
  return state.mode === 'locked';
}

export function getFocusedPosition(state: NavigationState): { column: number; index: number } | null {
  return state.mode === 'idle' ? null : { column: state.column, index: state.index };
}
