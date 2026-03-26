import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Group, Drawer, SegmentedControl, Text, ActionIcon, Tooltip, Badge } from '@mantine/core';
import { IconLayoutSidebar, IconSettings, IconChecklist, IconKeyboard } from '@tabler/icons-react';
import {
  onGetLibrarySongs, onGetSongTags, onGetAllTags,
  onAddSongTag, onRemoveSongTag,
} from '../Moodboard/MoodboardPage.telefunc';
import { PhaseColumn } from './PhaseColumn';
import { ShortcutHelpModal } from './ShortcutHelpModal';
import { TagPaletteSidebar } from './TagPaletteSidebar';
import { SongCard, type SongCardData } from './SongCard';
import { LibraryPanel } from '../Moodboard/LibraryPanel';
import { SongDetailPanel } from '../Moodboard/SongDetailPanel';
import { SettingsDrawer } from '../Moodboard/SettingsDrawer';
import { ReviewPanel } from '../Moodboard/ReviewPanel';
import { AudioPlayerBar } from '../Moodboard/AudioPlayerBar';
import { useAudioQueue } from '../../hooks/useAudioQueue';
import { standardToCamelot } from '../../lib/camelot';

import './SetView.css';

export function SetViewPage() {
  // State
  const [songs, setSongs] = useState<SongCardData[]>([]);
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [selectedSongTags, setSelectedSongTags] = useState<{ label: string; category: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'none' | 'genre' | 'mood'>('none');
  const [allGenres, setAllGenres] = useState<{ label: string; count: number }[]>([]);
  const [allMoods, setAllMoods] = useState<{ label: string; count: number }[]>([]);

  // Keyboard navigation state
  const [focusedColumn, setFocusedColumn] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [isLocked, setIsLocked] = useState(false);

  // Panels
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const audioQueue = useAudioQueue();

  // Load all songs with their tags
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

  // Load tag lists for keyboard shortcuts
  useEffect(() => {
    onGetAllTags('genre').then(tags => setAllGenres(tags.map((t: any) => ({ label: t.label, count: t.count }))));
    onGetAllTags('mood').then(tags => setAllMoods(tags.map((t: any) => ({ label: t.label, count: t.count }))));
  }, []);

  // Load selected song's tags
  useEffect(() => {
    if (!selectedSong) { setSelectedSongTags([]); return; }
    onGetSongTags(selectedSong).then(tags =>
      setSelectedSongTags(tags.map((t: any) => ({ label: t.label, category: t.category })))
    );
  }, [selectedSong]);

  // Group songs by phase
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

  // Flat column→songs lookup for keyboard navigation
  const columnData = useMemo(() => {
    const cols = phases.map(phase => ({
      phase,
      songs: phaseColumns.byPhase.get(phase) || [],
    }));
    cols.push({ phase: '__unassigned__', songs: phaseColumns.unassigned });
    return cols;
  }, [phases, phaseColumns]);

  // Compute focused song filePath for passing to PhaseColumn
  const focusedSong = useMemo(() => {
    const col = columnData[focusedColumn];
    return col?.songs[focusedIndex]?.filePath ?? null;
  }, [columnData, focusedColumn, focusedIndex]);

  const handlePlay = useCallback((filePath: string) => {
    const song = songs.find(s => s.filePath === filePath);
    if (song) {
      audioQueue.playTrack({
        filePath: song.filePath,
        title: song.title,
        artist: song.artist,
      } as any);
    }
  }, [songs, audioQueue]);

  // Drag-drop: reassign phase
  const handleDrop = useCallback(async (filePath: string, targetPhase: string) => {
    const song = songs.find(s => s.filePath === filePath);
    if (!song) return;

    // Remove old phase tag
    if (song.phase) {
      await onRemoveSongTag(filePath, song.phase, 'phase');
    }

    // Add new phase (unless dropping to "unassigned")
    if (targetPhase !== '__unassigned__') {
      await onAddSongTag(filePath, targetPhase, 'phase');
    }

    // Update local state
    setSongs(prev => prev.map(s =>
      s.filePath === filePath
        ? { ...s, phase: targetPhase === '__unassigned__' ? undefined : targetPhase }
        : s
    ));
  }, [songs]);

  // Toggle tag on selected song
  const handleToggleTag = useCallback(async (label: string, category: string) => {
    if (!selectedSong) return;
    const isActive = selectedSongTags.some(t => t.label === label && t.category === category);

    if (isActive) {
      await onRemoveSongTag(selectedSong, label, category);
    } else {
      await onAddSongTag(selectedSong, label, category);
    }

    // Refresh tags
    const tags = await onGetSongTags(selectedSong);
    setSelectedSongTags(tags.map((t: any) => ({ label: t.label, category: t.category })));

    // Update song data
    setSongs(prev => prev.map(s => {
      if (s.filePath !== selectedSong) return s;
      const newGenres = tags.filter((t: any) => t.category === 'genre').map((t: any) => t.label);
      const newMoods = tags.filter((t: any) => t.category === 'mood').map((t: any) => t.label);
      const newPhase = tags.find((t: any) => t.category === 'phase')?.label;
      return { ...s, genres: newGenres, moods: newMoods, phase: newPhase };
    }));
  }, [selectedSong, selectedSongTags]);

  // Bulk toggle tag for keyboard shortcuts (number keys)
  const handleBulkToggleTag = useCallback(async (label: string, category: string) => {
    if (selectedSongs.size === 0) return;

    const allHaveTag = [...selectedSongs].every(fp => {
      const song = songs.find(s => s.filePath === fp);
      if (!song) return false;
      if (category === 'genre') return song.genres.includes(label);
      if (category === 'mood') return song.moods.includes(label);
      return false;
    });

    for (const fp of selectedSongs) {
      if (allHaveTag) {
        await onRemoveSongTag(fp, label, category);
      } else {
        const song = songs.find(s => s.filePath === fp);
        const hasTag = song && (
          (category === 'genre' && song.genres.includes(label)) ||
          (category === 'mood' && song.moods.includes(label))
        );
        if (!hasTag) {
          await onAddSongTag(fp, label, category);
        }
      }
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
      setSelectedSongTags(tags.map((t: any) => ({ label: t.label, category: t.category })));
    }
  }, [selectedSongs, songs, selectedSong]);

  // Keyboard navigation handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Alt+Arrow: audio playback controls (must be checked before navigation)
      if (e.altKey) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            audioQueue.setVolume(Math.min(1, audioQueue.volume + 0.1));
            return;
          case 'ArrowDown':
            e.preventDefault();
            audioQueue.setVolume(Math.max(0, audioQueue.volume - 0.1));
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
          if (idx < allMoods.length) {
            handleBulkToggleTag(allMoods[idx].label, 'mood');
          }
        } else {
          if (idx < allGenres.length) {
            handleBulkToggleTag(allGenres[idx].label, 'genre');
          }
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (isLocked) return;
          const col = columnData[focusedColumn];
          if (!col) return;
          const newIdx = Math.min(focusedIndex + 1, col.songs.length - 1);
          setFocusedIndex(newIdx);
          if (e.shiftKey) {
            const fp = col.songs[newIdx]?.filePath;
            if (fp) setSelectedSongs(prev => new Set([...prev, fp]));
          } else {
            const fp = col.songs[newIdx]?.filePath;
            setSelectedSongs(fp ? new Set([fp]) : new Set());
            setSelectedSong(fp || null);
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (isLocked) return;
          const col = columnData[focusedColumn];
          if (!col) return;
          const newIdx = Math.max(focusedIndex - 1, 0);
          setFocusedIndex(newIdx);
          if (e.shiftKey) {
            const fp = col.songs[newIdx]?.filePath;
            if (fp) setSelectedSongs(prev => new Set([...prev, fp]));
          } else {
            const fp = col.songs[newIdx]?.filePath;
            setSelectedSongs(fp ? new Set([fp]) : new Set());
            setSelectedSong(fp || null);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (isLocked && selectedSongs.size > 0) {
            const newCol = Math.max(focusedColumn - 1, 0);
            if (newCol !== focusedColumn) {
              const targetPhase = columnData[newCol].phase;
              for (const fp of selectedSongs) {
                handleDrop(fp, targetPhase);
              }
              setFocusedColumn(newCol);
              setFocusedIndex(0);
            }
            return;
          }
          if (isLocked) return;
          const newCol = Math.max(focusedColumn - 1, 0);
          setFocusedColumn(newCol);
          setFocusedIndex(0);
          const col = columnData[newCol];
          const fp = col?.songs[0]?.filePath;
          setSelectedSongs(fp ? new Set([fp]) : new Set());
          setSelectedSong(fp || null);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (isLocked && selectedSongs.size > 0) {
            const newCol = Math.min(focusedColumn + 1, columnData.length - 1);
            if (newCol !== focusedColumn) {
              const targetPhase = columnData[newCol].phase;
              for (const fp of selectedSongs) {
                handleDrop(fp, targetPhase);
              }
              setFocusedColumn(newCol);
              setFocusedIndex(0);
            }
            return;
          }
          if (isLocked) return;
          const newCol = Math.min(focusedColumn + 1, columnData.length - 1);
          setFocusedColumn(newCol);
          setFocusedIndex(0);
          const col = columnData[newCol];
          const fp = col?.songs[0]?.filePath;
          setSelectedSongs(fp ? new Set([fp]) : new Set());
          setSelectedSong(fp || null);
          break;
        }
        case ' ': {
          e.preventDefault();
          if (audioQueue.currentTrack) {
            audioQueue.togglePlayPause();
          } else if (focusedSong) {
            handlePlay(focusedSong);
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setIsLocked(false);
          setSelectedSongs(new Set());
          setSelectedSong(null);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (isLocked) {
            setIsLocked(false);
          } else if (selectedSongs.size > 0) {
            setIsLocked(true);
          }
          break;
        }
        case '?': {
          e.preventDefault();
          setHelpOpen(true);
          break;
        }
        case 'l':
        case 'L': {
          e.preventDefault();
          setLibraryOpen(v => !v);
          break;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [focusedColumn, focusedIndex, columnData, isLocked, selectedSongs, audioQueue, focusedSong, handlePlay, handleDrop, handleBulkToggleTag, allGenres, allMoods]);

  const handleSongClick = useCallback((filePath: string) => {
    setSelectedSong(filePath);
  }, []);

  const handleSongDoubleClick = useCallback((filePath: string) => {
    setSelectedSong(filePath);
    setDetailOpen(true);
  }, []);

  const handleAddFromLibrary = useCallback(async (filePaths: string[]) => {
    // Songs from library are already in the DB — just reload
    await loadSongs();
  }, [loadSongs]);

  if (loading) {
    return (
      <Box style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text c="dimmed">Loading set...</Text>
      </Box>
    );
  }

  return (
    <Box className="set-view">
      {/* Top toolbar */}
      <Group className="set-view-toolbar" gap={6} px={10} py={6}>
        <Text size="sm" fw={700} style={{ letterSpacing: 1 }}>🎧 SET VIEW</Text>
        <Box style={{ flex: 1 }} />
        <SegmentedControl
          size="xs"
          value={groupBy}
          onChange={(v) => setGroupBy(v as 'none' | 'genre' | 'mood')}
          data={[
            { label: 'Flat', value: 'none' },
            { label: 'By Genre', value: 'genre' },
            { label: 'By Mood', value: 'mood' },
          ]}
        />
        <Tooltip label="Library"><ActionIcon size="sm" variant="subtle" onClick={() => setLibraryOpen(v => !v)}><IconLayoutSidebar size={14} /></ActionIcon></Tooltip>
        {selectedSongs.size > 0 && (
          <Badge
            size="sm"
            variant={isLocked ? 'filled' : 'light'}
            color={isLocked ? 'blue' : 'violet'}
          >
            {isLocked ? `⇄ Moving ${selectedSongs.size} song${selectedSongs.size > 1 ? 's' : ''}` : `${selectedSongs.size} selected`}
          </Badge>
        )}
        <Tooltip label="Export Tags"><ActionIcon size="sm" variant="subtle" onClick={() => setReviewOpen(true)}><IconChecklist size={14} /></ActionIcon></Tooltip>
        <Tooltip label="Settings"><ActionIcon size="sm" variant="subtle" onClick={() => setSettingsOpen(true)}><IconSettings size={14} /></ActionIcon></Tooltip>
        <Tooltip label="Keyboard shortcuts (?)">
          <ActionIcon size="sm" variant="subtle" onClick={() => setHelpOpen(true)}>
            <IconKeyboard size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Main content */}
      <Box className="set-view-main">
        {/* Library panel (left, optional) */}
        {libraryOpen && (
          <Box className="set-view-library">
            <LibraryPanel
              onSongSelect={handleSongClick}
              onSongDoubleClick={handlePlay}
              onAddAllSongs={handleAddFromLibrary}
            />
          </Box>
        )}

        {/* Phase columns (center) */}
        <Box className="set-view-columns">
          {phases.map(phase => (
            <PhaseColumn
              key={phase}
              phase={phase}
              songs={phaseColumns.byPhase.get(phase) || []}
              selectedSong={selectedSong}
              selectedSongs={selectedSongs}
              focusedSong={focusedSong}
              isLocked={isLocked}
              playingSong={audioQueue.currentTrack?.filePath || null}
              groupBy={groupBy}
              onSongClick={handleSongClick}
              onSongDoubleClick={handleSongDoubleClick}
              onDrop={handleDrop}
            />
          ))}
          {/* Unassigned column */}
          <PhaseColumn
            phase="unassigned"
            songs={phaseColumns.unassigned}
            selectedSong={selectedSong}
            selectedSongs={selectedSongs}
            focusedSong={focusedSong}
            isLocked={isLocked}
            playingSong={audioQueue.currentTrack?.filePath || null}
            groupBy={groupBy}
            onSongClick={handleSongClick}
            onSongDoubleClick={handleSongDoubleClick}
            onDrop={(fp) => handleDrop(fp, '__unassigned__')}
            color="gray"
          />
        </Box>

        {/* Tag palette (right) */}
        <TagPaletteSidebar
          selectedSong={selectedSong}
          activeTags={selectedSongTags}
          onToggleTag={handleToggleTag}
          genres={allGenres}
          moods={allMoods}
        />
      </Box>

      {/* Drawers */}
      <Drawer opened={detailOpen} onClose={() => setDetailOpen(false)} position="right" size="md" title="Song Detail">
        <SongDetailPanel
          filePath={selectedSong}
          onSongSelect={(fp) => { setSelectedSong(fp); }}
          onPlay={handlePlay}
          onTagsChanged={loadSongs}
        />
      </Drawer>

      <Drawer opened={settingsOpen} onClose={() => setSettingsOpen(false)} position="right" size="sm" title="Settings">
        <SettingsDrawer onClose={() => setSettingsOpen(false)} />
      </Drawer>

      <Drawer opened={reviewOpen} onClose={() => setReviewOpen(false)} position="right" size="lg" title="Export Tags">
        <ReviewPanel onClose={() => setReviewOpen(false)} />
      </Drawer>

      {/* Audio player */}
      <Box className="set-view-player">
        <AudioPlayerBar
          currentTrack={audioQueue.currentTrack}
          isPlaying={audioQueue.isPlaying}
          volume={audioQueue.volume}
          onPlayStateChange={audioQueue.setIsPlaying}
          onVolumeChange={audioQueue.setVolume}
          onTimeUpdate={audioQueue.setCurrentTime}
          onEnded={() => audioQueue.setIsPlaying(false)}
          onTogglePlayPause={audioQueue.togglePlayPause}
        />
      </Box>

      <ShortcutHelpModal opened={helpOpen} onClose={() => setHelpOpen(false)} />
    </Box>
  );
}
