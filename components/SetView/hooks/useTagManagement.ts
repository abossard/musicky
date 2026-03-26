import { useReducer, useEffect, useCallback } from 'react';
import {
  onGetSongTags, onAddSongTag, onRemoveSongTag,
} from '../../Moodboard/MoodboardPage.telefunc';
import type { SongCardData } from '../SongCard';
import {
  tagOpReducer, initialTagState, getDisplayTags, isTagPending,
  type TagOpState,
} from './useTagReducer';

export interface UseTagManagementParams {
  selectedSong: string | null;
  selectedSongs: ReadonlySet<string>;
  songs: SongCardData[];
  setSongs: React.Dispatch<React.SetStateAction<SongCardData[]>>;
}

export interface UseTagManagementReturn {
  selectedSongTags: { label: string; category: string }[];
  tagPending: boolean;
  tagState: TagOpState;
  handleToggleTag: (label: string, category: string) => Promise<void>;
  handleBulkToggleTag: (label: string, category: string) => Promise<void>;
}

export function useTagManagement({
  selectedSong,
  selectedSongs,
  songs,
  setSongs,
}: UseTagManagementParams): UseTagManagementReturn {
  const [tagState, dispatchTag] = useReducer(tagOpReducer, initialTagState);

  useEffect(() => {
    if (!selectedSong) { dispatchTag({ type: 'CLEAR' }); return; }
    dispatchTag({ type: 'LOAD_SONG', songPath: selectedSong });
    onGetSongTags(selectedSong).then(tags =>
      dispatchTag({ type: 'TAGS_LOADED', tags: tags.map((t: any) => ({ label: t.label, category: t.category })) })
    );
  }, [selectedSong]);

  const handleToggleTag = useCallback(async (label: string, category: string) => {
    if (!selectedSong || tagState.status === 'pending') return;
    const isActive = tagState.tags.some(t => t.label === label && t.category === category);

    dispatchTag({ type: 'TOGGLE_START', label, category });

    try {
      if (isActive) {
        await onRemoveSongTag(selectedSong, label, category);
      } else {
        await onAddSongTag(selectedSong, label, category);
      }

      const tags = await onGetSongTags(selectedSong);
      const mapped = tags.map((t: any) => ({ label: t.label, category: t.category }));
      dispatchTag({ type: 'TOGGLE_SUCCESS', tags: mapped });

      setSongs(prev => prev.map(s => {
        if (s.filePath !== selectedSong) return s;
        const newGenres = tags.filter((t: any) => t.category === 'genre').map((t: any) => t.label);
        const newMoods = tags.filter((t: any) => t.category === 'mood').map((t: any) => t.label);
        const newPhase = tags.find((t: any) => t.category === 'phase')?.label;
        return { ...s, genres: newGenres, moods: newMoods, phase: newPhase };
      }));
    } catch (e) {
      dispatchTag({ type: 'TOGGLE_FAILURE', error: String(e) });
    }
  }, [selectedSong, tagState, setSongs]);

  const handleBulkToggleTag = useCallback(async (label: string, category: string) => {
    if (selectedSongs.size === 0) return;

    const allHaveTag = [...selectedSongs].every(fp => {
      const song = songs.find(s => s.filePath === fp);
      if (!song) return false;
      if (category === 'genre') return song.genres.includes(label);
      if (category === 'mood') return song.moods.includes(label);
      return false;
    });

    const promises = [...selectedSongs].map(fp => {
      if (allHaveTag) {
        return onRemoveSongTag(fp, label, category);
      }
      const song = songs.find(s => s.filePath === fp);
      const hasTag = song && (
        (category === 'genre' && song.genres.includes(label)) ||
        (category === 'mood' && song.moods.includes(label))
      );
      if (!hasTag) {
        return onAddSongTag(fp, label, category);
      }
      return Promise.resolve();
    });

    const results = await Promise.allSettled(promises);
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`Bulk tag: ${failed.length}/${results.length} operations failed`);
    }

    setSongs(prev => prev.map(s => {
      if (!selectedSongs.has(s.filePath)) return s;
      if (category === 'genre') {
        const newGenres = allHaveTag
          ? s.genres.filter(g => g !== label)
          : s.genres.includes(label) ? s.genres : [...s.genres, label];
        return { ...s, genres: newGenres };
      }
      if (category === 'mood') {
        const newMoods = allHaveTag
          ? s.moods.filter(m => m !== label)
          : s.moods.includes(label) ? s.moods : [...s.moods, label];
        return { ...s, moods: newMoods };
      }
      return s;
    }));

    if (selectedSong && selectedSongs.has(selectedSong)) {
      const tags = await onGetSongTags(selectedSong);
      dispatchTag({ type: 'TAGS_LOADED', tags: tags.map((t: any) => ({ label: t.label, category: t.category })) });
    }
  }, [selectedSongs, songs, selectedSong, setSongs]);

  return {
    selectedSongTags: getDisplayTags(tagState),
    tagPending: isTagPending(tagState),
    tagState,
    handleToggleTag,
    handleBulkToggleTag,
  };
}
