import React, { useRef, useEffect, useCallback, useReducer } from 'react';
import { Box, Group, Text, Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { PlayerControls } from './PlayerControls';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import { audioReducer, initialAudioState } from '../../lib/audio-state';
import { createPlayCommand, createPauseCommand, createSeekCommand, createVolumeCommand, createLoadCommand, executeCommand } from '../../lib/audio-commands';
import { useAudioEventListeners, useExternalSync, useCallbackNotifications } from '../../lib/audio-effects';
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
  const [state, dispatch] = useReducer(audioReducer, initialAudioState);

  // Sync external play state and get control function
  const { setUserActionInProgress } = useExternalSync(audioRef, externalIsPlaying, state.isPlaying, state.isLoading, onError);

  // Play/pause functionality
  const togglePlayPause = useCallback(async () => {
    if (state.isLoading) return;
    
    console.log('AudioPlayer.togglePlayPause called, current state.isPlaying:', state.isPlaying);
    
    // Prevent external sync from interfering with user action
    setUserActionInProgress(true);
    
    const command = state.isPlaying ? createPauseCommand() : createPlayCommand();
    const error = await executeCommand(audioRef.current, command);
    
    if (error) {
      console.error('AudioPlayer.togglePlayPause error:', error);
      dispatch({ type: 'ERROR', error });
      onError?.(error);
    }
  }, [state.isPlaying, state.isLoading, onError, setUserActionInProgress]);

  // Seeking functionality
  const seekTo = useCallback(async (time: number) => {
    const command = createSeekCommand(time, state.duration);
    await executeCommand(audioRef.current, command);
  }, [state.duration]);

  // Volume control
  const setVolume = useCallback(async (volume: number) => {
    const command = createVolumeCommand(volume);
    await executeCommand(audioRef.current, command);
  }, []);

  // Audio event listeners
  useAudioEventListeners(audioRef, dispatch, onTimeUpdate, onEnded, onError);

  // Handle src changes
  useEffect(() => {
    const loadAudio = async () => {
      dispatch({ type: 'RESET' });
      const command = createLoadCommand(src);
      await executeCommand(audioRef.current, command);
    };
    
    loadAudio();
  }, [src]);

  // Handle initial position for keep play head feature
  useEffect(() => {
    if (state.isLoading || typeof initialPosition !== 'number' || initialPosition <= 0) return;
    
    if (initialPosition !== state.currentTime) {
      seekTo(initialPosition);
    }
  }, [initialPosition, state.isLoading, state.currentTime, seekTo]);

  // Handle autoPlay
  useEffect(() => {
    if (autoPlay && !state.isLoading && !state.error && !state.isPlaying) {
      togglePlayPause();
    }
  }, [autoPlay, state.isLoading, state.error, state.isPlaying, togglePlayPause]);

  // Sync external volume
  useEffect(() => {
    if (externalVolume !== undefined && Math.abs(externalVolume - state.volume) > 0.01) {
      setVolume(externalVolume);
    }
  }, [externalVolume, state.volume, setVolume]);

  // Notify parent of state changes
  useCallbackNotifications(state.isPlaying, state.volume, onPlayStateChange, onVolumeChange);

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
