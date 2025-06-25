import React, { useState, useCallback } from 'react';
import { Box, Group, Text, Slider } from '@mantine/core';
import { formatTime } from '../../lib/format-utils';

export interface ProgressBarProps {
  currentTime: number;
  duration: number;
  isLoading: boolean;
  onSeek: (time: number) => void;
  mb?: string | number;
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
  mb
}: ProgressBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  const displayTime = isDragging ? dragTime : currentTime;
  const marks = generateMarks(duration);

  const handleChange = useCallback((value: number) => {
    setIsDragging(true);
    setDragTime(value);
  }, []);

  const handleChangeEnd = useCallback((value: number) => {
    setIsDragging(false);
    onSeek(value);
  }, [onSeek]);

  return (
    <Box mb={mb}>
      {/* Time display */}
      <Group justify="space-between" mb="xs">
        <Text size="xs" c="dimmed">
          {formatTime(displayTime)}
        </Text>
        <Text size="xs" c="dimmed">
          {formatTime(duration)}
        </Text>
      </Group>

      {/* Slider */}
      <Slider
        value={isDragging ? dragTime : currentTime}
        min={0}
        max={duration || 100}
        step={0.1}
        marks={marks}
        disabled={isLoading || duration === 0}
        onChange={handleChange}
        onChangeEnd={handleChangeEnd}
        color="violet"
        size="sm"
        thumbSize={27}
        label={formatTime}
        styles={{
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
            height: '6px',
          },
          bar: {
            height: '6px',
          },
        }}
      />
    </Box>
  );
}
