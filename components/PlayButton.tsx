import React from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause, IconMusic } from '@tabler/icons-react';
import type { MP3Metadata } from '../lib/mp3-metadata';

export interface PlayButtonProps {
  track: MP3Metadata;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  onPlayTrack: (track: MP3Metadata) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export function PlayButton({
  track,
  isCurrentTrack,
  isPlaying,
  onPlayTrack,
  size = 'sm'
}: PlayButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click if this is in a table
    onPlayTrack(track);
  };

  const getIcon = () => {
    if (isCurrentTrack && isPlaying) {
      return <IconPlayerPause size={16} />;
    }
    return <IconPlayerPlay size={16} />;
  };

  const getTooltip = () => {
    if (isCurrentTrack && isPlaying) {
      return 'Pause';
    }
    if (isCurrentTrack) {
      return 'Resume';
    }
    return 'Play';
  };

  return (
    <Tooltip label={getTooltip()}>
      <ActionIcon
        variant={isCurrentTrack ? 'filled' : 'subtle'}
        color={isCurrentTrack ? 'violet' : 'gray'}
        size={size}
        onClick={handleClick}
        aria-label={getTooltip()}
      >
        {getIcon()}
      </ActionIcon>
    </Tooltip>
  );
}
