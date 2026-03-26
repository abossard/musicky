import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Group, Drawer, SegmentedControl, Text, ActionIcon, Tooltip } from '@mantine/core';
import { IconLayoutSidebar, IconSettings, IconChecklist } from '@tabler/icons-react';
import {
  onGetLibrarySongs, onGetSongTags, onGetAllTags,
  onAddSongTag, onRemoveSongTag,
} from '../Moodboard/MoodboardPage.telefunc';
import { PhaseColumn } from './PhaseColumn';
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

  // Panels
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

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

  const handleSongClick = useCallback((filePath: string) => {
    setSelectedSong(filePath);
  }, []);

  const handleSongDoubleClick = useCallback((filePath: string) => {
    setSelectedSong(filePath);
    setDetailOpen(true);
  }, []);

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
        <Tooltip label="Export Tags"><ActionIcon size="sm" variant="subtle" onClick={() => setReviewOpen(true)}><IconChecklist size={14} /></ActionIcon></Tooltip>
        <Tooltip label="Settings"><ActionIcon size="sm" variant="subtle" onClick={() => setSettingsOpen(true)}><IconSettings size={14} /></ActionIcon></Tooltip>
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
    </Box>
  );
}
