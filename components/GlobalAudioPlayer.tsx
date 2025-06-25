import React from 'react';
import { Paper, Group, Text, Box } from '@mantine/core';
import { IconMusic } from '@tabler/icons-react';
import { AudioPlayer } from './AudioPlayer';
import type { MP3Metadata } from '../lib/mp3-metadata';

export interface GlobalAudioPlayerProps {
  currentTrack: MP3Metadata | null;
  isPlaying: boolean;
  volume: number;
  savedPosition?: number;
  onPlayPauseChange: (playing: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onTimeUpdate?: (time: number) => void;
  onError?: (error: string) => void;
  onEnded?: () => void;
}

export function GlobalAudioPlayer({
  currentTrack,
  isPlaying,
  volume,
  savedPosition,
  onPlayPauseChange,
  onVolumeChange,
  onTimeUpdate,
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
    audioSrc,
    savedPosition
  });

  return (
    <Paper shadow="sm" p="lg" mb="md" withBorder>
      <Box>
        <Text size="sm" c="dimmed" mb="xs">Now Playing</Text>
        <AudioPlayer
          src={audioSrc}
          title={currentTrack.title || 'Unknown Title'}
          artist={currentTrack.artist || 'Unknown Artist'}
          autoPlay={true} // Always autoplay when a new track is selected
          externalIsPlaying={isPlaying}
          externalVolume={volume}
          initialPosition={savedPosition}
          onPlayStateChange={onPlayPauseChange}
          onVolumeChange={onVolumeChange}
          onTimeUpdate={onTimeUpdate}
          onError={onError}
          onEnded={onEnded}
        />
      </Box>
    </Paper>
  );
}
