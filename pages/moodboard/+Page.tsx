import React, { useState, useEffect, useCallback } from 'react';
import { Stack, Group, Title, Select, Button, Text, Paper, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutBoard, IconPlus } from '@tabler/icons-react';
import { ReactFlowProvider } from '@xyflow/react';
import { MoodboardCanvas } from '../../components/Moodboard/MoodboardCanvas';
import { MoodboardSearch } from '../../components/Moodboard/MoodboardSearch';
import { useMoodboardState } from '../../components/Moodboard/hooks/useMoodboardState';
import { onGetMoodboards, onCreateMoodboard } from '../../components/Moodboard/Moodboard.telefunc';
import { GlobalAudioPlayer } from '../../components/GlobalAudioPlayer';
import { useAudioQueue } from '../../hooks/useAudioQueue';
import type { MP3Metadata } from '../../lib/mp3-metadata';
import type { TagCategory } from '../../components/Moodboard/nodes/TagNode';
import type { Connection } from '@xyflow/react';
import type { EdgeType } from '../../components/Moodboard/edges/WeightedEdge';

export default function MoodboardPage() {
  const [boards, setBoards] = useState<{ id: number; name: string }[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [searchOpened, searchHandlers] = useDisclosure(false);
  const audioQueue = useAudioQueue();

  const moodboard = useMoodboardState(selectedBoardId, audioQueue.currentTrack?.filePath);

  useEffect(() => {
    onGetMoodboards().then(b => {
      setBoards(b.map(x => ({ id: x.id, name: x.name })));
      if (b.length > 0 && !selectedBoardId) setSelectedBoardId(b[0].id);
    });
  }, []);

  const handleCreateBoard = async () => {
    const name = `Moodboard ${new Date().toLocaleDateString()}`;
    const board = await onCreateMoodboard(name);
    setBoards(prev => [{ id: board.id, name: board.name }, ...prev]);
    setSelectedBoardId(board.id);
  };

  const handlePlaySong = useCallback((filePath: string) => {
    const meta: MP3Metadata = {
      filePath,
      title: moodboard.nodes.find(n => (n.data as any).filePath === filePath)?.data?.title as string || 'Unknown',
      artist: moodboard.nodes.find(n => (n.data as any).filePath === filePath)?.data?.artist as string || 'Unknown',
    };
    audioQueue.playTrack(meta);
  }, [moodboard.nodes, audioQueue]);

  const handleAddSong = useCallback(async (songPath: string) => {
    // Smart placement: grid-like spread based on how many nodes exist
    const existingCount = moodboard.nodes.length;
    const cols = 5;
    const spacing = 180;
    const col = existingCount % cols;
    const row = Math.floor(existingCount / cols);
    const jitterX = Math.random() * 30 - 15;
    const jitterY = Math.random() * 30 - 15;
    const posX = col * spacing + jitterX;
    const posY = row * spacing + jitterY;
    return moodboard.addSong(songPath, posX, posY);
  }, [moodboard]);

  const handleConnect = useCallback((connection: Connection, edgeType: EdgeType, weight: number) => {
    moodboard.connectNodes(connection, edgeType, weight);
  }, [moodboard]);

  const handleAddTag = useCallback((label: string, category: TagCategory, color: string, _x: number, _y: number) => {
    const tagCount = moodboard.nodes.filter(n => n.type === 'tag').length;
    const posX = -200 + tagCount * 50;
    const posY = tagCount * 80;
    moodboard.addTag(label, category, color, posX, posY);
  }, [moodboard]);

  return (
    <Stack gap={0} style={{ height: 'calc(100vh - 60px)' }}>
      {/* Header */}
      <Group justify="space-between" px="md" py="xs" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
        <Group gap="sm">
          <IconLayoutBoard size={20} />
          <Title order={4}>Moodboard</Title>
        </Group>
        <Group gap="sm">
          <Select
            data={boards.map(b => ({ value: b.id.toString(), label: b.name }))}
            value={selectedBoardId?.toString() || null}
            onChange={(v) => setSelectedBoardId(v ? parseInt(v) : null)}
            placeholder="Select board"
            size="sm"
            style={{ width: 200 }}
          />
          <Button size="sm" variant="light" leftSection={<IconPlus size={14} />} onClick={handleCreateBoard}>
            New Board
          </Button>
        </Group>
      </Group>

      {/* Canvas */}
      <Box style={{ flex: 1, position: 'relative' }}>
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
              onSearchOpen={searchHandlers.open}
              onAddTag={handleAddTag}
              onPlaySong={handlePlaySong}
            />
          </ReactFlowProvider>
        ) : (
          <Box style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
            <Stack align="center" gap="md">
              <IconLayoutBoard size={64} color="var(--mantine-color-violet-4)" />
              <Text size="lg" c="dimmed">Create a moodboard to start organizing your music</Text>
              <Button leftSection={<IconPlus size={16} />} onClick={handleCreateBoard}>
                Create Moodboard
              </Button>
            </Stack>
          </Box>
        )}
      </Box>

      {/* Docked audio player */}
      <Box px="md" py="xs" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
        <GlobalAudioPlayer
          currentTrack={audioQueue.currentTrack}
          isPlaying={audioQueue.isPlaying}
          volume={audioQueue.volume}
          onPlayPauseChange={audioQueue.setIsPlaying}
          onVolumeChange={audioQueue.setVolume}
          onEnded={() => audioQueue.setIsPlaying(false)}
        />
      </Box>

      {/* Song search modal */}
      <MoodboardSearch
        opened={searchOpened}
        onClose={searchHandlers.close}
        onAddSong={handleAddSong}
        checkOnBoard={moodboard.checkSongOnBoard}
        searchSongs={moodboard.searchSongs}
      />
    </Stack>
  );
}
