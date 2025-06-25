import React, { useState, useRef, useCallback } from 'react';
import { Box, Progress, Group, Text } from '@mantine/core';

export interface ProgressBarProps {
  currentTime: number;
  duration: number;
  isLoading: boolean;
  onSeek: (time: number) => void;
  mb?: string | number;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function ProgressBar({
  currentTime,
  duration,
  isLoading,
  onSeek,
  mb
}: ProgressBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayTime = isDragging ? dragTime : currentTime;

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!progressRef.current || isLoading || duration === 0) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = Math.max(0, Math.min(duration, percentage * duration));
    
    onSeek(newTime);
  }, [duration, isLoading, onSeek]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!progressRef.current || isLoading || duration === 0) return;

    setIsDragging(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!progressRef.current) return;
      
      const rect = progressRef.current.getBoundingClientRect();
      const moveX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, moveX / rect.width));
      const newTime = percentage * duration;
      
      setDragTime(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onSeek(dragTime);
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Initial position
    handleMouseMove(event.nativeEvent);
  }, [duration, isLoading, onSeek, dragTime]);

  return (
    <Box mb={mb}>
      {/* Progress bar */}
      <Box
        ref={progressRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        className={`progress-bar-container ${isLoading || duration === 0 ? 'disabled' : ''}`}
      >
        <Progress
          value={isDragging ? (dragTime / duration) * 100 : progress}
          size="sm"
          color="violet"
          className={isDragging ? 'progress-bar-instant' : 'progress-bar-smooth'}
        />
      </Box>

      {/* Time display */}
      <Group justify="space-between" mt={4}>
        <Text size="xs" c="dimmed">
          {formatTime(displayTime)}
        </Text>
        <Text size="xs" c="dimmed">
          {formatTime(duration)}
        </Text>
      </Group>
    </Box>
  );
}
