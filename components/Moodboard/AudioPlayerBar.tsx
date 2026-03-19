import { useRef, useEffect, useCallback, useReducer, useState } from 'react';
import { Box, Group, Text, ActionIcon, Tooltip, Slider } from '@mantine/core';
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconVolume,
  IconVolume2,
  IconVolume3,
  IconVolumeOff,
  IconMusic,
} from '@tabler/icons-react';
import { audioReducer, initialAudioState } from '../../lib/audio-state';
import {
  createPlayCommand,
  createSeekCommand,
  createVolumeCommand,
  createLoadCommand,
  executeCommand,
} from '../../lib/audio-commands';
import {
  useAudioEventListeners,
  useExternalSync,
  useCallbackNotifications,
} from '../../lib/audio-effects';
import { formatTime } from '../../lib/format-utils';
import type { MP3Metadata } from '../../lib/mp3-metadata';
import './AudioPlayerBar.css';

export interface AudioPlayerBarProps {
  currentTrack: MP3Metadata | null;
  isPlaying: boolean;
  volume: number;
  onPlayStateChange: (playing: boolean) => void;
  onVolumeChange: (volume: number) => void;
  onTimeUpdate: (time: number) => void;
  onEnded: () => void;
  onTogglePlayPause: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  playlistPosition?: { current: number; total: number };
}

function VolumeIcon({ volume }: { volume: number }) {
  if (volume <= 0) return <IconVolumeOff size={16} />;
  if (volume <= 0.33) return <IconVolume size={16} />;
  if (volume <= 0.66) return <IconVolume2 size={16} />;
  return <IconVolume3 size={16} />;
}

export function AudioPlayerBar({
  currentTrack,
  isPlaying,
  volume,
  onPlayStateChange,
  onVolumeChange,
  onTimeUpdate,
  onEnded,
  onTogglePlayPause,
  onNext,
  onPrevious,
  playlistPosition,
}: AudioPlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const autoPlayAttemptedSrcRef = useRef<string | null>(null);
  const lastNonZeroVolumeRef = useRef(1);
  const [state, dispatch] = useReducer(audioReducer, initialAudioState);
  const [artworkError, setArtworkError] = useState(false);
  const [seekingTo, setSeekingTo] = useState<number | null>(null);

  const audioSrc = currentTrack
    ? `/audio/${encodeURIComponent(currentTrack.filePath)}`
    : '';
  const artworkSrc = currentTrack
    ? `/artwork/${encodeURIComponent(currentTrack.filePath)}`
    : '';

  // Sync external play state
  const { setUserActionInProgress } = useExternalSync(
    audioRef,
    isPlaying,
    state.isPlaying,
    state.isLoading,
  );

  // Audio event listeners
  useAudioEventListeners(audioRef, dispatch, onTimeUpdate, onEnded);

  // Notify parent of internal state changes
  useCallbackNotifications(state.isPlaying, state.volume, onPlayStateChange, onVolumeChange);

  // Load new track
  useEffect(() => {
    if (!currentTrack) return;
    dispatch({ type: 'RESET' });
    autoPlayAttemptedSrcRef.current = null;
    setArtworkError(false);
    setSeekingTo(null);
    void executeCommand(audioRef.current, createLoadCommand(audioSrc));
  }, [audioSrc, currentTrack]);

  // Auto-play when track finishes loading
  useEffect(() => {
    if (
      currentTrack &&
      !state.isLoading &&
      !state.error &&
      !state.isPlaying &&
      autoPlayAttemptedSrcRef.current !== audioSrc
    ) {
      autoPlayAttemptedSrcRef.current = audioSrc;
      setUserActionInProgress(true);
      void executeCommand(audioRef.current, createPlayCommand());
    }
  }, [currentTrack, state.isLoading, state.error, state.isPlaying, audioSrc, setUserActionInProgress]);

  // Sync external volume
  useEffect(() => {
    if (Math.abs(volume - state.volume) > 0.01) {
      void executeCommand(audioRef.current, createVolumeCommand(volume));
    }
  }, [volume, state.volume]);

  // Track last non-zero volume for mute toggle
  useEffect(() => {
    if (state.volume > 0) {
      lastNonZeroVolumeRef.current = state.volume;
    }
  }, [state.volume]);

  // Seeking
  const handleSeekChange = useCallback((value: number) => {
    setSeekingTo(value);
  }, []);

  const handleSeekEnd = useCallback(
    (value: number) => {
      void executeCommand(audioRef.current, createSeekCommand(value, state.duration));
    },
    [state.duration],
  );

  // Clear seeking state when currentTime catches up
  useEffect(() => {
    if (seekingTo !== null && Math.abs(state.currentTime - seekingTo) < 0.5) {
      setSeekingTo(null);
    }
  }, [state.currentTime, seekingTo]);

  const handleMuteToggle = useCallback(() => {
    onVolumeChange(state.volume === 0 ? lastNonZeroVolumeRef.current : 0);
  }, [state.volume, onVolumeChange]);

  const handleVolumeSlider = useCallback(
    (value: number) => onVolumeChange(value / 100),
    [onVolumeChange],
  );

  // Empty state
  if (!currentTrack) {
    return (
      <Box className="audio-player-bar audio-player-bar--empty">
        <Group gap="xs" align="center">
          <IconMusic size={16} style={{ opacity: 0.4 }} />
          <Text size="xs" c="dimmed">
            No track playing
          </Text>
        </Group>
      </Box>
    );
  }

  const displayTime = seekingTo ?? state.currentTime;

  return (
    <Box className={`audio-player-bar${isPlaying ? ' audio-player-bar--playing' : ''}`}>
      <audio ref={audioRef} preload="metadata" style={{ display: 'none' }} />

      {/* Artwork thumbnail */}
      <Box className="audio-player-bar__artwork">
        {artworkError ? (
          <Box className="audio-player-bar__artwork-fallback">
            <IconMusic size={20} />
          </Box>
        ) : (
          <img
            src={artworkSrc}
            alt=""
            className="audio-player-bar__artwork-img"
            onError={() => setArtworkError(true)}
          />
        )}
      </Box>

      {/* Track info */}
      <Box className="audio-player-bar__track-info">
        <Text size="sm" fw={600} lh={1.2} className="audio-player-bar__track-info-title">
          {currentTrack.title || 'Unknown Title'}
        </Text>
        <Text size="xs" c="dimmed" truncate="end" lh={1.2}>
          {currentTrack.artist || 'Unknown Artist'}
        </Text>
      </Box>

      {/* Transport controls */}
      <Group gap={4} wrap="nowrap" className="audio-player-bar__controls">
        <Tooltip label="Previous" position="top" disabled={!onPrevious}>
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={onPrevious}
            disabled={!onPrevious}
            aria-label="Previous track"
          >
            <IconPlayerSkipBack size={16} />
          </ActionIcon>
        </Tooltip>

        <ActionIcon
          size="md"
          variant="filled"
          color="violet"
          onClick={onTogglePlayPause}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="audio-player-bar__play-btn"
        >
          {isPlaying ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
        </ActionIcon>

        <Tooltip label="Next" position="top" disabled={!onNext}>
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={onNext}
            disabled={!onNext}
            aria-label="Next track"
          >
            <IconPlayerSkipForward size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Progress bar */}
      <Box className="audio-player-bar__progress">
        <Slider
          value={seekingTo ?? state.currentTime}
          min={0}
          max={state.duration || 100}
          step={0.1}
          onChange={handleSeekChange}
          onChangeEnd={handleSeekEnd}
          disabled={state.isLoading || state.duration === 0}
          color="violet"
          size="xs"
          thumbSize={12}
          label={formatTime}
          styles={{
            root: { padding: 0 },
            track: { height: 4 },
            bar: { height: 4 },
          }}
        />
      </Box>

      {/* Time display */}
      <Text size="xs" c="dimmed" className="audio-player-bar__time">
        {formatTime(displayTime)}&nbsp;/&nbsp;{formatTime(state.duration)}
      </Text>

      {/* Playlist position indicator */}
      {playlistPosition && (
        <Text size="xs" c="dimmed" className="audio-player-bar__playlist-pos">
          {playlistPosition.current} of {playlistPosition.total}
        </Text>
      )}

      {/* Volume control */}
      <Group gap={4} wrap="nowrap" className="audio-player-bar__volume">
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={handleMuteToggle}
          aria-label={state.volume === 0 ? 'Unmute' : 'Mute'}
        >
          <VolumeIcon volume={state.volume} />
        </ActionIcon>
        <Slider
          value={state.volume * 100}
          min={0}
          max={100}
          step={1}
          onChange={handleVolumeSlider}
          size="xs"
          color="violet"
          thumbSize={10}
          label={null}
          className="audio-player-bar__volume-slider"
        />
      </Group>
    </Box>
  );
}
