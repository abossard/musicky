import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  onGetLibrarySongsWithTags, onGetAllTags,
} from '../../Moodboard/MoodboardPage.telefunc';
import { standardToCamelot } from '../../../lib/camelot';
import type { SongCardData } from '../SongCard';

export interface PhaseColumns {
  byPhase: Map<string, SongCardData[]>;
  unassigned: SongCardData[];
}

export interface UseSetViewStateReturn {
  songs: SongCardData[];
  setSongs: React.Dispatch<React.SetStateAction<SongCardData[]>>;
  loading: boolean;
  allGenres: { label: string; count: number }[];
  allMoods: { label: string; count: number }[];
  phases: string[];
  phaseColumns: PhaseColumns;
  loadSongs: () => Promise<void>;
  addExplicitPhase: (name: string) => void;
}

export function useSetViewState(): UseSetViewStateReturn {
  const [songs, setSongs] = useState<SongCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allGenres, setAllGenres] = useState<{ label: string; count: number }[]>([]);
  const [allMoods, setAllMoods] = useState<{ label: string; count: number }[]>([]);
  const [explicitPhases, setExplicitPhases] = useState<string[]>([]);

  const addExplicitPhase = useCallback((name: string) => {
    setExplicitPhases(prev => prev.includes(name) ? prev : [...prev, name]);
  }, []);

  const loadSongs = useCallback(async () => {
    setLoading(true);
    try {
      // Single batch call: songs + tags in 2 SQL queries (not N+1)
      const [songsWithTags, genres, moods] = await Promise.all([
        onGetLibrarySongsWithTags(),
        onGetAllTags('genre').then(tags => tags.map((t: any) => ({ label: t.label, count: t.count }))),
        onGetAllTags('mood').then(tags => tags.map((t: any) => ({ label: t.label, count: t.count }))),
      ]);

      const allSongData: SongCardData[] = songsWithTags.map(s => ({
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

      setSongs(allSongData);
      setAllGenres(genres);
      setAllMoods(moods);
    } catch (e) {
      console.error('Failed to load songs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSongs(); }, [loadSongs]);

  const { phaseColumns, phases } = useMemo(() => {
    const phaseSet = new Set<string>();
    const byPhase = new Map<string, SongCardData[]>();
    const unassigned: SongCardData[] = [];

    for (const ep of explicitPhases) {
      phaseSet.add(ep);
    }

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

    const phases = [...phaseSet].sort();
    return {
      phases,
      phaseColumns: { byPhase, unassigned },
    };
  }, [songs, explicitPhases]);

  return { songs, setSongs, loading, allGenres, allMoods, phases, phaseColumns, loadSongs, addExplicitPhase };
}
