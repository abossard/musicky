import { useState, useReducer, useEffect, useMemo, useRef } from 'react';
import type { SongCardData } from '../SongCard';
import type { AudioQueueState, AudioQueueActions } from '../../../hooks/useAudioQueue';
import type { PhaseColumns } from './useSetViewState';
import {
  navigationReducer,
  getSelectedSongs,
  isLocked as isLockedFn,
  type NavigationState,
  type NavigationAction,
} from './useNavigationReducer';

export interface UseKeyboardNavigationParams {
  phases: string[];
  phaseColumns: PhaseColumns;
  handleDrop: (filePath: string, targetPhase: string) => Promise<void>;
  handlePlay: (filePath: string) => void;
  /** Ref to break circular dependency — updated by parent after useTagManagement */
  handleBulkToggleTagRef: React.MutableRefObject<((label: string, category: string) => Promise<void>) | undefined>;
  audioQueue: AudioQueueState & AudioQueueActions;
  allGenres: { label: string; count: number }[];
  allMoods: { label: string; count: number }[];
  onToggleHelp: () => void;
  onToggleLibrary: () => void;
}

export interface UseKeyboardNavigationReturn {
  navState: NavigationState;
  dispatch: React.Dispatch<NavigationAction>;
  selectedSongs: ReadonlySet<string>;
  isLocked: boolean;
  selectedSong: string | null;
  setSelectedSong: React.Dispatch<React.SetStateAction<string | null>>;
  columnData: { phase: string; songs: SongCardData[] }[];
  focusedSong: string | null;
}

export function useKeyboardNavigation(params: UseKeyboardNavigationParams): UseKeyboardNavigationReturn {
  const [navState, dispatch] = useReducer(navigationReducer, { mode: 'idle' } as NavigationState);
  const [selectedSong, setSelectedSong] = useState<string | null>(null);

  const currentColumn = navState.mode === 'idle' ? 0 : navState.column;
  const currentIndex = navState.mode === 'idle' ? 0 : navState.index;
  const locked = isLockedFn(navState);
  const selectedSongs = getSelectedSongs(navState);

  // Ref for all params so the effect always reads latest values
  // without needing external callbacks in the dependency array
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const columnData = useMemo(() => {
    const cols = params.phases.map(phase => ({
      phase,
      songs: params.phaseColumns.byPhase.get(phase) || [],
    }));
    cols.push({ phase: '__unassigned__', songs: params.phaseColumns.unassigned });
    return cols;
  }, [params.phases, params.phaseColumns]);

  const focusedSong = useMemo(() => {
    const col = columnData[currentColumn];
    return col?.songs[currentIndex]?.filePath ?? null;
  }, [columnData, currentColumn, currentIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const p = paramsRef.current;

      // Alt+Arrow: audio playback controls
      if (e.altKey) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            p.audioQueue.setVolume(Math.min(1, p.audioQueue.volume + 0.1));
            return;
          case 'ArrowDown':
            e.preventDefault();
            p.audioQueue.setVolume(Math.max(0, p.audioQueue.volume - 0.1));
            return;
          case 'ArrowLeft': {
            e.preventDefault();
            const audio = document.querySelector('audio');
            if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5);
            return;
          }
          case 'ArrowRight': {
            e.preventDefault();
            const audio = document.querySelector('audio');
            if (audio) audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
            return;
          }
        }
      }

      // Number keys 1-9: toggle genre (plain) or mood (shift)
      const digitMatch = e.code?.match(/^Digit([1-9])$/);
      if (digitMatch && selectedSongs.size > 0) {
        e.preventDefault();
        const idx = parseInt(digitMatch[1]) - 1;
        if (e.shiftKey) {
          if (idx < p.allMoods.length) {
            p.handleBulkToggleTagRef.current?.(p.allMoods[idx].label, 'mood');
          }
        } else {
          if (idx < p.allGenres.length) {
            p.handleBulkToggleTagRef.current?.(p.allGenres[idx].label, 'genre');
          }
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (locked) return;
          const col = columnData[currentColumn];
          if (!col) return;
          const newIdx = Math.min(currentIndex + 1, col.songs.length - 1);
          const fp = col.songs[newIdx]?.filePath;
          if (e.shiftKey) {
            if (fp) dispatch({ type: 'EXTEND_SELECT', filePath: fp, column: currentColumn, index: newIdx });
          } else {
            if (fp) {
              dispatch({ type: 'SELECT', filePath: fp, column: currentColumn, index: newIdx });
              setSelectedSong(fp);
            } else {
              dispatch({ type: 'CLEAR' });
              setSelectedSong(null);
            }
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (locked) return;
          const col = columnData[currentColumn];
          if (!col) return;
          const newIdx = Math.max(currentIndex - 1, 0);
          const fp = col.songs[newIdx]?.filePath;
          if (e.shiftKey) {
            if (fp) dispatch({ type: 'EXTEND_SELECT', filePath: fp, column: currentColumn, index: newIdx });
          } else {
            if (fp) {
              dispatch({ type: 'SELECT', filePath: fp, column: currentColumn, index: newIdx });
              setSelectedSong(fp);
            } else {
              dispatch({ type: 'CLEAR' });
              setSelectedSong(null);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (locked && selectedSongs.size > 0) {
            const newCol = Math.max(currentColumn - 1, 0);
            if (newCol !== currentColumn) {
              const targetPhase = columnData[newCol].phase;
              for (const fp of selectedSongs) {
                p.handleDrop(fp, targetPhase);
              }
              dispatch({ type: 'UPDATE_POSITION', column: newCol, index: 0 });
            }
            return;
          }
          if (locked) return;
          const newCol = Math.max(currentColumn - 1, 0);
          const col = columnData[newCol];
          const fp = col?.songs[0]?.filePath;
          if (fp) {
            dispatch({ type: 'SELECT', filePath: fp, column: newCol, index: 0 });
          } else {
            dispatch({ type: 'FOCUS', column: newCol, index: 0 });
          }
          setSelectedSong(fp || null);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (locked && selectedSongs.size > 0) {
            const newCol = Math.min(currentColumn + 1, columnData.length - 1);
            if (newCol !== currentColumn) {
              const targetPhase = columnData[newCol].phase;
              for (const fp of selectedSongs) {
                p.handleDrop(fp, targetPhase);
              }
              dispatch({ type: 'UPDATE_POSITION', column: newCol, index: 0 });
            }
            return;
          }
          if (locked) return;
          const newCol = Math.min(currentColumn + 1, columnData.length - 1);
          const col = columnData[newCol];
          const fp = col?.songs[0]?.filePath;
          if (fp) {
            dispatch({ type: 'SELECT', filePath: fp, column: newCol, index: 0 });
          } else {
            dispatch({ type: 'FOCUS', column: newCol, index: 0 });
          }
          setSelectedSong(fp || null);
          break;
        }
        case ' ': {
          e.preventDefault();
          if (p.audioQueue.currentTrack) {
            p.audioQueue.togglePlayPause();
          } else if (focusedSong) {
            p.handlePlay(focusedSong);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          dispatch({ type: 'CLEAR' });
          setSelectedSong(null);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (locked) {
            dispatch({ type: 'UNLOCK' });
          } else {
            dispatch({ type: 'LOCK' });
          }
          break;
        }
        case '?': {
          e.preventDefault();
          p.onToggleHelp();
          break;
        }
        case 'l':
        case 'L': {
          e.preventDefault();
          p.onToggleLibrary();
          break;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [navState, columnData, focusedSong, selectedSongs, locked, currentColumn, currentIndex]);

  return {
    navState, dispatch, selectedSongs, isLocked: locked,
    selectedSong, setSelectedSong, columnData, focusedSong,
  };
}
