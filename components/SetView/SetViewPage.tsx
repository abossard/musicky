import { useState, useCallback, useRef } from 'react';
import { Box, Group, Drawer, SegmentedControl, Text, ActionIcon, Tooltip, Badge } from '@mantine/core';
import { IconLayoutSidebar, IconSettings, IconChecklist, IconKeyboard } from '@tabler/icons-react';
import { onAddSongTag, onRemoveSongTag } from '../Moodboard/MoodboardPage.telefunc';
import { PhaseColumn } from './PhaseColumn';
import { ShortcutHelpModal } from './ShortcutHelpModal';
import { TagPaletteSidebar } from './TagPaletteSidebar';
import { LibraryPanel } from '../Shared/LibraryPanel';
import { SongDetailPanel } from '../Shared/SongDetailPanel';
import { SettingsDrawer } from '../Shared/SettingsDrawer';
import { ReviewPanel } from '../Shared/ReviewPanel';
import { AudioPlayerBar } from '../Shared/AudioPlayerBar';
import { useAudioQueue } from '../../hooks/useAudioQueue';
import { useSetViewState } from './hooks/useSetViewState';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useTagManagement } from './hooks/useTagManagement';

import './SetView.css';

export function SetViewPage() {
  // Panel states
  const [groupBy, setGroupBy] = useState<'none' | 'genre' | 'mood'>('none');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const audioQueue = useAudioQueue();
  const { songs, setSongs, loading, allGenres, allMoods, phases, phaseColumns, loadSongs } = useSetViewState();

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

  const handleDrop = useCallback(async (filePath: string, targetPhase: string) => {
    const song = songs.find(s => s.filePath === filePath);
    if (!song) return;
    if (song.phase) {
      await onRemoveSongTag(filePath, song.phase, 'phase');
    }
    if (targetPhase !== '__unassigned__') {
      await onAddSongTag(filePath, targetPhase, 'phase');
    }
    setSongs(prev => prev.map(s =>
      s.filePath === filePath
        ? { ...s, phase: targetPhase === '__unassigned__' ? undefined : targetPhase }
        : s
    ));
  }, [songs, setSongs]);

  // Ref breaks circular dependency: keyboard hook → bulkToggleTag → keyboard hook's selectedSongs
  const handleBulkToggleTagRef = useRef<((label: string, category: string) => Promise<void>) | undefined>(undefined);

  const toggleHelp = useCallback(() => setHelpOpen(true), []);
  const toggleLibrary = useCallback(() => setLibraryOpen(v => !v), []);

  const {
    selectedSongs, isLocked, selectedSong, setSelectedSong,
    columnData, focusedSong,
  } = useKeyboardNavigation({
    phases, phaseColumns, handleDrop, handlePlay,
    handleBulkToggleTagRef, audioQueue, allGenres, allMoods,
    onToggleHelp: toggleHelp, onToggleLibrary: toggleLibrary,
  });

  const { selectedSongTags, tagPending, handleToggleTag, handleBulkToggleTag } = useTagManagement({
    selectedSong, selectedSongs, songs, setSongs,
  });
  handleBulkToggleTagRef.current = handleBulkToggleTag;

  const handleSongClick = useCallback((filePath: string) => {
    setSelectedSong(filePath);
  }, [setSelectedSong]);

  const handleSongDoubleClick = useCallback((filePath: string) => {
    setSelectedSong(filePath);
    setDetailOpen(true);
  }, [setSelectedSong]);

  const handleAddFromLibrary = useCallback(async (_filePaths: string[]) => {
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
        {libraryOpen && (
          <Box className="set-view-library">
            <LibraryPanel
              onSongSelect={handleSongClick}
              onSongDoubleClick={handlePlay}
              onAddAllSongs={handleAddFromLibrary}
            />
          </Box>
        )}

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

        <TagPaletteSidebar
          selectedSong={selectedSong}
          activeTags={selectedSongTags}
          onToggleTag={handleToggleTag}
          genres={allGenres}
          moods={allMoods}
          tagPending={tagPending}
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
