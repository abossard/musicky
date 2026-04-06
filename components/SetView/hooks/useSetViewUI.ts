import { useReducer, useCallback } from 'react';

// ─── Drawer State Machine ───────────────────────────────────────────────────
// Only one drawer open at a time — enforced by discriminated union

type DrawerState =
  | { drawer: 'none' }
  | { drawer: 'detail'; songPath: string }
  | { drawer: 'settings' }
  | { drawer: 'review' }
  | { drawer: 'help' };

type DrawerEvent =
  | { type: 'OPEN_DETAIL'; songPath: string }
  | { type: 'OPEN_SETTINGS' }
  | { type: 'OPEN_REVIEW' }
  | { type: 'OPEN_HELP' }
  | { type: 'CLOSE_DRAWER' };

function drawerReducer(_state: DrawerState, event: DrawerEvent): DrawerState {
  switch (event.type) {
    case 'OPEN_DETAIL': return { drawer: 'detail', songPath: event.songPath };
    case 'OPEN_SETTINGS': return { drawer: 'settings' };
    case 'OPEN_REVIEW': return { drawer: 'review' };
    case 'OPEN_HELP': return { drawer: 'help' };
    case 'CLOSE_DRAWER': return { drawer: 'none' };
  }
}

// ─── Phase Input State Machine ──────────────────────────────────────────────

type PhaseInputState =
  | { mode: 'idle' }
  | { mode: 'editing'; input: string };

type PhaseInputEvent =
  | { type: 'START_ADDING' }
  | { type: 'UPDATE_INPUT'; input: string }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM' };

function phaseInputReducer(state: PhaseInputState, event: PhaseInputEvent): PhaseInputState {
  switch (event.type) {
    case 'START_ADDING': return { mode: 'editing', input: '' };
    case 'UPDATE_INPUT':
      if (state.mode !== 'editing') return state;
      return { mode: 'editing', input: event.input };
    case 'CANCEL': return { mode: 'idle' };
    case 'CONFIRM': return { mode: 'idle' };
  }
}

// ─── Combined Hook ──────────────────────────────────────────────────────────

export function useSetViewUI() {
  const [drawerState, dispatchDrawer] = useReducer(drawerReducer, { drawer: 'none' });
  const [phaseInput, dispatchPhase] = useReducer(phaseInputReducer, { mode: 'idle' });
  const [libraryOpen, setLibraryOpen] = useReducer((_: boolean, v: boolean | 'toggle') => v === 'toggle' ? !_ : v, false);

  return {
    // Drawer state (read-only)
    drawerState,
    detailOpen: drawerState.drawer === 'detail',
    detailSongPath: drawerState.drawer === 'detail' ? drawerState.songPath : null,
    settingsOpen: drawerState.drawer === 'settings',
    reviewOpen: drawerState.drawer === 'review',
    helpOpen: drawerState.drawer === 'help',

    // Drawer actions
    openDetail: useCallback((songPath: string) => dispatchDrawer({ type: 'OPEN_DETAIL', songPath }), []),
    openSettings: useCallback(() => dispatchDrawer({ type: 'OPEN_SETTINGS' }), []),
    openReview: useCallback(() => dispatchDrawer({ type: 'OPEN_REVIEW' }), []),
    openHelp: useCallback(() => dispatchDrawer({ type: 'OPEN_HELP' }), []),
    closeDrawer: useCallback(() => dispatchDrawer({ type: 'CLOSE_DRAWER' }), []),

    // Library panel (independent — can be open alongside drawers)
    libraryOpen,
    toggleLibrary: useCallback(() => setLibraryOpen('toggle'), []),

    // Phase input state (read-only)
    phaseInput,
    addingPhase: phaseInput.mode === 'editing',
    newPhaseName: phaseInput.mode === 'editing' ? phaseInput.input : '',

    // Phase input actions
    startAddingPhase: useCallback(() => dispatchPhase({ type: 'START_ADDING' }), []),
    updatePhaseInput: useCallback((input: string) => dispatchPhase({ type: 'UPDATE_INPUT', input }), []),
    cancelAddingPhase: useCallback(() => dispatchPhase({ type: 'CANCEL' }), []),
    confirmAddingPhase: useCallback(() => dispatchPhase({ type: 'CONFIRM' }), []),
  };
}
