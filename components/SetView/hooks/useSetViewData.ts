import { useReducer, useEffect, useCallback, useMemo } from 'react';
import {
  onGetLibrarySongsWithTags, onGetAllTags,
} from '../../Moodboard/MoodboardPage.telefunc';
import { standardToCamelot } from '../../../lib/camelot';
import type { SongCardData } from '../SongCard';

// ─── State Machine ──────────────────────────────────────────────────────────

type TagCount = { label: string; count: number };

type SetViewDataState =
  | { status: 'idle'; songs: SongCardData[]; genres: TagCount[]; moods: TagCount[]; explicitPhases: string[] }
  | { status: 'loading'; songs: SongCardData[]; genres: TagCount[]; moods: TagCount[]; explicitPhases: string[] }
  | { status: 'ready'; songs: SongCardData[]; genres: TagCount[]; moods: TagCount[]; explicitPhases: string[] }
  | { status: 'error'; songs: SongCardData[]; genres: TagCount[]; moods: TagCount[]; explicitPhases: string[]; error: string };

type SetViewDataEvent =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; songs: SongCardData[]; genres: TagCount[]; moods: TagCount[] }
  | { type: 'LOAD_ERROR'; error: string }
  | { type: 'UPDATE_SONG_PHASE'; filePath: string; phase: string | undefined }
  | { type: 'UPDATE_SONG_TAGS'; filePath: string; updater: (song: SongCardData) => SongCardData }
  | { type: 'ADD_EXPLICIT_PHASE'; name: string };

const initialState: SetViewDataState = {
  status: 'idle',
  songs: [],
  genres: [],
  moods: [],
  explicitPhases: [],
};

function setViewDataReducer(state: SetViewDataState, event: SetViewDataEvent): SetViewDataState {
  switch (event.type) {
    case 'LOAD_START':
      return { ...state, status: 'loading' };

    case 'LOAD_SUCCESS':
      return {
        ...state,
        status: 'ready',
        songs: event.songs,
        genres: event.genres,
        moods: event.moods,
      };

    case 'LOAD_ERROR':
      return { ...state, status: 'error', error: event.error };

    case 'UPDATE_SONG_PHASE':
      return {
        ...state,
        songs: state.songs.map(s =>
          s.filePath === event.filePath ? { ...s, phase: event.phase } : s
        ),
      };

    case 'UPDATE_SONG_TAGS':
      return {
        ...state,
        songs: state.songs.map(s =>
          s.filePath === event.filePath ? event.updater(s) : s
        ),
      };

    case 'ADD_EXPLICIT_PHASE':
      if (state.explicitPhases.includes(event.name)) return state;
      return { ...state, explicitPhases: [...state.explicitPhases, event.name] };

    default:
      return state;
  }
}

// ─── Calculations (pure, derived from state) ─────────────────────────────────

export interface PhaseColumns {
  byPhase: Map<string, SongCardData[]>;
  unassigned: SongCardData[];
}

function computePhaseColumns(songs: SongCardData[], explicitPhases: string[]): { phases: string[]; phaseColumns: PhaseColumns } {
  const phaseSet = new Set<string>(explicitPhases);
  const byPhase = new Map<string, SongCardData[]>();
  const unassigned: SongCardData[] = [];

  for (const song of songs) {
    if (song.phase) {
      phaseSet.add(song.phase);
      const arr = byPhase.get(song.phase) || [];
      arr.push(song);
      byPhase.set(song.phase, arr);
    } else {
      unassigned.push(song);
    }
  }

  return {
    phases: [...phaseSet].sort(),
    phaseColumns: { byPhase, unassigned },
  };
}

// ─── Hook (actions: side effects that dispatch events) ───────────────────────

export function useSetViewData() {
  const [state, dispatch] = useReducer(setViewDataReducer, initialState);

  const loadSongs = useCallback(async () => {
    dispatch({ type: 'LOAD_START' });
    try {
      const [songsWithTags, genres, moods] = await Promise.all([
        onGetLibrarySongsWithTags(),
        onGetAllTags('genre').then(tags => tags.map((t: { label: string; count: number }) => ({ label: t.label, count: t.count }))),
        onGetAllTags('mood').then(tags => tags.map((t: { label: string; count: number }) => ({ label: t.label, count: t.count }))),
      ]);

      const songs: SongCardData[] = songsWithTags.map(s => ({
        filePath: s.filePath,
        title: s.title || 'Unknown',
        artist: s.artist || 'Unknown',
        artworkUrl: `/artwork/${encodeURIComponent(s.filePath)}`,
        camelotKey: s.camelotKey || (s.key ? standardToCamelot(s.key) : undefined) || undefined,
        bpm: s.bpm,
        energyLevel: s.energyLevel,
        genres: s.tags.filter(t => t.category === 'genre').map(t => t.label),
        moods: s.tags.filter(t => t.category === 'mood').map(t => t.label),
        phase: s.tags.find(t => t.category === 'phase')?.label,
      }));

      dispatch({ type: 'LOAD_SUCCESS', songs, genres, moods });
    } catch (e) {
      dispatch({ type: 'LOAD_ERROR', error: e instanceof Error ? e.message : 'Failed to load songs' });
    }
  }, []);

  // Load on mount
  useEffect(() => { loadSongs(); }, [loadSongs]);

  // Pure calculations derived from state
  const { phases, phaseColumns } = useMemo(
    () => computePhaseColumns(state.songs, state.explicitPhases),
    [state.songs, state.explicitPhases]
  );

  // Typed actions — the only way to change state
  const updateSongPhase = useCallback((filePath: string, phase: string | undefined) => {
    dispatch({ type: 'UPDATE_SONG_PHASE', filePath, phase });
  }, []);

  const updateSongTags = useCallback((filePath: string, updater: (song: SongCardData) => SongCardData) => {
    dispatch({ type: 'UPDATE_SONG_TAGS', filePath, updater });
  }, []);

  const addExplicitPhase = useCallback((name: string) => {
    dispatch({ type: 'ADD_EXPLICIT_PHASE', name });
  }, []);

  return {
    // State (read-only)
    status: state.status,
    songs: state.songs,
    genres: state.genres,
    moods: state.moods,
    loading: state.status === 'loading' || state.status === 'idle',
    error: state.status === 'error' ? state.error : null,

    // Calculations (derived)
    phases,
    phaseColumns,

    // Actions (typed events — no raw setters)
    loadSongs,
    updateSongPhase,
    updateSongTags,
    addExplicitPhase,
  };
}
