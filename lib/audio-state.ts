export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  error: string | null;
  isSeeking: boolean;
}

export type AudioAction =
  | { type: 'LOAD_START' }
  | { type: 'CAN_PLAY'; duration: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TIME_UPDATE'; currentTime: number }
  | { type: 'SEEK_START' }
  | { type: 'SEEK_END' }
  | { type: 'VOLUME_CHANGE'; volume: number }
  | { type: 'DURATION_CHANGE'; duration: number }
  | { type: 'ENDED' }
  | { type: 'ERROR'; error: string }
  | { type: 'RESET' };

export const initialAudioState: AudioState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isLoading: true,
  error: null,
  isSeeking: false
};

export function audioReducer(state: AudioState, action: AudioAction): AudioState {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, isLoading: true, error: null };
    
    case 'CAN_PLAY':
      return { ...state, isLoading: false, duration: action.duration };
    
    case 'PLAY':
      return { ...state, isPlaying: true, error: null };
    
    case 'PAUSE':
      return { ...state, isPlaying: false };
    
    case 'TIME_UPDATE':
      return state.isSeeking ? state : { ...state, currentTime: action.currentTime };
    
    case 'SEEK_START':
      return { ...state, isSeeking: true };
    
    case 'SEEK_END':
      return { ...state, isSeeking: false };
    
    case 'VOLUME_CHANGE':
      return { ...state, volume: action.volume };
    
    case 'DURATION_CHANGE':
      return { ...state, duration: action.duration };
    
    case 'ENDED':
      return { ...state, isPlaying: false, currentTime: 0 };
    
    case 'ERROR':
      return { ...state, error: action.error, isLoading: false, isPlaying: false };
    
    case 'RESET':
      return { ...initialAudioState, volume: state.volume };
    
    default:
      return state;
  }
}