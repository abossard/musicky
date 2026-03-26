import React from 'react';
import { Paper, Group, Text, Badge, Image, Box } from '@mantine/core';
import { getCamelotColor } from '../../lib/camelot';

export interface SongCardData {
  filePath: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  camelotKey?: string;
  bpm?: number;
  energyLevel?: number;
  genres: string[];
  moods: string[];
  phase?: string;
}

interface SongCardProps {
  song: SongCardData;
  isSelected: boolean;
  isPlaying: boolean;
  isFocused?: boolean;
  isInSelection?: boolean;
  isLocked?: boolean;
  isReadOnly?: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  compact?: boolean;
}

const TAG_COLORS: Record<string, string> = {
  genre: 'cyan',
  mood: 'pink',
};

function SongCardInner({ song, isSelected, isPlaying, isFocused, isInSelection, isLocked, isReadOnly, onClick, onDoubleClick, onDragStart, compact }: SongCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isFocused]);
  const keyColor = song.camelotKey ? getCamelotColor(song.camelotKey) : undefined;
  const energyColor = song.energyLevel
    ? song.energyLevel >= 8 ? 'red' : song.energyLevel >= 5 ? 'orange' : 'green'
    : undefined;

  return (
    <Paper
      ref={cardRef}
      p={compact ? 6 : 8}
      radius="sm"
      draggable={!isReadOnly}
      onDragStart={(e) => {
        if (isReadOnly) { e.preventDefault(); return; }
        e.dataTransfer.setData('application/x-setview-song', song.filePath);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(e);
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      data-testid={isFocused ? 'song-card-focused' : 'set-song-card'}
      style={{
        cursor: isReadOnly ? 'default' : 'grab',
        opacity: isReadOnly ? 0.6 : undefined,
        border: isFocused
          ? '2px dashed var(--mantine-color-yellow-5)'
          : isInSelection
            ? '2px solid var(--mantine-color-blue-5)'
            : isSelected
              ? '2px solid var(--mantine-color-violet-5)'
              : '1px solid var(--mantine-color-dark-4)',
        background: isLocked && isInSelection
          ? 'rgba(59, 130, 246, 0.12)'
          : isPlaying
            ? 'rgba(64, 192, 87, 0.08)'
            : isInSelection
              ? 'rgba(59, 130, 246, 0.06)'
              : isSelected
                ? 'rgba(124, 58, 237, 0.08)'
                : 'var(--mantine-color-dark-6)',
        transition: 'border-color 0.15s, background 0.15s',
        userSelect: 'none',
      }}
    >
      <Group gap={8} wrap="nowrap" align="flex-start">
        {/* Artwork thumbnail */}
        <Image
          src={song.artworkUrl || undefined}
          fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23333'/%3E%3C/svg%3E"
          w={40}
          h={40}
          radius={4}
          fit="cover"
          style={{ flexShrink: 0 }}
        />

        {/* Song info */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" fw={600} truncate="end" lh={1.2}>
            {song.title || 'Unknown'}
          </Text>
          <Text size="xs" c="dimmed" truncate="end" lh={1.3}>
            {song.artist || 'Unknown Artist'}
          </Text>

          {/* Metadata row: key, BPM, energy */}
          <Group gap={4} mt={2}>
            {song.camelotKey && (
              <Badge size="xs" variant="filled" radius="sm"
                style={{ background: keyColor, color: '#fff', fontSize: 9, padding: '0 4px' }}>
                {song.camelotKey}
              </Badge>
            )}
            {song.bpm && (
              <Text size="xs" c="dimmed" span style={{ fontSize: 10 }}>
                {Math.round(song.bpm)}
              </Text>
            )}
            {song.energyLevel && (
              <Badge size="xs" variant="dot" color={energyColor} style={{ fontSize: 9 }}>
                E{song.energyLevel}
              </Badge>
            )}
          </Group>

          {/* Genre/mood pills */}
          {(song.genres.length > 0 || song.moods.length > 0) && (
            <Group gap={3} mt={3} wrap="wrap">
              {song.genres.map(g => (
                <Badge key={`g-${g}`} size="xs" variant="light" color={TAG_COLORS.genre}
                  style={{ fontSize: 8, padding: '0 4px', height: 14 }}>
                  {g}
                </Badge>
              ))}
              {song.moods.map(m => (
                <Badge key={`m-${m}`} size="xs" variant="light" color={TAG_COLORS.mood}
                  style={{ fontSize: 8, padding: '0 4px', height: 14 }}>
                  {m}
                </Badge>
              ))}
            </Group>
          )}
        </Box>
      </Group>
    </Paper>
  );
}

export const SongCard = React.memo(SongCardInner);
