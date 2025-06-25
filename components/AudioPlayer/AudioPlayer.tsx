import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Group, Text, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { PlayerControls } from './PlayerControls';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import { clamp } from '../../lib/math-utils';
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
  const userActionRef = useRef(false); // Track user-initiated actions
  
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

    console.log('AudioPlayer.togglePlayPause called, current state.isPlaying:', state.isPlaying);
    
    // Mark as user action to prevent external sync interference
    userActionRef.current = true;

    try {
      if (state.isPlaying) {
        console.log('Attempting to pause audio');
        audioRef.current.pause();
        // State will be updated by the 'pause' event listener
      } else {
        console.log('Attempting to play audio');
        await audioRef.current.play();
        // State will be updated by the 'play' event listener
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Playback failed';
      console.error('AudioPlayer.togglePlayPause error:', errorMessage);
      updateState({ error: errorMessage, isPlaying: false });
      onError?.(errorMessage);
    } finally {
      // Clear user action flag after a short delay to allow state propagation
      setTimeout(() => {
        userActionRef.current = false;
      }, 200);
    }
  }, [state.isPlaying, state.isLoading, updateState, onError]);

  // Seeking functionality
  const seekTo = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    updateState({ isSeeking: true });
    audioRef.current.currentTime = clamp(time, 0, state.duration);
    
    // Clear seeking state after a short delay
    setTimeout(() => updateState({ isSeeking: false }), 100);
  }, [state.duration, updateState]);

  // Volume control
  const setVolume = useCallback((volume: number) => {
    if (!audioRef.current) return;
    
    const clampedVolume = clamp(volume, 0, 1);
    audioRef.current.volume = clampedVolume;
    updateState({ volume: clampedVolume });
  }, [updateState]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const eventHandlers = {
      loadstart: () => updateState({ isLoading: true, error: null }),
      
      canplay: () => {
        updateState({ isLoading: false, duration: audio.duration || 0 });
        if (externalIsPlaying && audio.paused) {
          audio.play().catch(error => {
            const errorMessage = error instanceof Error ? error.message : 'Auto-play failed';
            updateState({ error: errorMessage, isPlaying: false });
            onError?.(errorMessage);
          });
        }
      },
      
      play: () => {
        console.log('Audio play event fired');
        updateState({ isPlaying: true });
      },
      pause: () => {
        console.log('Audio pause event fired');
        updateState({ isPlaying: false });
      },
      
      timeupdate: () => {
        if (!state.isSeeking) {
          updateState({ currentTime: audio.currentTime });
          onTimeUpdate?.(audio.currentTime);
        }
      },
      
      ended: () => {
        updateState({ isPlaying: false, currentTime: 0 });
        onEnded?.();
      },
      
      error: (e: Event) => {
        const target = e.target as HTMLAudioElement;
        const errorMessage = target.error 
          ? `Audio error: ${target.error.message}` 
          : 'Unknown audio error';
        updateState({ error: errorMessage, isLoading: false, isPlaying: false });
        onError?.(errorMessage);
      },
      
      durationchange: () => updateState({ duration: audio.duration || 0 }),
      volumechange: () => updateState({ volume: audio.volume })
    };

    // Add all event listeners
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      audio.addEventListener(event, handler);
    });

    // Cleanup
    return () => {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        audio.removeEventListener(event, handler);
      });
    };
  }, [state.isSeeking, updateState, onEnded, onError, externalIsPlaying]);

  // Handle src changes
  useEffect(() => {
    if (!audioRef.current) return;
    
    // Preserve the external playing state when changing tracks
    const shouldPreservePlayingState = externalIsPlaying !== undefined ? externalIsPlaying : false;
    
    updateState({ 
      isLoading: true, 
      error: null, 
      currentTime: 0, 
      isPlaying: shouldPreservePlayingState // Preserve external play state instead of always setting to false
    });
    
    audioRef.current.src = src;
    audioRef.current.load();
  }, [src, updateState, externalIsPlaying]);

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
    if (externalIsPlaying !== undefined && audioRef.current && !state.isLoading && !isUpdatingRef.current && !userActionRef.current) {
      const audio = audioRef.current;
      
      console.log('External play state sync:', {
        externalIsPlaying,
        stateIsPlaying: state.isPlaying,
        audioPaused: audio.paused,
        isSeeking: state.isSeeking,
        userAction: userActionRef.current
      });
      
      // Only act if there's an actual difference
      if (externalIsPlaying !== state.isPlaying && !state.isSeeking) {
        isUpdatingRef.current = true;
        console.log('External state differs from internal state, syncing...');
        
        if (externalIsPlaying && audio.paused) {
          console.log('External says play, audio is paused - playing');
          audio.play().catch(error => {
            const errorMessage = error instanceof Error ? error.message : 'Playback failed';
            updateState({ error: errorMessage, isPlaying: false });
            onError?.(errorMessage);
          }).finally(() => {
            isUpdatingRef.current = false;
          });
        } else if (!externalIsPlaying && !audio.paused) {
          console.log('External says pause, audio is playing - pausing');
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
        mb="xl"
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
