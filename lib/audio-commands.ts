import { clamp } from './math-utils';

export interface AudioCommand {
  type: string;
  execute: (audio: HTMLAudioElement) => Promise<void> | void;
}

export const createPlayCommand = (): AudioCommand => ({
  type: 'PLAY',
  execute: (audio) => audio.play()
});

export const createPauseCommand = (): AudioCommand => ({
  type: 'PAUSE',
  execute: (audio) => audio.pause()
});

export const createSeekCommand = (time: number, duration: number): AudioCommand => ({
  type: 'SEEK',
  execute: (audio) => {
    audio.currentTime = clamp(time, 0, duration);
  }
});

export const createVolumeCommand = (volume: number): AudioCommand => ({
  type: 'VOLUME',
  execute: (audio) => {
    audio.volume = clamp(volume, 0, 1);
  }
});

export const createLoadCommand = (src: string): AudioCommand => ({
  type: 'LOAD',
  execute: (audio) => {
    audio.src = src;
    audio.load();
  }
});

export async function executeCommand(audio: HTMLAudioElement | null, command: AudioCommand): Promise<string | null> {
  if (!audio) return 'Audio element not available';
  
  try {
    await command.execute(audio);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}