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
  IconHistory,
} from '@tabler/icons-react';
import { ReactFlowProvider } from '@xyflow/react';

import { MoodboardCanvas } from './MoodboardCanvas';
import { MoodboardSearch } from './MoodboardSearch';
import { GlobalSearch } from './GlobalSearch';
import { useMoodboardState } from './hooks/useMoodboardState';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { onLoadMoodboardState } from './MoodboardPage.telefunc';
import { useAudioQueue } from '../../hooks/useAudioQueue';

import { LibraryPanel } from './LibraryPanel';
import { PlaylistPanel } from './PlaylistPanel';
import { SongDetailPanel } from './SongDetailPanel';
import { SettingsDrawer } from './SettingsDrawer';
import { ReviewPanel } from './ReviewPanel';
import { ShortcutHelpModal } from './ShortcutHelpModal';
import { RevisionBrowser } from './RevisionBrowser';
import { AudioPlayerBar } from './AudioPlayerBar';

import { onGetRevisionCount } from './Moodboard.telefunc';

import type { MP3Metadata } from '../../lib/mp3-metadata';
import type { TagCategory } from './moodboard-constants';
import type { Connection } from '@xyflow/react';
import type { EdgeType } from './edges/WeightedEdge';

import './MoodboardPage.css';

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
  const [selectedCanvasKey, setSelectedCanvasKey] = useState<string | null>(null);

  // Loading
  const [loading, setLoading] = useState(true);

  // Revision browser
  const [revisionBrowserOpen, setRevisionBrowserOpen] = useState(false);
  const [revisionCount, setRevisionCount] = useState(0);

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

  // Load data on mount
  useEffect(() => {
    onLoadMoodboardState().then(() => {
      setLoading(false);
    });
    onGetRevisionCount(1).then(setRevisionCount).catch(() => {});
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

  // Global search: select a song (scroll to it if on canvas, add then scroll if not)
  const handleGlobalSearchSelect = useCallback(async (filePath: string, isOnCanvas: boolean) => {
    const nodeId = `song:${filePath}`;
    if (isOnCanvas) {
      // Scroll to existing node
      scrollToNodeRef.current?.(nodeId);
    } else {
      // Add at viewport center, then scroll to it
      const vp = moodboard.viewport;
      const centerX = (-vp.x + window.innerWidth / 2) / vp.zoom;
      const centerY = (-vp.y + window.innerHeight / 2) / vp.zoom;
      await moodboard.addSong(filePath, centerX - 60, centerY - 60);
      // Small delay for React Flow to process the new node
      setTimeout(() => scrollToNodeRef.current?.(`song:${filePath}`), 200);
    }
  }, [moodboard]);

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
              selectedCanvasKey={selectedCanvasKey}
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
              onSongSelect={handleSongSelect}
              onSelectedSongKeyChange={setSelectedCanvasKey}
              scrollToNodeRef={scrollToNodeRef}
              onMergeTags={moodboard.mergeTags}
            />
          </ReactFlowProvider>

          {/* Floating toolbar (absolute over canvas) */}
          <Group gap={4} className="moodboard-floating-toolbar">
            <Transition mounted={moodboard.saveStatus !== 'idle'} transition="fade" duration={300}>
              {(styles) => (
                <Group gap={4} style={styles}>
                  {moodboard.saveStatus === 'saving' && <IconLoader2 size={12} className="save-spinner" />}
                  {moodboard.saveStatus === 'saved' && <IconCheck size={12} color="var(--mantine-color-green-5)" />}
                </Group>
              )}
            </Transition>

            <Tooltip label={libraryPanelOpen ? 'Hide Library (⌘L)' : 'Show Library (⌘L)'} position="bottom">
              <ActionIcon size="sm" variant={libraryPanelOpen ? 'filled' : 'subtle'} color="violet"
                onClick={() => setLibraryPanelOpen(v => !v)} data-testid="toolbar-toggle-library">
                <IconLayoutSidebar size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Settings (⌘,)" position="bottom">
              <ActionIcon size="sm" variant="subtle" onClick={() => setSettingsDrawerOpen(true)} data-testid="toolbar-settings">
                <IconSettings size={14} />
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
          onScanComplete={() => {}}

        />
      </Drawer>

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

      {/* Global Search Command Palette */}
      <GlobalSearch
        opened={globalSearchOpened}
        onClose={() => setGlobalSearchOpened(false)}
        onSelectSong={handleGlobalSearchSelect}
        canvasFilePaths={canvasFilePaths}
      />

      {/* Keyboard Shortcut Help */}
      <ShortcutHelpModal
        opened={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
      />

      {/* Revision Browser */}
      <RevisionBrowser
        opened={revisionBrowserOpen}
        onClose={() => setRevisionBrowserOpen(false)}
        boardId={1}
        onRestore={() => {
          moodboard.reload();
          onGetRevisionCount(1).then(setRevisionCount).catch(() => {});
        }}
      />

      {/* Audio Player (floating at bottom) */}
      <Box style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }}>
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
