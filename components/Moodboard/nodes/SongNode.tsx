import React, { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, Tooltip, Text, ActionIcon } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';

export type FilterState = 'normal' | 'primary' | 'secondary' | 'hidden';

export interface SongNodeData {
  type: 'song';
  filePath: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  artworkUrl: string;
  isPlaying?: boolean;
  filterState?: FilterState;
  onPlay?: (filePath: string) => void;
}

const NODE_SIZE = 120;

function SongNode({ data, selected }: NodeProps) {
  const [hovered, setHovered] = useState(false);
  const songData = data as unknown as SongNodeData;
  const filterState = songData.filterState ?? 'normal';
  const isHidden = filterState === 'hidden';
  const isSecondary = filterState === 'secondary';

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    songData.onPlay?.(songData.filePath);
  };

  return (
    <Tooltip
      label={
        <Box>
          <Text fw={700} size="sm">{songData.title || 'Unknown'}</Text>
          <Text size="xs" c="dimmed">{songData.artist || 'Unknown Artist'}</Text>
          {songData.album && <Text size="xs" c="dimmed">{songData.album}</Text>}
        </Box>
      }
      position="top"
      withArrow
      openDelay={300}
    >
      <Box
        w={NODE_SIZE}
        h={NODE_SIZE}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderRadius: 8,
          overflow: 'hidden',
          border: songData.isPlaying
            ? '3px solid var(--mantine-color-green-5)'
            : selected
              ? '3px solid var(--mantine-color-violet-5)'
              : '2px solid var(--mantine-color-dark-4)',
          boxShadow: songData.isPlaying
            ? '0 0 16px var(--mantine-color-green-5)'
            : selected
              ? '0 0 12px var(--mantine-color-violet-5)'
              : '0 2px 8px rgba(0,0,0,0.3)',
          position: 'relative',
          cursor: 'grab',
          transition: 'all 0.3s ease',
          opacity: isHidden ? 0.08 : isSecondary ? 0.5 : 1,
          filter: isSecondary ? 'grayscale(0.8) brightness(0.7)' : isHidden ? 'grayscale(1) brightness(0.3)' : 'none',
          transform: isHidden ? 'scale(0.8)' : 'none',
        }}
      >
        <img
          src={songData.artworkUrl}
          alt={songData.title}
          width={NODE_SIZE}
          height={NODE_SIZE}
          style={{ objectFit: 'cover', display: 'block' }}
          draggable={false}
        />

        {/* Song title + artist label at bottom */}
        <Box
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 6px 4px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
            pointerEvents: 'none',
          }}
        >
          <Text size="xs" fw={700} c="white" lineClamp={1} style={{ lineHeight: 1.2 }}>
            {songData.title || 'Unknown'}
          </Text>
          <Text size="10px" c="rgba(255,255,255,0.6)" lineClamp={1} style={{ lineHeight: 1.2 }}>
            {songData.artist || ''}
          </Text>
        </Box>

        {/* Play button overlay on hover */}
        {hovered && (
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'grid',
              placeItems: 'center',
              transition: 'opacity 0.15s',
            }}
          >
            <ActionIcon
              variant="filled"
              color={songData.isPlaying ? 'green' : 'violet'}
              size="xl"
              radius="xl"
              onClick={handlePlay}
            >
              {songData.isPlaying
                ? <IconPlayerPause size={24} />
                : <IconPlayerPlay size={24} />}
            </ActionIcon>
          </Box>
        )}

        <Handle type="source" position={Position.Right} id="right" style={{ background: '#7048e8', width: 8, height: 8, opacity: hovered ? 1 : 0 }} />
        <Handle type="target" position={Position.Left} id="left" style={{ background: '#7048e8', width: 8, height: 8, opacity: hovered ? 1 : 0 }} />
        <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#7048e8', width: 8, height: 8, opacity: hovered ? 1 : 0 }} />
        <Handle type="target" position={Position.Top} id="top" style={{ background: '#7048e8', width: 8, height: 8, opacity: hovered ? 1 : 0 }} />
      </Box>
    </Tooltip>
  );
}

export default React.memo(SongNode);
