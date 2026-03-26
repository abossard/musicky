import { useState, useCallback } from 'react';
import type { MP3Metadata } from '../lib/mp3-metadata';

interface AudioQueueStateBase {
  volume: number;
  keepPlayHead: boolean;
  savedPosition: number;
}

interface AudioQueueIdle extends AudioQueueStateBase {
  currentTrack: null;
  isPlaying: false;
}

interface AudioQueueActive extends AudioQueueStateBase {
  currentTrack: MP3Metadata;
  isPlaying: boolean;
}

/** Discriminated union: isPlaying can only be true when a track is loaded */
export type AudioQueueState = AudioQueueIdle | AudioQueueActive;

export interface AudioQueueActions {
  playTrack: (track: MP3Metadata) => void;
  togglePlayPause: () => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  clearTrack: () => void;
  setKeepPlayHead: (enabled: boolean) => void;
  setCurrentTime: (time: number) => void;
}

export function useAudioQueue(): AudioQueueState & AudioQueueActions {
  const [state, setState] = useState<AudioQueueState>({
    currentTrack: null,
    isPlaying: false,
    volume: 1,
    keepPlayHead: false,
    savedPosition: 0
  });

  const playTrack = useCallback((track: MP3Metadata) => {
    setState(prev => {
      // Same track: toggle play/pause
      if (prev.currentTrack?.filePath === track.filePath) {
        return { ...prev, isPlaying: !prev.isPlaying } as AudioQueueState;
      }
      // Different track: load it (AudioPlayer autoPlay handles initial play)
      return {
        ...prev,
        currentTrack: track,
        isPlaying: false,
        savedPosition: prev.keepPlayHead ? prev.savedPosition : 0
      } as AudioQueueState;
    });
  }, []);

  const togglePlayPause = useCallback(() => {
    setState(prev => {
      if (!prev.currentTrack) return prev; // can't play without a track
      return { ...prev, isPlaying: !prev.isPlaying } as AudioQueueState;
    });
  }, []);

  const setIsPlaying = useCallback((playing: boolean) => {
    setState(prev => {
      if (!prev.currentTrack && playing) return prev; // can't play without a track
      return { ...prev, isPlaying: playing } as AudioQueueState;
    });
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState(prev => ({ ...prev, volume }) as AudioQueueState);
  }, []);

  const clearTrack = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentTrack: null,
      isPlaying: false,
      savedPosition: 0
    } as AudioQueueIdle));
  }, []);

  const setKeepPlayHead = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, keepPlayHead: enabled }) as AudioQueueState);
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    setState(prev => ({ ...prev, savedPosition: time }) as AudioQueueState);
  }, []);

  return {
    ...state,
    playTrack,
    togglePlayPause,
    setIsPlaying,
    setVolume,
    clearTrack,
    setKeepPlayHead,
    setCurrentTime
  };
}
