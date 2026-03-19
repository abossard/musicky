import React, { useEffect, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Box, Tooltip, Text, ActionIcon, Badge } from '@mantine/core';
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
  phases?: string[];
  onPlayToggle?: (filePath: string) => void;
  onHoverPlay?: (filePath: string) => void;
}

const NODE_SIZE = 120;
const HANDLE_PADDING = 18;
const HANDLE_SIZE = 18;

const handleStyle = (visible: boolean, position: Position): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: 999,
    border: '3px solid rgba(255,255,255,0.9)',
    background: '#7048e8',
    boxShadow: visible ? '0 0 0 6px rgba(112, 72, 232, 0.18)' : 'none',
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
    zIndex: 30,
    pointerEvents: visible ? 'auto' : 'none',
  };

  if (position === Position.Right) {
    return { ...baseStyle, right: 1, transform: 'translate(50%, -50%)' };
  }

  if (position === Position.Left) {
    return { ...baseStyle, left: 1, transform: 'translate(-50%, -50%)' };
  }

  if (position === Position.Top) {
    return { ...baseStyle, top: 1, transform: 'translate(-50%, -50%)' };
  }

  return { ...baseStyle, bottom: 1, transform: 'translate(-50%, 50%)' };
};

function SongNode({ data, selected }: NodeProps) {
  const [hovered, setHovered] = useState(false);
  const [shiftHoverTriggered, setShiftHoverTriggered] = useState(false);
  const songData = data as unknown as SongNodeData;
  const filterState = songData.filterState ?? 'normal';
  const isHidden = filterState === 'hidden';
  const isSecondary = filterState === 'secondary';
  const showHandles = hovered || selected;

  const triggerHoverPlay = () => {
    if (shiftHoverTriggered) return;
    setShiftHoverTriggered(true);
    songData.onHoverPlay?.(songData.filePath);
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    songData.onPlayToggle?.(songData.filePath);
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    setHovered(true);
    if (e.shiftKey) {
      triggerHoverPlay();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      triggerHoverPlay();
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setShiftHoverTriggered(false);
  };

  useEffect(() => {
    if (!hovered) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        triggerHoverPlay();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        setShiftHoverTriggered(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hovered, shiftHoverTriggered, songData.filePath, songData.onHoverPlay]);

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
        w={NODE_SIZE + HANDLE_PADDING * 2}
        h={NODE_SIZE + HANDLE_PADDING * 2}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={songData.isPlaying ? 'song-node-playing' : undefined}
        style={{
          position: 'relative',
          transition: 'all 0.3s ease',
          opacity: isHidden ? 0.08 : isSecondary ? 0.5 : 1,
          filter: isSecondary ? 'grayscale(0.8) brightness(0.7)' : isHidden ? 'grayscale(1) brightness(0.3)' : 'none',
          transform: isHidden ? 'scale(0.8)' : hovered ? 'scale(1.02)' : 'none',
          overflow: 'visible',
        }}
      >
        <Box
          className="song-node-inner"
          w={NODE_SIZE}
          h={NODE_SIZE}
          style={{
            position: 'absolute',
            top: HANDLE_PADDING,
            left: HANDLE_PADDING,
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
                : hovered
                  ? '0 0 10px rgba(112, 72, 232, 0.3)'
                  : '0 2px 8px rgba(0,0,0,0.3)',
            cursor: 'grab',
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
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
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              <ActionIcon
                variant="filled"
                color={songData.isPlaying ? 'green' : 'violet'}
                size="xl"
                radius="xl"
                onClick={handlePlay}
                style={{ pointerEvents: 'auto' }}
              >
                {songData.isPlaying
                  ? <IconPlayerPause size={24} />
                  : <IconPlayerPlay size={24} />}
              </ActionIcon>
            </Box>
          )}

          {/* Phase badges */}
          {songData.phases && songData.phases.length > 0 && (
            <Box
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                display: 'flex',
                gap: 2,
                zIndex: 5,
                pointerEvents: 'none',
              }}
            >
              {songData.phases.slice(0, 2).map(phase => (
                <Badge
                  key={phase}
                  size="xs"
                  variant="filled"
                  color="violet"
                  style={{ fontSize: 9, padding: '0 4px', height: 16, textTransform: 'capitalize' }}
                >
                  {phase}
                </Badge>
              ))}
            </Box>
          )}
        </Box>

        <Handle type="source" position={Position.Right} id="right" style={handleStyle(showHandles, Position.Right)} />
        <Handle type="target" position={Position.Left} id="left" style={handleStyle(showHandles, Position.Left)} />
        <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle(showHandles, Position.Bottom)} />
        <Handle type="target" position={Position.Top} id="top" style={handleStyle(showHandles, Position.Top)} />
      </Box>
    </Tooltip>
  );
}

export default React.memo(SongNode);
