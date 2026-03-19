import React, { useRef, useEffect, useCallback, useReducer } from 'react';
import { Box, Group, Text, Alert } from '@mantine/core';
import { IconAlertTriangle, IconPlayerTrackNext, IconPlayerTrackPrev } from '@tabler/icons-react';
import { PlayerControls } from './PlayerControls';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import { audioReducer, initialAudioState } from '../../lib/audio-state';
import { createPlayCommand, createPauseCommand, createSeekCommand, createVolumeCommand, createLoadCommand, executeCommand } from '../../lib/audio-commands';
import { useAudioEventListeners, useExternalSync, useCallbackNotifications } from '../../lib/audio-effects';
import { formatTime } from '../../lib/format-utils';
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
  compact?: boolean;
  enableArrowSeek?: boolean;
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
  onError,
  compact = false,
  enableArrowSeek = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const autoPlayAttemptedSrcRef = useRef<string | null>(null);
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

  const seekBy = useCallback(async (delta: number) => {
    const nextTime = Math.min(Math.max(state.currentTime + delta, 0), state.duration || Number.MAX_SAFE_INTEGER);
    await seekTo(nextTime);
  }, [seekTo, state.currentTime, state.duration]);

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
      autoPlayAttemptedSrcRef.current = null;
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
    if (
      autoPlay &&
      !state.isLoading &&
      !state.error &&
      !state.isPlaying &&
      autoPlayAttemptedSrcRef.current !== src
    ) {
      autoPlayAttemptedSrcRef.current = src;
      togglePlayPause();
    }
  }, [autoPlay, state.isLoading, state.error, state.isPlaying, togglePlayPause]);

  // Sync external volume
  useEffect(() => {
    if (externalVolume !== undefined && Math.abs(externalVolume - state.volume) > 0.01) {
      setVolume(externalVolume);
    }
  }, [externalVolume, state.volume, setVolume]);

  useEffect(() => {
    if (!enableArrowSeek) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const tagName = activeElement?.tagName;
      const isEditable = Boolean(activeElement?.isContentEditable) || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
      const withinPlayer = !!rootRef.current && !!activeElement && rootRef.current.contains(activeElement);

      if (isEditable || (!withinPlayer && activeElement !== document.body)) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void seekBy(-10);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        void seekBy(10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableArrowSeek, seekBy]);

  // Notify parent of state changes
  useCallbackNotifications(state.isPlaying, state.volume, onPlayStateChange, onVolumeChange);

  if (compact) {
    return (
      <Box ref={rootRef} tabIndex={0} style={{ minWidth: 0, width: '100%', outline: 'none' }}>
        <audio
          ref={audioRef}
          preload="metadata"
          className="audio-player-hidden"
        />

        <Group gap="xs" wrap="nowrap" align="center" style={{ minWidth: 0 }}>
          <PlayerControls
            isPlaying={state.isPlaying}
            isLoading={state.isLoading}
            onTogglePlayPause={togglePlayPause}
            compact
          />
          <Group gap={2} wrap="nowrap">
            <Box
              component="button"
              type="button"
              onClick={() => void seekBy(-10)}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--mantine-color-dimmed)',
                display: 'grid',
                placeItems: 'center',
                padding: 4,
                cursor: 'pointer',
              }}
              aria-label="Seek backward 10 seconds"
            >
              <IconPlayerTrackPrev size={14} />
            </Box>
            <Box
              component="button"
              type="button"
              onClick={() => void seekBy(10)}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--mantine-color-dimmed)',
                display: 'grid',
                placeItems: 'center',
                padding: 4,
                cursor: 'pointer',
              }}
              aria-label="Seek forward 10 seconds"
            >
              <IconPlayerTrackNext size={14} />
            </Box>
          </Group>
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Text size="xs" fw={600} truncate>
              {title}
            </Text>
            <ProgressBar
              currentTime={state.currentTime}
              duration={state.duration}
              isLoading={state.isLoading}
              onSeek={seekTo}
              compact
            />
          </Box>
          <Text size="10px" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </Text>
          <VolumeControl volume={state.volume} onChange={setVolume} compact />
        </Group>
      </Box>
    );
  }

  return (
    <Box ref={rootRef}>
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
