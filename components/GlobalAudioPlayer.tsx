import React from 'react';
import { Paper, Group, Text, Box } from '@mantine/core';
import { IconMusic } from '@tabler/icons-react';
import { AudioPlayer } from './AudioPlayer';
import type { MP3Metadata } from '../lib/mp3-metadata';

export interface GlobalAudioPlayerProps {
  currentTrack: MP3Metadata | null;
  isPlaying: boolean;
  volume: number;
  onPlayPauseChange: (playing: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onError?: (error: string) => void;
  onEnded?: () => void;
}

export function GlobalAudioPlayer({
  currentTrack,
  isPlaying,
  volume,
  onPlayPauseChange,
  onVolumeChange,
  onError,
  onEnded
}: GlobalAudioPlayerProps) {
  if (!currentTrack) {
    return (
      <Paper shadow="sm" p="md" mb="md" withBorder>
        <Group gap="sm">
          <IconMusic size={20} color="gray" />
          <Text c="dimmed">No track selected - Click on any track in the library to start playing</Text>
        </Group>
      </Paper>
    );
  }

  // Convert file path to audio URL
  const audioSrc = `/audio/${encodeURIComponent(currentTrack.filePath)}`;
  console.log('GlobalAudioPlayer rendering with:', {
    currentTrack: currentTrack.title || currentTrack.filePath,
    isPlaying,
    audioSrc
  });

  return (
    <Paper shadow="sm" p="lg" mb="md" withBorder>
      <Box>
        <Text size="sm" c="dimmed" mb="xs">Now Playing</Text>
        <AudioPlayer
          src={audioSrc}
          title={currentTrack.title || 'Unknown Title'}
          artist={currentTrack.artist || 'Unknown Artist'}
          externalIsPlaying={isPlaying}
          externalVolume={volume}
          onPlayStateChange={onPlayPauseChange}
          onVolumeChange={onVolumeChange}
          onError={onError}
          onEnded={onEnded}
        />
      </Box>
    </Paper>
  );
}
