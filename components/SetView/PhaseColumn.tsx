import React, { useState, useCallback } from 'react';
import { Stack, Text, Group, Badge, Box, ScrollArea } from '@mantine/core';
import { SongCard, type SongCardData } from './SongCard';

interface PhaseColumnProps {
  phase: string;
  songs: SongCardData[];
  selectedSong: string | null;
  selectedSongs?: ReadonlySet<string>;
  focusedSong?: string | null;
  isLocked?: boolean;
  playingSong: string | null;
  groupBy: 'none' | 'genre' | 'mood';
  onSongClick: (filePath: string) => void;
  onSongDoubleClick: (filePath: string) => void;
  onDrop: (filePath: string, targetPhase: string) => void;
  color?: string;
}

const PHASE_COLORS: Record<string, string> = {
  opener: 'violet', buildup: 'indigo', peak: 'red',
  cooldown: 'teal', closer: 'gray', feature: 'orange',
};

function PhaseColumnInner({
  phase, songs, selectedSong, selectedSongs, focusedSong, isLocked: columnLocked,
  playingSong, groupBy,
  onSongClick, onSongDoubleClick, onDrop, color,
}: PhaseColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const phaseColor = color || PHASE_COLORS[phase.toLowerCase()] || 'gray';

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-setview-song')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as globalThis.Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const filePath = e.dataTransfer.getData('application/x-setview-song');
    if (filePath) onDrop(filePath, phase);
  }, [phase, onDrop]);

  // Sub-group songs if groupBy is set
  const renderSongs = () => {
    if (groupBy === 'none' || songs.length === 0) {
      return songs.map(song => (
        <SongCard
          key={song.filePath}
          song={song}
          isSelected={selectedSong === song.filePath}
          isPlaying={playingSong === song.filePath}
          isFocused={focusedSong === song.filePath}
          isInSelection={selectedSongs?.has(song.filePath) ?? false}
          isLocked={columnLocked}
          onClick={() => onSongClick(song.filePath)}
          onDoubleClick={() => onSongDoubleClick(song.filePath)}
          onDragStart={() => {}}
        />
      ));
    }

    // Group by genre or mood
    const groups = new Map<string, SongCardData[]>();
    const ungrouped: SongCardData[] = [];
    for (const song of songs) {
      const tags = groupBy === 'genre' ? song.genres : song.moods;
      if (tags.length === 0) {
        ungrouped.push(song);
      } else {
        // Use first tag as primary group
        const key = tags[0];
        const arr = groups.get(key) || [];
        arr.push(song);
        groups.set(key, arr);
      }
    }

    const groupColor = groupBy === 'genre' ? 'cyan' : 'pink';

    return (
      <>
        {[...groups.entries()].map(([label, groupSongs]) => (
          <Box key={label} style={{
            borderLeft: `3px solid var(--mantine-color-${groupColor}-7)`,
            paddingLeft: 8,
            marginBottom: 4,
          }}>
            <Text size="xs" fw={600} c={groupColor} mb={2} tt="capitalize">
              {label}
            </Text>
            <Stack gap={4}>
              {groupSongs.map(song => (
                <SongCard
                  key={song.filePath}
                  song={song}
                  isSelected={selectedSong === song.filePath}
                  isPlaying={playingSong === song.filePath}
                  isFocused={focusedSong === song.filePath}
                  isInSelection={selectedSongs?.has(song.filePath) ?? false}
                  isLocked={columnLocked}
                  onClick={() => onSongClick(song.filePath)}
                  onDoubleClick={() => onSongDoubleClick(song.filePath)}
                  onDragStart={() => {}}
                  compact
                />
              ))}
            </Stack>
          </Box>
        ))}
        {ungrouped.length > 0 && (
          <Box style={{ borderLeft: '3px solid var(--mantine-color-dark-4)', paddingLeft: 8 }}>
            <Text size="xs" c="dimmed" mb={2}>other</Text>
            <Stack gap={4}>
              {ungrouped.map(song => (
                <SongCard
                  key={song.filePath}
                  song={song}
                  isSelected={selectedSong === song.filePath}
                  isPlaying={playingSong === song.filePath}
                  isFocused={focusedSong === song.filePath}
                  isInSelection={selectedSongs?.has(song.filePath) ?? false}
                  isLocked={columnLocked}
                  onClick={() => onSongClick(song.filePath)}
                  onDoubleClick={() => onSongDoubleClick(song.filePath)}
                  onDragStart={() => {}}
                  compact
                />
              ))}
            </Stack>
          </Box>
        )}
      </>
    );
  };

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid={`phase-column-${phase}`}
      style={{
        flex: '1 1 0',
        minWidth: 200,
        maxWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--mantine-color-dark-5)',
        background: isDragOver ? 'rgba(124,58,237,0.06)' : undefined,
        transition: 'background 0.15s',
      }}
    >
      {/* Column header */}
      <Group gap={6} px={10} py={8} style={{
        borderBottom: `2px solid var(--mantine-color-${phaseColor}-7)`,
        background: `rgba(var(--mantine-color-${phaseColor}-light-color), 0.05)`,
        flexShrink: 0,
      }}>
        <Text size="sm" fw={700} tt="uppercase" c={phaseColor} style={{ letterSpacing: 1 }}>
          {phase}
        </Text>
        <Badge size="xs" variant="filled" color={phaseColor}>{songs.length}</Badge>
      </Group>

      {/* Song list */}
      <ScrollArea style={{ flex: 1 }} p={6}>
        <Stack gap={4}>
          {songs.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="xl">
              Drop songs here
            </Text>
          ) : (
            renderSongs()
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}

export const PhaseColumn = React.memo(PhaseColumnInner);
