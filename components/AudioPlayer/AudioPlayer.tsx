import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Group, Text, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { PlayerControls } from './PlayerControls';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import './AudioPlayer.css';

export interface AudioPlayerProps {
  src: string;
  title?: string;
  artist?: string;
  autoPlay?: boolean;
  externalIsPlaying?: boolean;
  externalVolume?: number;
  initialPosition?: number;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onVolumeChange?: (volume: number) => void;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  onError?: (error: string) => void;
}

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  error: string | null;
  isSeeking: boolean;
}

export function AudioPlayer({
  src,
  title = 'Unknown Track',
  artist = 'Unknown Artist',
  autoPlay = false,
  externalIsPlaying,
  externalVolume,
  initialPosition,
  onPlayStateChange,
  onVolumeChange,
  onTimeUpdate,
  onEnded,
  onError
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isUpdatingRef = useRef(false); // Prevent state update loops
  
  const [state, setState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isLoading: true,
    error: null,
    isSeeking: false
  });

  // Update audio state
  const updateState = useCallback((updates: Partial<AudioState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Play/pause functionality
  const togglePlayPause = useCallback(async () => {
    if (!audioRef.current || state.isLoading) return;

    try {
      if (state.isPlaying) {
        audioRef.current.pause();
        // State will be updated by the 'pause' event listener
      } else {
        await audioRef.current.play();
        // State will be updated by the 'play' event listener
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Playback failed';
      updateState({ error: errorMessage, isPlaying: false });
      onError?.(errorMessage);
    }
  }, [state.isPlaying, state.isLoading, updateState, onError]);

  // Seeking functionality
  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    updateState({ isSeeking: true });
    audioRef.current.currentTime = Math.max(0, Math.min(time, state.duration));
    
    // Clear seeking state after a short delay
    setTimeout(() => updateState({ isSeeking: false }), 100);
  }, [state.duration, updateState]);

  // Volume control
  const setVolume = useCallback((volume: number) => {
    if (!audioRef.current) return;
    
    const clampedVolume = Math.max(0, Math.min(1, volume));
    audioRef.current.volume = clampedVolume;
    updateState({ volume: clampedVolume });
  }, [updateState]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => {
      updateState({ isLoading: true, error: null });
    };

    const handleCanPlay = () => {
      updateState({ 
        isLoading: false, 
        duration: audio.duration || 0 
      });
    };

    const handlePlay = () => {
      updateState({ isPlaying: true });
    };

    const handlePause = () => {
      updateState({ isPlaying: false });
    };

    const handleTimeUpdate = () => {
      if (!state.isSeeking) {
        updateState({ currentTime: audio.currentTime });
        onTimeUpdate?.(audio.currentTime);
      }
    };

    const handleEnded = () => {
      updateState({ isPlaying: false, currentTime: 0 });
      onEnded?.();
    };

    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      const errorMessage = target.error 
        ? `Audio error: ${target.error.message}` 
        : 'Unknown audio error';
      
      updateState({ 
        error: errorMessage, 
        isLoading: false, 
        isPlaying: false 
      });
      onError?.(errorMessage);
    };

    const handleDurationChange = () => {
      updateState({ duration: audio.duration || 0 });
    };

    const handleVolumeChange = () => {
      updateState({ volume: audio.volume });
    };

    // Add event listeners
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('volumechange', handleVolumeChange);

    // Cleanup
    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [state.isSeeking, updateState, onEnded, onError]);

  // Handle src changes
  useEffect(() => {
    if (!audioRef.current) return;
    
    updateState({ 
      isLoading: true, 
      error: null, 
      currentTime: 0, 
      isPlaying: false 
    });
    
    audioRef.current.src = src;
    audioRef.current.load();
  }, [src, updateState]);

  // Handle initial position for keep play head feature
  useEffect(() => {
    if (!audioRef.current || state.isLoading || typeof initialPosition !== 'number') return;
    
    // Set the initial position when the audio is ready
    if (initialPosition > 0 && initialPosition !== state.currentTime) {
      audioRef.current.currentTime = initialPosition;
      updateState({ currentTime: initialPosition });
    }
  }, [initialPosition, state.isLoading, state.currentTime, updateState]);

  // Handle autoPlay
  useEffect(() => {
    if (autoPlay && !state.isLoading && !state.error) {
      togglePlayPause();
    }
  }, [autoPlay, state.isLoading, state.error, togglePlayPause]);

  // Sync external play state
  useEffect(() => {
    if (externalIsPlaying !== undefined && audioRef.current && !state.isLoading && !isUpdatingRef.current) {
      const audio = audioRef.current;
      
      // Only act if there's an actual difference
      if (externalIsPlaying !== state.isPlaying && !state.isSeeking) {
        isUpdatingRef.current = true;
        
        if (externalIsPlaying && audio.paused) {
          audio.play().catch(error => {
            const errorMessage = error instanceof Error ? error.message : 'Playback failed';
            updateState({ error: errorMessage, isPlaying: false });
            onError?.(errorMessage);
          }).finally(() => {
            isUpdatingRef.current = false;
          });
        } else if (!externalIsPlaying && !audio.paused) {
          audio.pause();
          isUpdatingRef.current = false;
        } else {
          isUpdatingRef.current = false;
        }
      }
    }
  }, [externalIsPlaying, state.isPlaying, state.isLoading, state.isSeeking, updateState, onError]);

  // Sync external volume
  useEffect(() => {
    if (externalVolume !== undefined && Math.abs(externalVolume - state.volume) > 0.01) {
      setVolume(externalVolume);
    }
  }, [externalVolume, state.volume, setVolume]);

  // Notify parent of play state changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      onPlayStateChange?.(state.isPlaying);
    }, 50); // Small delay to prevent rapid fire events
    
    return () => clearTimeout(timer);
  }, [state.isPlaying, onPlayStateChange]);

  // Notify parent of volume changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      onVolumeChange?.(state.volume);
    }, 100); // Slightly longer delay for volume changes
    
    return () => clearTimeout(timer);
  }, [state.volume, onVolumeChange]);

  return (
    <Box>
      {/* Hidden HTML5 audio element */}
      <audio
        ref={audioRef}
        preload="metadata"
        className="audio-player-hidden"
      />

      {/* Error display */}
      {state.error && (
        <Alert 
          icon={<IconAlertTriangle size={16} />} 
          color="red" 
          mb="sm"
        >
          {state.error}
        </Alert>
      )}

      {/* Track info */}
      <Group justify="space-between" mb="sm">
        <Box>
          <Text size="md" fw={500} truncate>
            {title}
          </Text>
          <Text size="sm" c="dimmed" truncate>
            {artist}
          </Text>
        </Box>
        <VolumeControl 
          volume={state.volume}
          onChange={setVolume}
        />
      </Group>

      {/* Progress bar */}
      <ProgressBar
        currentTime={state.currentTime}
        duration={state.duration}
        isLoading={state.isLoading}
        onSeek={seekTo}
        mb="sm"
      />

      {/* Player controls */}
      <PlayerControls
        isPlaying={state.isPlaying}
        isLoading={state.isLoading}
        onTogglePlayPause={togglePlayPause}
      />
    </Box>
  );
}
