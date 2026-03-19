import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Box, Drawer, ActionIcon, Tooltip, Group, Text, Loader, Transition } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconLayoutSidebar,
  IconPlaylist,
  IconSettings,
  IconChecklist,
  IconCheck,
  IconLoader2,
  IconMaximize,
  IconMinimize,
  IconHome,
} from '@tabler/icons-react';
import { ReactFlowProvider } from '@xyflow/react';

import { MoodboardCanvas } from './MoodboardCanvas';
import { MoodboardSearch } from './MoodboardSearch';
import { GlobalSearch } from './GlobalSearch';
import { useMoodboardState } from './hooks/useMoodboardState';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { onLoadMoodboardState, onGetPhaseEdges, onGetPhaseOrder, onGetPhasesWithCounts } from './MoodboardPage.telefunc';
import { useAudioQueue } from '../../hooks/useAudioQueue';

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
  const [searchOpened, setSearchOpened] = useState(false);
  const [globalSearchOpened, setGlobalSearchOpened] = useState(false);

  // Phase data (from unified API)
  const [phaseEdges, setPhaseEdges] = useState<PhaseEdgeInfo[]>([]);
  const [phaseOrder, setPhaseOrder] = useState<string[]>([]);
  const [phaseCounts, setPhaseCounts] = useState<Record<string, number>>({});
  const [activePhaseFilter, setActivePhaseFilter] = useState<string | null>(null);
  const [phaseEditorOpen, setPhaseEditorOpen] = useState(false);

  // Loading
  const [loading, setLoading] = useState(true);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }, []);

  // Audio
  const audioQueue = useAudioQueue();

  // Moodboard canvas state (unified graph)
  const moodboard = useMoodboardState(
    audioQueue.isPlaying ? audioQueue.currentTrack?.filePath : null,
  );

  // Library search input ref for keyboard focus
  const librarySearchRef = useRef<HTMLInputElement>(null);

  // Scroll-to-node ref (populated by MoodboardCanvas)
  const scrollToNodeRef = useRef<((nodeId: string) => void) | null>(null);

  // Compute set of file paths currently on canvas
  const canvasFilePaths = useMemo(() => {
    const paths = new Set<string>();
    for (const node of moodboard.nodes) {
      if (node.type === 'song') {
        const fp = (node.data as Record<string, unknown>).filePath as string;
        if (fp) paths.add(fp);
      }
    }
    return paths;
  }, [moodboard.nodes]);

  // Keyboard navigation
  const { activeZone, setActiveZone, showShortcutHelp, setShowShortcutHelp } = useKeyboardNav({
    onPlayPause: audioQueue.togglePlayPause,
    onGeneratePlaylist: () => setPlaylistPanelOpen(true),
    onToggleLibrary: () => setLibraryPanelOpen(v => !v),
    onTogglePlaylist: () => setPlaylistPanelOpen(v => !v),
    onOpenSettings: () => setSettingsDrawerOpen(true),
    onOpenSearch: () => {
      setGlobalSearchOpened(true);
    },
    onEscape: () => {
      if (globalSearchOpened) { setGlobalSearchOpened(false); return; }
      if (detailDrawerOpen) { setDetailDrawerOpen(false); return; }
      if (settingsDrawerOpen) { setSettingsDrawerOpen(false); return; }
      if (reviewDrawerOpen) { setReviewDrawerOpen(false); return; }
      if (searchOpened) { setSearchOpened(false); return; }
    },
    onSaveCanvas: () => {
      moodboard.saveNow();
      notifications.show({
        title: 'Canvas saved',
        message: 'Your moodboard has been saved',
        icon: <IconCheck size={16} />,
        color: 'green',
        autoClose: 2000,
      });
    },
    libraryOpen: libraryPanelOpen,
    playlistOpen: playlistPanelOpen,
  });

  // Load phase data on mount via unified API
  useEffect(() => {
    Promise.all([
      onLoadMoodboardState(),
      onGetPhasesWithCounts(),
    ]).then(([state, counts]) => {
      setPhaseEdges(state.phaseEdges);
      setPhaseOrder(state.phaseOrder);
      const countMap: Record<string, number> = {};
      for (const c of counts) countMap[c.phase] = c.count;
      setPhaseCounts(countMap);
      setLoading(false);
    });
  }, []);

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

  const handleDropSong = useCallback(async (songPath: string, x: number, y: number) => {
    return moodboard.addSong(songPath, x, y);
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
      {/* Compact header bar */}
      <Group className="moodboard-header" gap={4}>
        <Tooltip label="Home" position="bottom">
          <ActionIcon component="a" href="/" size="sm" variant="subtle" c="dimmed">
            <IconHome size={14} />
          </ActionIcon>
        </Tooltip>
        <Text size="xs" fw={600} c="dimmed">Musicky</Text>

        <Box style={{ flex: 1 }} />

        {/* Save status indicator */}
        <Transition mounted={moodboard.saveStatus !== 'idle'} transition="fade" duration={300}>
          {(styles) => (
            <Group gap={4} style={styles} className="save-indicator">
              {moodboard.saveStatus === 'saving' && (
                <>
                  <IconLoader2 size={12} className="save-spinner" />
                  <Text size="xs" c="dimmed">Saving…</Text>
                </>
              )}
              {moodboard.saveStatus === 'saved' && (
                <>
                  <IconCheck size={12} color="var(--mantine-color-green-5)" />
                  <Text size="xs" c="green.5">Saved</Text>
                </>
              )}
            </Group>
          )}
        </Transition>

        <Tooltip label={libraryPanelOpen ? 'Hide Library (⌘L)' : 'Show Library (⌘L)'} position="bottom">
          <ActionIcon
            size="sm"
            variant={libraryPanelOpen ? 'filled' : 'subtle'}
            color="violet"
            onClick={() => setLibraryPanelOpen(v => !v)}
            data-testid="toolbar-toggle-library"
          >
            <IconLayoutSidebar size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={playlistPanelOpen ? 'Hide Playlist (⌘P)' : 'Show Playlist (⌘P)'} position="bottom">
          <ActionIcon
            size="sm"
            variant={playlistPanelOpen ? 'filled' : 'subtle'}
            color="violet"
            onClick={() => setPlaylistPanelOpen(v => !v)}
            data-testid="toolbar-toggle-playlist"
          >
            <IconPlaylist size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Settings (⌘,)" position="bottom">
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => setSettingsDrawerOpen(true)}
            data-testid="toolbar-settings"
          >
            <IconSettings size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Review Changes" position="bottom">
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => setReviewDrawerOpen(true)}
            data-testid="toolbar-review"
          >
            <IconChecklist size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={isFullscreen ? 'Exit Fullscreen (F11)' : 'Fullscreen (F11)'} position="bottom">
          <ActionIcon size="sm" variant="subtle" onClick={toggleFullscreen}>
            {isFullscreen ? <IconMinimize size={14} /> : <IconMaximize size={14} />}
          </ActionIcon>
        </Tooltip>
      </Group>

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
              onEdgeTypeChange={(edgeId, newType) => { moodboard.setEdgeType(edgeId, newType as EdgeType); }}
              onSearchOpen={() => setSearchOpened(true)}
              onAddTag={handleAddTag}
              onPlaySong={handlePlaySong}
              onHoverPlaySong={handleHoverPlaySong}
              onNodesUpdate={(newNodes) => moodboard.setNodes(newNodes)}
              onAddSong={handleDropSong}
            />
          </ReactFlowProvider>
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
            // Reload phase data after library scan
            onLoadMoodboardState().then(state => {
              setPhaseEdges(state.phaseEdges);
              setPhaseOrder(state.phaseOrder);
            });
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
