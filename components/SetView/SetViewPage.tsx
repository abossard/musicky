import { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Group, Drawer, SegmentedControl, Text, ActionIcon, Tooltip, Badge, TextInput, Skeleton } from '@mantine/core';
import { IconLayoutSidebar, IconSettings, IconChecklist, IconKeyboard, IconPlus } from '@tabler/icons-react';
import { onAddSongTag, onRemoveSongTag } from '../Moodboard/MoodboardPage.telefunc';
import { onGetAllPhaseVersions, onGetPhaseVersions, onCreatePhaseVersion, onGetSongsForVersion } from '../Moodboard/PhaseVersions.telefunc';
import { PhaseColumn } from './PhaseColumn';
import { ShortcutHelpModal } from './ShortcutHelpModal';
import { TagPaletteSidebar } from './TagPaletteSidebar';
import { LibraryPanel } from '../Shared/LibraryPanel';
import { SongDetailPanel } from '../Shared/SongDetailPanel';
import { SettingsDrawer } from '../Shared/SettingsDrawer';
import { ExportReviewTable } from './ExportReviewTable';
import { AudioPlayerBar } from '../Shared/AudioPlayerBar';
import { MoodboardCanvasView } from '../Moodboard/MoodboardCanvasView';
import { BoardManager } from '../Moodboard/BoardManager';
import { useAudioQueue } from '../../hooks/useAudioQueue';
import { useSetViewData } from './hooks/useSetViewData';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useTagManagement } from './hooks/useTagManagement';
import type { SongCardData } from './SongCard';
import type { MP3Metadata } from '../../lib/mp3-metadata';

import './SetView.css';

export function SetViewPage() {
  // Panel states
  const [groupBy, setGroupBy] = useState<'none' | 'genre' | 'mood'>('none');
  const [viewMode, setViewMode] = useState<'set' | 'canvas'>('set');
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [addingPhase, setAddingPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');

  // Phase versioning state
  const [phaseVersions, setPhaseVersions] = useState<Map<string, { active: number; versions: number[] }>>(new Map());
  const [viewingVersions, setViewingVersions] = useState<Map<string, number>>(new Map());
  const [versionSongs, setVersionSongs] = useState<Map<string, SongCardData[]>>(new Map());

  const audioQueue = useAudioQueue();
  const { songs, loading, genres: allGenres, moods: allMoods, phases, phaseColumns, loadSongs, addExplicitPhase, updateSongPhase, updateSongTags } = useSetViewData();

  // Handle tray actions from Tauri system tray
  useEffect(() => {
    const handler = (e: Event) => {
      const action = (e as CustomEvent<string>).detail;
      if (action === 'play_pause') audioQueue.togglePlayPause();
    };
    window.addEventListener('musicky:tray-action', handler);
    return () => window.removeEventListener('musicky:tray-action', handler);
  }, [audioQueue.togglePlayPause]);

  // Load phase version data whenever songs change
  useEffect(() => {
    onGetAllPhaseVersions().then(async (data) => {
      const map = new Map<string, { active: number; versions: number[] }>();
      for (const item of data) {
        const allVersions = await onGetPhaseVersions(item.phaseName);
        map.set(item.phaseName, {
          active: item.activeVersion,
          versions: allVersions.map(v => v.version).sort((a, b) => a - b),
        });
      }
      setPhaseVersions(map);
    });
  }, [songs]);

  const handleNewVersion = useCallback(async (phaseName: string) => {
    await onCreatePhaseVersion(phaseName);
    await loadSongs();
  }, [loadSongs]);

  const handleViewVersion = useCallback(async (phaseName: string, version: number) => {
    const info = phaseVersions.get(phaseName);
    if (info && version === info.active) {
      // Viewing active version — clear override
      setViewingVersions(prev => { const m = new Map(prev); m.delete(phaseName); return m; });
      setVersionSongs(prev => { const m = new Map(prev); m.delete(phaseName); return m; });
      return;
    }
    setViewingVersions(prev => new Map(prev).set(phaseName, version));
    const songPaths = await onGetSongsForVersion(phaseName, version);
    // Build SongCardData from the full songs list for matching paths
    const matched = songPaths.map(fp => songs.find(s => s.filePath === fp)).filter((s): s is SongCardData => !!s);
    setVersionSongs(prev => new Map(prev).set(phaseName, matched));
  }, [phaseVersions, songs]);

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
    updateSongPhase(filePath, targetPhase === '__unassigned__' ? undefined : targetPhase);
  }, [songs, updateSongPhase]);

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
    selectedSong, selectedSongs, songs, updateSongTags,
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

  if (loading && viewMode === 'set') {
    return (
      <Box className="set-view">
        <Group className="set-view-toolbar" gap={6} px={10} py={6}>
          <Text size="sm" fw={700} style={{ letterSpacing: 1 }}>🎧 SET VIEW</Text>
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(v) => setViewMode(v as 'set' | 'canvas')}
            data={[
              { label: 'Set View', value: 'set' },
              { label: 'Canvas', value: 'canvas' },
            ]}
          />
          <Box style={{ flex: 1 }} />
          <Tooltip label="Settings"><ActionIcon size="sm" variant="subtle" onClick={() => setSettingsOpen(true)}><IconSettings size={14} /></ActionIcon></Tooltip>
        </Group>
        <Box className="set-view-main">
          <Box className="set-view-columns">
            {['Loading...'].map((label, i) => (
              <Box key={i} style={{ minWidth: 280, padding: 12 }}>
                <Text size="sm" fw={700} tt="uppercase" c="dimmed" mb={8}>{label}</Text>
                {[1, 2, 3, 4].map(j => (
                  <Skeleton key={j} height={60} radius="sm" mb={8} />
                ))}
              </Box>
            ))}
          </Box>
        </Box>
        <Drawer opened={settingsOpen} onClose={() => setSettingsOpen(false)} position="right" size="sm" title="Settings">
          <SettingsDrawer onClose={() => setSettingsOpen(false)} />
        </Drawer>
      </Box>
    );
  }

  return (
    <Box className="set-view">
      {/* Top toolbar */}
      <Group className="set-view-toolbar" gap={6} px={10} py={6}>
        <Text size="sm" fw={700} style={{ letterSpacing: 1 }}>🎧 {viewMode === 'set' ? 'SET VIEW' : 'CANVAS'}</Text>
        <SegmentedControl
          size="xs"
          value={viewMode}
          onChange={(v) => setViewMode(v as 'set' | 'canvas')}
          data={[
            { label: 'Set View', value: 'set' },
            { label: 'Canvas', value: 'canvas' },
          ]}
          data-testid="view-mode-toggle"
        />
        <Box style={{ flex: 1 }} />
        {viewMode === 'set' && (
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
        )}
        {viewMode === 'canvas' && (
          <BoardManager
            activeBoardId={activeBoardId}
            onBoardChange={setActiveBoardId}
          />
        )}
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
      {viewMode === 'canvas' ? (
        <MoodboardCanvasView
          currentPlayingPath={audioQueue.currentTrack?.filePath}
          onPlaySong={(fp) => {
            const song = songs.find(s => s.filePath === fp);
            if (song) audioQueue.playTrack({ filePath: fp, title: song.title, artist: song.artist } as MP3Metadata);
          }}
        />
      ) : (
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
          {phases.map(phase => {
            const vInfo = phaseVersions.get(phase);
            const viewing = viewingVersions.get(phase);
            const isViewingOld = viewing !== undefined && viewing !== vInfo?.active;
            const displaySongs = isViewingOld
              ? (versionSongs.get(phase) || [])
              : (phaseColumns.byPhase.get(phase) || []);
            return (
              <PhaseColumn
                key={phase}
                phase={phase}
                songs={displaySongs}
                selectedSong={selectedSong}
                selectedSongs={selectedSongs}
                focusedSong={focusedSong}
                isLocked={isLocked}
                playingSong={audioQueue.currentTrack?.filePath || null}
                groupBy={groupBy}
                onSongClick={handleSongClick}
                onSongDoubleClick={handleSongDoubleClick}
                onDrop={handleDrop}
                activeVersion={vInfo?.active}
                versions={vInfo?.versions}
                viewingVersion={viewing}
                onNewVersion={() => handleNewVersion(phase)}
                onViewVersion={(v) => handleViewVersion(phase, v)}
                isReadOnly={isViewingOld}
              />
            );
          })}
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
          <Box style={{ minWidth: 160, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}>
            {addingPhase ? (
              <TextInput
                size="xs"
                placeholder="Phase name..."
                value={newPhaseName}
                onChange={e => setNewPhaseName(e.currentTarget.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newPhaseName.trim()) {
                    addExplicitPhase(newPhaseName.trim().toLowerCase());
                    setNewPhaseName('');
                    setAddingPhase(false);
                  }
                  if (e.key === 'Escape') { setAddingPhase(false); setNewPhaseName(''); }
                }}
                onBlur={() => { setAddingPhase(false); setNewPhaseName(''); }}
                autoFocus
                data-testid="new-phase-input"
              />
            ) : (
              <ActionIcon size="lg" variant="subtle" color="violet" onClick={() => setAddingPhase(true)} data-testid="add-phase-btn">
                <IconPlus size={20} />
              </ActionIcon>
            )}
          </Box>
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
      )}

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
      <Drawer opened={reviewOpen} onClose={() => setReviewOpen(false)} position="right" size="lg" title="Export Tags to Files">
        <ExportReviewTable onClose={() => setReviewOpen(false)} />
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
