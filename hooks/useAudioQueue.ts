import { useState, useCallback, useRef } from 'react';
import type { MP3Metadata } from '../lib/mp3-metadata';

export interface AudioQueueState {
  currentTrack: MP3Metadata | null;
  isPlaying: boolean;
  wasPlaying: boolean; // Remember if we were playing when switching tracks
  volume: number;
  keepPlayHead: boolean; // Setting to preserve playback position
  savedPosition: number; // Stored playback position for keep play head feature
}

export interface AudioQueueActions {
  playTrack: (track: MP3Metadata) => void;
  togglePlayPause: () => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  clearTrack: () => void;
  setKeepPlayHead: (enabled: boolean) => void;
  setCurrentTime: (time: number) => void;
  getSavedPosition: () => number;
}

export function useAudioQueue(): AudioQueueState & AudioQueueActions {
  const [state, setState] = useState<AudioQueueState>({
    currentTrack: null,
    isPlaying: false,
    wasPlaying: false,
    volume: 1,
    keepPlayHead: false,
    savedPosition: 0
  });

  // Store the current playback position when pausing or switching tracks
  const savedPositionRef = useRef<number>(0);

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
      
      // For different tracks, just set the track and let AudioPlayer handle autoPlay
      console.log('Different track clicked, setting as current track');
      return {
        ...prev,
        currentTrack: track,
        isPlaying: false, // Let AudioPlayer autoPlay handle the initial play
        wasPlaying: prev.isPlaying,
        savedPosition: prev.keepPlayHead ? savedPositionRef.current : 0
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
      wasPlaying: false,
      savedPosition: 0
    }));
    savedPositionRef.current = 0;
  }, []);

  const setKeepPlayHead = useCallback((enabled: boolean) => {
    setState(prev => ({
      ...prev,
      keepPlayHead: enabled
    }));
  }, []);

  const setCurrentTime = useCallback((time: number) => {
    // Store the current playback position for keep play head feature
    savedPositionRef.current = time;
    setState(prev => ({
      ...prev,
      savedPosition: time
    }));
  }, []);

  const getSavedPosition = useCallback(() => {
    return savedPositionRef.current;
  }, []);

  return {
    ...state,
    playTrack,
    togglePlayPause,
    setIsPlaying,
    setVolume,
    clearTrack,
    setKeepPlayHead,
    setCurrentTime,
    getSavedPosition
  };
}
