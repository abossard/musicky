import { useState, useCallback } from 'react';
import type { MP3Metadata } from '../lib/mp3-metadata';

export interface AudioQueueState {
  currentTrack: MP3Metadata | null;
  isPlaying: boolean;
  wasPlaying: boolean; // Remember if we were playing when switching tracks
  volume: number;
}

export interface AudioQueueActions {
  playTrack: (track: MP3Metadata) => void;
  togglePlayPause: () => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  clearTrack: () => void;
}

export function useAudioQueue(): AudioQueueState & AudioQueueActions {
  const [state, setState] = useState<AudioQueueState>({
    currentTrack: null,
    isPlaying: false,
    wasPlaying: false,
    volume: 1
  });

  const playTrack = useCallback((track: MP3Metadata) => {
    console.log('useAudioQueue.playTrack called with:', track.title || track.filePath);
    setState(prev => {
      console.log('Previous state:', prev);
      // If clicking the same track, toggle play/pause
      if (prev.currentTrack?.filePath === track.filePath) {
        console.log('Same track clicked, toggling play/pause');
        return {
          ...prev,
          isPlaying: !prev.isPlaying,
          wasPlaying: !prev.isPlaying
        };
      }
      
      // If clicking a different track, load it and start playing
      console.log('Different track clicked, setting as current track and starting playback');
      return {
        ...prev,
        currentTrack: track,
        isPlaying: true, // Always start playing when selecting a new track
        wasPlaying: prev.isPlaying
      };
    });
  }, []);

  const togglePlayPause = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying,
      wasPlaying: !prev.isPlaying
    }));
  }, []);

  const setIsPlaying = useCallback((playing: boolean) => {
    setState(prev => ({
      ...prev,
      isPlaying: playing,
      wasPlaying: playing
    }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState(prev => ({
      ...prev,
      volume
    }));
  }, []);

  const clearTrack = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentTrack: null,
      isPlaying: false,
      wasPlaying: false
    }));
  }, []);

  return {
    ...state,
    playTrack,
    togglePlayPause,
    setIsPlaying,
    setVolume,
    clearTrack
  };
}
