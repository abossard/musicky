import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  onGetLibrarySongs, onGetSongTags, onGetAllTags,
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
}

export function useSetViewState(): UseSetViewStateReturn {
  const [songs, setSongs] = useState<SongCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allGenres, setAllGenres] = useState<{ label: string; count: number }[]>([]);
  const [allMoods, setAllMoods] = useState<{ label: string; count: number }[]>([]);

  const loadSongs = useCallback(async () => {
    setLoading(true);
    try {
      const libSongs = await onGetLibrarySongs();
      const allSongData: SongCardData[] = await Promise.all(
        libSongs.map(async (s: any) => {
          const tags = await onGetSongTags(s.filePath);
          return {
            filePath: s.filePath,
            title: s.title || s.filename || 'Unknown',
            artist: s.artist || 'Unknown',
            artworkUrl: `/artwork/${encodeURIComponent(s.filePath)}`,
            camelotKey: s.camelotKey || (s.key ? standardToCamelot(s.key) : undefined) || undefined,
            bpm: s.bpm,
            energyLevel: s.energyLevel,
            genres: tags.filter((t: any) => t.category === 'genre').map((t: any) => t.label),
            moods: tags.filter((t: any) => t.category === 'mood').map((t: any) => t.label),
            phase: tags.find((t: any) => t.category === 'phase')?.label,
          };
        })
      );
      setSongs(allSongData);
    } catch (e) {
      console.error('Failed to load songs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSongs(); }, [loadSongs]);

  useEffect(() => {
    onGetAllTags('genre').then(tags => setAllGenres(tags.map((t: any) => ({ label: t.label, count: t.count }))));
    onGetAllTags('mood').then(tags => setAllMoods(tags.map((t: any) => ({ label: t.label, count: t.count }))));
  }, []);

  const { phaseColumns, phases } = useMemo(() => {
    const phaseSet = new Set<string>();
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

    const phases = [...phaseSet].sort();
    return {
      phases,
      phaseColumns: { byPhase, unassigned },
    };
  }, [songs]);

  return { songs, setSongs, loading, allGenres, allMoods, phases, phaseColumns, loadSongs };
}
