import React from 'react';
import { Group, ActionIcon, Loader } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';

export interface PlayerControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  onTogglePlayPause: () => void;
}

export function PlayerControls({
  isPlaying,
  isLoading,
  onTogglePlayPause
}: PlayerControlsProps) {
  return (
    <Group justify="center">
      <ActionIcon
        size="lg"
        variant="filled"
        color="violet"
        onClick={onTogglePlayPause}
        disabled={isLoading}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? (
          <Loader size="sm" color="white" />
        ) : isPlaying ? (
          <IconPlayerPause size={20} />
        ) : (
          <IconPlayerPlay size={20} />
        )}
      </ActionIcon>
    </Group>
  );
}
