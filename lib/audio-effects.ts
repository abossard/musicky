import { useEffect, useRef } from 'react';
import { AudioAction } from './audio-state';

export function useAudioEventListeners(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  dispatch: React.Dispatch<AudioAction>,
  onTimeUpdate?: (time: number) => void,
  onEnded?: () => void,
  onError?: (error: string) => void
) {
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const eventMap: Record<string, (e?: Event) => void> = {
      loadstart: () => dispatch({ type: 'LOAD_START' }),
      canplay: () => dispatch({ type: 'CAN_PLAY', duration: audio.duration || 0 }),
      play: () => dispatch({ type: 'PLAY' }),
      pause: () => dispatch({ type: 'PAUSE' }),
      timeupdate: () => {
        dispatch({ type: 'TIME_UPDATE', currentTime: audio.currentTime });
        onTimeUpdate?.(audio.currentTime);
      },
      ended: () => {
        dispatch({ type: 'ENDED' });
        onEnded?.();
      },
      error: (e?: Event) => {
        const target = e?.target as HTMLAudioElement;
        const errorMessage = target?.error?.message || 'Unknown audio error';
        dispatch({ type: 'ERROR', error: errorMessage });
        onError?.(errorMessage);
      },
      durationchange: () => dispatch({ type: 'DURATION_CHANGE', duration: audio.duration || 0 }),
      volumechange: () => dispatch({ type: 'VOLUME_CHANGE', volume: audio.volume })
    };

    // Add all listeners
    Object.entries(eventMap).forEach(([event, handler]) => {
      audio.addEventListener(event, handler);
    });

    return () => {
      Object.entries(eventMap).forEach(([event, handler]) => {
        audio.removeEventListener(event, handler);
      });
    };
  }, [audioRef, dispatch, onTimeUpdate, onEnded, onError]);
}

export function useExternalSync(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  externalIsPlaying: boolean | undefined,
  isPlaying: boolean,
  isLoading: boolean,
  onError?: (error: string) => void
) {
  const syncInProgress = useRef(false);
  const userActionInProgress = useRef(false);

  useEffect(() => {
    if (externalIsPlaying === undefined || !audioRef.current || isLoading || syncInProgress.current || userActionInProgress.current) {
      return;
    }

    const audio = audioRef.current;
    const needsSync = externalIsPlaying !== isPlaying;

    console.log('useExternalSync: checking sync', {
      externalIsPlaying,
      isPlaying,
      needsSync,
      userActionInProgress: userActionInProgress.current
    });

    if (needsSync) {
      syncInProgress.current = true;
      console.log('useExternalSync: syncing to external state', externalIsPlaying);
      
      const syncOperation = externalIsPlaying ? audio.play() : Promise.resolve(audio.pause());
      
      Promise.resolve(syncOperation)
        .catch(error => {
          const errorMessage = error instanceof Error ? error.message : 'Sync failed';
          console.error('useExternalSync error:', errorMessage);
          onError?.(errorMessage);
        })
        .finally(() => {
          syncInProgress.current = false;
        });
    }
  }, [externalIsPlaying, isPlaying, isLoading, onError]);

  // Expose a way to temporarily disable sync during user actions
  return {
    setUserActionInProgress: (inProgress: boolean) => {
      userActionInProgress.current = inProgress;
      console.log('useExternalSync: user action in progress set to', inProgress);
      if (inProgress) {
        // Clear after a delay to allow state propagation
        setTimeout(() => {
          userActionInProgress.current = false;
          console.log('useExternalSync: user action in progress cleared');
        }, 300);
      }
    }
  };
}

export function useCallbackNotifications(
  isPlaying: boolean,
  volume: number,
  onPlayStateChange?: (isPlaying: boolean) => void,
  onVolumeChange?: (volume: number) => void
) {
  const prevPlayingRef = useRef(isPlaying);
  const prevVolumeRef = useRef(volume);

  useEffect(() => {
    if (prevPlayingRef.current !== isPlaying) {
      onPlayStateChange?.(isPlaying);
      prevPlayingRef.current = isPlaying;
    }
  }, [isPlaying, onPlayStateChange]);

  useEffect(() => {
    if (Math.abs(prevVolumeRef.current - volume) > 0.01) {
      onVolumeChange?.(volume);
      prevVolumeRef.current = volume;
    }
  }, [volume, onVolumeChange]);
}