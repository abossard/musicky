import React, { useState, useCallback } from 'react';
import { Box, Group, Text, Slider } from '@mantine/core';
import { formatTime } from '../../lib/format-utils';

export interface ProgressBarProps {
  currentTime: number;
  duration: number;
  isLoading: boolean;
  onSeek: (time: number) => void;
  mb?: string | number;
  compact?: boolean;
}


const generateMarks = (duration: number) => {
  if (!duration || duration <= 0 || duration <= 120) return [];
  
  const maxMarks = 10;
  const interval = Math.ceil(duration / maxMarks / 60) * 60;
  const markCount = Math.floor(duration / interval);
  
  return Array.from({ length: markCount }, (_, i) => {
    const value = interval * (i + 1);
    return value < duration ? { value, label: formatTime(value) } : null;
  }).filter(Boolean) as { value: number; label: string }[];
};

export function ProgressBar({
  currentTime,
  duration,
  isLoading,
  onSeek,
  mb,
  compact = false,
}: ProgressBarProps) {
  const [seekingTo, setSeekingTo] = useState<number | null>(null);

  const displayTime = seekingTo ?? currentTime;
  const marks = generateMarks(duration);

  const handleChange = useCallback((value: number) => {
    setSeekingTo(value);
  }, []);

  const handleChangeEnd = useCallback((value: number) => {
    // Keep showing the target position until seek is complete
    onSeek(value);
  }, [onSeek]);

  // Clear seeking state when currentTime catches up to target
  React.useEffect(() => {
    if (seekingTo !== null && Math.abs(currentTime - seekingTo) < 0.5) {
      setSeekingTo(null);
    }
  }, [currentTime, seekingTo]);

  const sliderMax = duration || 100;

  return (
    <Box mb={mb}>
      {!compact && (
        <Group justify="space-between" mb="xs">
          <Text size="xs" c="dimmed">
            {formatTime(displayTime)}
          </Text>
          <Text size="xs" c="dimmed">
            {formatTime(duration)}
          </Text>
        </Group>
      )}

      <Slider
        value={seekingTo ?? currentTime}
        min={0}
        max={sliderMax}
        step={0.1}
        marks={compact ? [] : marks}
        disabled={isLoading || duration === 0}
        onChange={handleChange}
        onChangeEnd={handleChangeEnd}
        color="violet"
        size={compact ? 'xs' : 'sm'}
        thumbSize={compact ? 14 : 27}
        label={formatTime}
        styles={{
          root: compact ? { paddingTop: 0, paddingBottom: 0 } : undefined,
          mark: {
            borderColor: 'rgba(255, 255, 255, 0.5)',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
          markLabel: {
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.8)',
            marginTop: '8px',
            fontWeight: 500,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            padding: '2px 4px',
            borderRadius: '3px',
          },
          track: {
            height: compact ? '4px' : '6px',
          },
          bar: {
            height: compact ? '4px' : '6px',
          },
        }}
      />
    </Box>
  );
}
