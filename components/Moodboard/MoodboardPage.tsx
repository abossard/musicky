import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Drawer, ActionIcon, Tooltip, Group, Text, Loader } from '@mantine/core';
import {
  IconLayoutSidebar,
  IconPlaylist,
  IconSettings,
  IconChecklist,
  IconPlayerPlay,
  IconMusic,
} from '@tabler/icons-react';
import { ReactFlowProvider } from '@xyflow/react';

import { MoodboardCanvas } from './MoodboardCanvas';
import { MoodboardSearch } from './MoodboardSearch';
import { useMoodboardState } from './hooks/useMoodboardState';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { onGetMoodboards, onCreateMoodboard } from './Moodboard.telefunc';
import { onLoadMoodboardState, onGetPhaseEdges, onGetPhaseOrder, onGetPhasesWithCounts } from './MoodboardPage.telefunc';
import { useAudioQueue } from '../../hooks/useAudioQueue';
import { showSuccess } from '../../lib/notifications';

import { PhaseFlowBar } from './PhaseFlowBar';
import { PhaseFlowEditor } from './PhaseFlowEditor';
import { LibraryPanel } from './LibraryPanel';
import { PlaylistPanel } from './PlaylistPanel';
import { SongDetailPanel } from './SongDetailPanel';
import { SettingsDrawer } from './SettingsDrawer';
import { ReviewPanel } from './ReviewPanel';
import { AudioPlayerBar } from './AudioPlayerBar';
import { ShortcutHelpModal } from './ShortcutHelpModal';

import type { MP3Metadata } from '../../lib/mp3-metadata';
import type { TagCategory } from './moodboard-constants';
import type { Connection } from '@xyflow/react';
import type { EdgeType } from './edges/WeightedEdge';

import './MoodboardPage.css';

interface PhaseEdgeInfo {
  id: number;
  fromPhase: string;
  toPhase: string;
  weight: number;
}

export function MoodboardPage() {
  // Panel visibility
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [libraryPanelOpen, setLibraryPanelOpen] = useState(true);
  const [playlistPanelOpen, setPlaylistPanelOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);

  // Board state
  const [boards, setBoards] = useState<{ id: number; name: string }[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [searchOpened, setSearchOpened] = useState(false);

  // Phase data (from unified API)
  const [phaseEdges, setPhaseEdges] = useState<PhaseEdgeInfo[]>([]);
  const [phaseOrder, setPhaseOrder] = useState<string[]>([]);
  const [phaseCounts, setPhaseCounts] = useState<Record<string, number>>({});
  const [activePhaseFilter, setActivePhaseFilter] = useState<string | null>(null);
  const [phaseEditorOpen, setPhaseEditorOpen] = useState(false);

  // Loading
  const [loading, setLoading] = useState(true);

  // Audio
  const audioQueue = useAudioQueue();

  // Moodboard canvas state (board-specific)
  const moodboard = useMoodboardState(
    selectedBoardId,
    audioQueue.isPlaying ? audioQueue.currentTrack?.filePath : null,
  );

  // Library search input ref for keyboard focus
  const librarySearchRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation
  const { activeZone, setActiveZone, showShortcutHelp, setShowShortcutHelp } = useKeyboardNav({
    onPlayPause: audioQueue.togglePlayPause,
    onGeneratePlaylist: () => setPlaylistPanelOpen(true),
    onToggleLibrary: () => setLibraryPanelOpen(v => !v),
    onTogglePlaylist: () => setPlaylistPanelOpen(v => !v),
    onOpenSettings: () => setSettingsDrawerOpen(true),
    onOpenSearch: () => {
      if (!libraryPanelOpen) setLibraryPanelOpen(true);
      setTimeout(() => librarySearchRef.current?.focus(), 50);
    },
    onEscape: () => {
      if (detailDrawerOpen) { setDetailDrawerOpen(false); return; }
      if (settingsDrawerOpen) { setSettingsDrawerOpen(false); return; }
      if (reviewDrawerOpen) { setReviewDrawerOpen(false); return; }
      if (searchOpened) { setSearchOpened(false); return; }
    },
    onSaveCanvas: () => {
      // Canvas auto-saves via debounce; this triggers an immediate flush
      moodboard.onViewportChange(moodboard.viewport);
    },
    libraryOpen: libraryPanelOpen,
    playlistOpen: playlistPanelOpen,
  });

  // Load boards and phase data on mount
  useEffect(() => {
    Promise.all([
      onGetMoodboards(),
      onGetPhaseEdges(),
      onGetPhaseOrder(),
      onGetPhasesWithCounts(),
    ]).then(([boardList, edges, order, counts]) => {
      setBoards(boardList.map(x => ({ id: x.id, name: x.name })));
      if (boardList.length > 0) setSelectedBoardId(boardList[0].id);
      setPhaseEdges(edges);
      setPhaseOrder(order);
      const countMap: Record<string, number> = {};
      for (const c of counts) countMap[c.phase] = c.count;
      setPhaseCounts(countMap);
      setLoading(false);
    });
  }, []);

  // Refresh phase data when moodboard state reloads
  useEffect(() => {
    if (!loading) {
      onLoadMoodboardState().then(state => {
        setPhaseEdges(state.phaseEdges);
        setPhaseOrder(state.phaseOrder);
      });
    }
  }, [selectedBoardId, loading]);

  const refreshPhaseData = useCallback(async () => {
    const [edges, order, counts] = await Promise.all([
      onGetPhaseEdges(),
      onGetPhaseOrder(),
      onGetPhasesWithCounts(),
    ]);
    setPhaseEdges(edges);
    setPhaseOrder(order);
    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.phase] = c.count;
    setPhaseCounts(countMap);
  }, []);

  const handlePhaseFilterClick = useCallback((phase: string) => {
    setActivePhaseFilter((prev) => (prev === phase ? null : phase));
  }, []);

  const handleCreateBoard = useCallback(async () => {
    const name = `Board ${new Date().toLocaleDateString()}`;
    const board = await onCreateMoodboard(name);
    setBoards(prev => [{ id: board.id, name: board.name }, ...prev]);
    setSelectedBoardId(board.id);
  }, []);

  const getTrackMetadata = useCallback((filePath: string): MP3Metadata => {
    const node = moodboard.nodes.find(n => (n.data as Record<string, unknown>).filePath === filePath);
    return {
      filePath,
      title: (node?.data as Record<string, unknown>)?.title as string || 'Unknown',
      artist: (node?.data as Record<string, unknown>)?.artist as string || 'Unknown',
    };
  }, [moodboard.nodes]);

  const handlePlaySong = useCallback((filePath: string) => {
    const meta = getTrackMetadata(filePath);
    audioQueue.playTrack(meta);
    setSelectedSong(filePath);
  }, [audioQueue, getTrackMetadata]);

  const handleHoverPlaySong = useCallback((filePath: string) => {
    const meta = getTrackMetadata(filePath);
    if (audioQueue.currentTrack?.filePath === filePath) {
      if (!audioQueue.isPlaying) audioQueue.setIsPlaying(true);
      return;
    }
    audioQueue.playTrack(meta);
  }, [audioQueue, getTrackMetadata]);

  const handleAddSong = useCallback(async (songPath: string) => {
    const existingCount = moodboard.nodes.length;
    const cols = 5;
    const spacing = 180;
    const col = existingCount % cols;
    const row = Math.floor(existingCount / cols);
    return moodboard.addSong(songPath, col * spacing + Math.random() * 30, row * spacing + Math.random() * 30);
  }, [moodboard]);

  const handleConnect = useCallback((connection: Connection, edgeType: EdgeType, weight: number) => {
    return moodboard.connectNodes(connection, edgeType, weight);
  }, [moodboard]);

  const handleAddTag = useCallback((label: string, category: TagCategory, color: string) => {
    const tagCount = moodboard.nodes.filter(n => n.type === 'tag').length;
    moodboard.addTag(label, category, color, -200 + tagCount * 50, tagCount * 80);
  }, [moodboard]);

  const handleSongSelect = useCallback((filePath: string) => {
    setSelectedSong(filePath);
    setDetailDrawerOpen(true);
  }, []);

  if (loading) {
    return (
      <Box className="moodboard-loading">
        <Group gap="sm">
          <Loader size="sm" />
          <Text c="dimmed">Loading moodboard…</Text>
        </Group>
      </Box>
    );
  }

  return (
    <Box className="moodboard-page">
      {/* Phase Flow Bar */}
      <PhaseFlowBar
        phaseEdges={phaseEdges}
        phaseOrder={phaseOrder}
        phaseCounts={phaseCounts}
        activePhaseFilter={activePhaseFilter}
        onPhaseClick={handlePhaseFilterClick}
        onPhaseEdgesChanged={refreshPhaseData}
        onOpenEditor={() => setPhaseEditorOpen(true)}
      />

      {/* Phase Flow Editor Modal */}
      <PhaseFlowEditor
        opened={phaseEditorOpen}
        onClose={() => setPhaseEditorOpen(false)}
        phaseEdges={phaseEdges}
        phases={phaseOrder}
        phaseCounts={phaseCounts}
        onSave={refreshPhaseData}
      />

      {/* Main content area */}
      <Box className="moodboard-main">
        {/* Left: Library Panel (collapsible) */}
        {libraryPanelOpen && (
          <Box
            data-focus-zone="library"
            className={activeZone === 'library' ? 'active-zone' : undefined}
            onClick={() => setActiveZone('library')}
          >
            <LibraryPanel
              onSongSelect={handleSongSelect}
              onSongDoubleClick={handlePlaySong}
              searchInputRef={librarySearchRef}
            />
          </Box>
        )}

        {/* Center: Moodboard Canvas */}
        <Box
          className={`moodboard-canvas-area${activeZone === 'canvas' ? ' active-zone' : ''}`}
          data-focus-zone="canvas"
          onClick={() => setActiveZone('canvas')}
        >
          {selectedBoardId ? (
            <ReactFlowProvider>
              <MoodboardCanvas
                nodes={moodboard.nodes}
                edges={moodboard.edges}
                onNodesChange={moodboard.onNodesChange}
                onEdgesChange={moodboard.onEdgesChange}
                viewport={moodboard.viewport}
                onViewportChange={moodboard.onViewportChange}
                onConnect={handleConnect}
                onNodeDelete={moodboard.removeNode}
                onEdgeDelete={moodboard.removeEdge}
                onEdgeWeightChange={moodboard.setEdgeWeight}
                onSearchOpen={() => setSearchOpened(true)}
                onAddTag={handleAddTag}
                onPlaySong={handlePlaySong}
                onHoverPlaySong={handleHoverPlaySong}
                onNodesUpdate={(newNodes) => moodboard.setNodes(newNodes)}
              />
            </ReactFlowProvider>
          ) : (
            <Box className="moodboard-loading">
              <Group gap="sm">
                <IconMusic size={16} />
                <Text c="dimmed">No board selected</Text>
                <ActionIcon size="sm" variant="light" onClick={handleCreateBoard} title="Create board">
                  <IconPlayerPlay size={14} />
                </ActionIcon>
              </Group>
            </Box>
          )}

          {/* Toolbar overlay */}
          <Group className="moodboard-toolbar" gap={4}>
            <Tooltip label={libraryPanelOpen ? 'Hide Library' : 'Show Library'} position="bottom">
              <ActionIcon
                size="sm"
                variant={libraryPanelOpen ? 'filled' : 'subtle'}
                color="violet"
                onClick={() => setLibraryPanelOpen(v => !v)}
              >
                <IconLayoutSidebar size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={playlistPanelOpen ? 'Hide Playlist' : 'Show Playlist'} position="bottom">
              <ActionIcon
                size="sm"
                variant={playlistPanelOpen ? 'filled' : 'subtle'}
                color="violet"
                onClick={() => setPlaylistPanelOpen(v => !v)}
              >
                <IconPlaylist size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Settings" position="bottom">
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={() => setSettingsDrawerOpen(true)}
              >
                <IconSettings size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Review Changes" position="bottom">
              <ActionIcon
                size="sm"
                variant="subtle"
                onClick={() => setReviewDrawerOpen(true)}
              >
                <IconChecklist size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Box>
      </Box>

      {/* Bottom: Playlist Panel (collapsible) */}
      {playlistPanelOpen && <Box
        data-focus-zone="playlist"
        className={activeZone === 'playlist' ? 'active-zone' : undefined}
        onClick={() => setActiveZone('playlist')}
      >
        <PlaylistPanel
          isOpen={playlistPanelOpen}
          onToggle={() => setPlaylistPanelOpen(v => !v)}
          onSongClick={(filePath) => { setSelectedSong(filePath); setDetailDrawerOpen(true); }}
          onSongDoubleClick={handlePlaySong}
          onPlayAll={(filePaths) => {
            if (filePaths.length > 0) {
              const first = getTrackMetadata(filePaths[0]);
              audioQueue.playTrack(first);
            }
          }}
        />
      </Box>}

      {/* Bottom: Audio Player Bar */}
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

      {/* Right Drawer: Song Detail */}
      <Drawer
        opened={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        position="right"
        size="md"
        title="Song Detail"
      >
        <SongDetailPanel
          filePath={selectedSong}
          onSongSelect={handleSongSelect}
          onPlay={handlePlaySong}
        />
      </Drawer>

      {/* Settings Drawer */}
      <Drawer
        opened={settingsDrawerOpen}
        onClose={() => setSettingsDrawerOpen(false)}
        position="right"
        size="md"
        title="Settings"
      >
        <SettingsDrawer
          onClose={() => setSettingsDrawerOpen(false)}
          onScanComplete={() => {
            // Reload moodboard state after library scan
            if (selectedBoardId) {
              onLoadMoodboardState().then(state => {
                setPhaseEdges(state.phaseEdges);
                setPhaseOrder(state.phaseOrder);
              });
            }
          }}
          onPhasesChanged={() => {
            onGetPhaseOrder().then(setPhaseOrder);
          }}
        />
      </Drawer>

      {/* Review Drawer */}
      <Drawer
        opened={reviewDrawerOpen}
        onClose={() => setReviewDrawerOpen(false)}
        position="right"
        size="lg"
        title="Review Changes"
      >
        <ReviewPanel onClose={() => setReviewDrawerOpen(false)} />
      </Drawer>

      {/* Search Modal */}
      <MoodboardSearch
        opened={searchOpened}
        onClose={() => setSearchOpened(false)}
        onAddSong={handleAddSong}
        checkOnBoard={moodboard.checkSongOnBoard}
        searchSongs={moodboard.searchSongs}
      />

      {/* Keyboard Shortcut Help */}
      <ShortcutHelpModal
        opened={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
      />
    </Box>
  );
}
