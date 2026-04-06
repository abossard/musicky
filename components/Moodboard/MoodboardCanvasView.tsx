import { useState, useCallback, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Box } from '@mantine/core';
import { MoodboardCanvas } from './MoodboardCanvas';
import { MoodboardSearch } from './MoodboardSearch';
import { useMoodboardState } from './hooks/useMoodboardState';
import type { EdgeType } from './edges/WeightedEdge';
import type { TagCategory } from '../../lib/types';
import type { Connection, Edge } from '@xyflow/react';

interface MoodboardCanvasViewProps {
  currentPlayingPath?: string | null;
  onPlaySong: (filePath: string) => void;
}

export function MoodboardCanvasView({ currentPlayingPath, onPlaySong }: MoodboardCanvasViewProps) {
  const state = useMoodboardState(currentPlayingPath);
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollToNodeRef = useRef<((nodeId: string) => void) | null>(null);

  const handleConnect = useCallback(async (connection: Connection, edgeType: EdgeType, weight: number): Promise<Edge | null> => {
    const edge = await state.connectNodes(connection.source, connection.target, edgeType, weight);
    return edge;
  }, [state.connectNodes]);

  const handleAddTag = useCallback((label: string, category: TagCategory, color: string, x: number, y: number) => {
    state.addTag(label, category, color, x, y);
  }, [state.addTag]);

  const handleAddSong = useCallback((filePath: string, x: number, y: number) => {
    state.addSong(filePath, x, y);
  }, [state.addSong]);

  const handleSearchAddSong = useCallback(async (filePath: string): Promise<string | null> => {
    await state.addSong(filePath, Math.random() * 600, Math.random() * 400);
    return `song:${filePath}`;
  }, [state.addSong]);

  if (state.loading) {
    return <Box p="xl" ta="center" c="dimmed">Loading moodboard…</Box>;
  }

  return (
    <ReactFlowProvider>
      <Box style={{ flex: 1, position: 'relative' }}>
        <MoodboardCanvas
          nodes={state.nodes}
          edges={state.edges}
          onNodesChange={state.onNodesChange}
          onEdgesChange={state.onEdgesChange}
          viewport={state.viewport}
          onViewportChange={state.onViewportChange}
          onConnect={handleConnect}
          onNodeDelete={state.removeNode}
          onEdgeDelete={state.removeEdge}
          onEdgeWeightChange={state.setEdgeWeight}
          onEdgeTypeChange={state.setEdgeType}
          onSearchOpen={() => setSearchOpen(true)}
          onAddTag={handleAddTag}
          onPlaySong={onPlaySong}
          onHoverPlaySong={onPlaySong}
          onNodesUpdate={state.setNodes}
          onAddSong={handleAddSong}
          onMergeTags={state.mergeTags}
          onReassignSongTag={state.reassignSongTag}
          scrollToNodeRef={scrollToNodeRef}
        />
        {searchOpen && (
          <MoodboardSearch
            opened={searchOpen}
            onClose={() => setSearchOpen(false)}
            onAddSong={handleSearchAddSong}
            checkOnBoard={state.checkSongOnBoard}
            searchSongs={state.searchSongs}
          />
        )}
      </Box>
    </ReactFlowProvider>
  );
}
