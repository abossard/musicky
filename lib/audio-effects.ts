import { useEffect, useRef } from 'react';
import { AudioAction } from './audio-state';

export function useAudioEventListeners(
  audioRef: React.RefObject<HTMLAudioElement>,
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
  audioRef: React.RefObject<HTMLAudioElement>,
  externalIsPlaying: boolean | undefined,
  isPlaying: boolean,
  isLoading: boolean,
  onError?: (error: string) => void
) {
  const syncInProgress = useRef(false);

  useEffect(() => {
    if (externalIsPlaying === undefined || !audioRef.current || isLoading || syncInProgress.current) {
      return;
    }

    const audio = audioRef.current;
    const needsSync = externalIsPlaying !== isPlaying;

    if (needsSync) {
      syncInProgress.current = true;
      
      const syncOperation = externalIsPlaying ? audio.play() : Promise.resolve(audio.pause());
      
      Promise.resolve(syncOperation)
        .catch(error => {
          const errorMessage = error instanceof Error ? error.message : 'Sync failed';
          onError?.(errorMessage);
        })
        .finally(() => {
          syncInProgress.current = false;
        });
    }
  }, [externalIsPlaying, isPlaying, isLoading, onError]);
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