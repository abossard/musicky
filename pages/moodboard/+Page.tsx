import React, { useState, useEffect, useCallback } from 'react';
import { Group, Select, Button, Text, Box, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconMusic } from '@tabler/icons-react';
import { ReactFlowProvider } from '@xyflow/react';
import { MoodboardCanvas } from '../../components/Moodboard/MoodboardCanvas';
import { MoodboardSearch } from '../../components/Moodboard/MoodboardSearch';
import { useMoodboardState } from '../../components/Moodboard/hooks/useMoodboardState';
import { onGetMoodboards, onCreateMoodboard } from '../../components/Moodboard/Moodboard.telefunc';
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
    const name = `Board ${new Date().toLocaleDateString()}`;
    const board = await onCreateMoodboard(name);
    setBoards(prev => [{ id: board.id, name: board.name }, ...prev]);
    setSelectedBoardId(board.id);
  };

  const handlePlaySong = useCallback((filePath: string) => {
    const node = moodboard.nodes.find(n => (n.data as any).filePath === filePath);
    const meta: MP3Metadata = {
      filePath,
      title: (node?.data as any)?.title || 'Unknown',
      artist: (node?.data as any)?.artist || 'Unknown',
    };
    audioQueue.playTrack(meta);
  }, [moodboard.nodes, audioQueue]);

  const handleAddSong = useCallback(async (songPath: string) => {
    const existingCount = moodboard.nodes.length;
    const cols = 5;
    const spacing = 180;
    const col = existingCount % cols;
    const row = Math.floor(existingCount / cols);
    return moodboard.addSong(songPath, col * spacing + Math.random() * 30, row * spacing + Math.random() * 30);
  }, [moodboard]);

  const handleConnect = useCallback((connection: Connection, edgeType: EdgeType, weight: number) => {
    moodboard.connectNodes(connection, edgeType, weight);
  }, [moodboard]);

  const handleAddTag = useCallback((label: string, category: TagCategory, color: string) => {
    const tagCount = moodboard.nodes.filter(n => n.type === 'tag').length;
    moodboard.addTag(label, category, color, -200 + tagCount * 50, tagCount * 80);
  }, [moodboard]);

  const isPlaying = audioQueue.currentTrack != null;

  return (
    <Box style={{ height: 'calc(100vh - 90px)', display: 'flex', flexDirection: 'column' }}>
      {/* Compact header bar */}
      <Group
        justify="space-between"
        px="xs"
        py={4}
        style={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0, minHeight: 36 }}
      >
        <Group gap={6}>
          <Select
            data={boards.map(b => ({ value: b.id.toString(), label: b.name }))}
            value={selectedBoardId?.toString() || null}
            onChange={(v) => setSelectedBoardId(v ? parseInt(v) : null)}
            placeholder="Board"
            size="xs"
            style={{ width: 160 }}
          />
          <ActionIcon size="sm" variant="subtle" onClick={handleCreateBoard} title="New board">
            <IconPlus size={14} />
          </ActionIcon>
        </Group>
        {/* Mini now-playing indicator */}
        {isPlaying && (
          <Group gap={6}>
            <IconMusic size={12} color="var(--mantine-color-green-5)" />
            <Text size="xs" c="dimmed" lineClamp={1} style={{ maxWidth: 200 }}>
              {audioQueue.currentTrack?.title}
            </Text>
            <audio
              src={`/audio/${encodeURIComponent(audioQueue.currentTrack!.filePath)}`}
              autoPlay
              onEnded={() => audioQueue.setIsPlaying(false)}
              style={{ display: 'none' }}
            />
          </Group>
        )}
      </Group>

      {/* Canvas — fills all remaining space */}
      <Box style={{ flex: 1, position: 'relative', minHeight: 0 }}>
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
              onNodesUpdate={(newNodes) => moodboard.setNodes(newNodes)}
            />
          </ReactFlowProvider>
        ) : (
          <Box style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
            <Group gap="sm">
              <Text c="dimmed">No board selected</Text>
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={handleCreateBoard}>
                Create
              </Button>
            </Group>
          </Box>
        )}
      </Box>

      <MoodboardSearch
        opened={searchOpened}
        onClose={searchHandlers.close}
        onAddSong={handleAddSong}
        checkOnBoard={moodboard.checkSongOnBoard}
        searchSongs={moodboard.searchSongs}
      />
    </Box>
  );
}
