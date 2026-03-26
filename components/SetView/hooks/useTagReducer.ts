export interface TagInfo {
  label: string;
  category: string;
}

export type TagOpState =
  | { status: 'idle'; tags: TagInfo[]; songPath: string | null }
  | { status: 'pending'; tags: TagInfo[]; optimistic: TagInfo[]; songPath: string; op: string }
  | { status: 'error'; tags: TagInfo[]; songPath: string; error: string };

export type TagOpAction =
  | { type: 'LOAD_SONG'; songPath: string }
  | { type: 'TAGS_LOADED'; tags: TagInfo[] }
  | { type: 'TOGGLE_START'; label: string; category: string }
  | { type: 'TOGGLE_SUCCESS'; tags: TagInfo[] }
  | { type: 'TOGGLE_FAILURE'; error: string }
  | { type: 'CLEAR' };

export const initialTagState: TagOpState = { status: 'idle', tags: [], songPath: null };

export function tagOpReducer(state: TagOpState, action: TagOpAction): TagOpState {
  switch (action.type) {
    case 'LOAD_SONG':
      return { status: 'idle', tags: [], songPath: action.songPath };
    case 'TAGS_LOADED':
      return { ...state, status: 'idle', tags: action.tags } as TagOpState;
    case 'TOGGLE_START': {
      if (state.status === 'pending' || !state.songPath) return state;
      const has = state.tags.some(t => t.label === action.label && t.category === action.category);
      const optimistic = has
        ? state.tags.filter(t => !(t.label === action.label && t.category === action.category))
        : [...state.tags, { label: action.label, category: action.category }];
      return {
        status: 'pending',
        tags: state.tags,
        optimistic,
        songPath: state.songPath,
        op: `${has ? 'remove' : 'add'}:${action.category}:${action.label}`,
      };
    }
    case 'TOGGLE_SUCCESS':
      if (state.status !== 'pending') return state;
      return { status: 'idle', tags: action.tags, songPath: state.songPath };
    case 'TOGGLE_FAILURE':
      if (state.status !== 'pending') return state;
      return { status: 'error', tags: state.tags, songPath: state.songPath, error: action.error };
    case 'CLEAR':
      return { status: 'idle', tags: [], songPath: null };
    default:
      return state;
  }
}

export function getDisplayTags(state: TagOpState): TagInfo[] {
  return state.status === 'pending' ? state.optimistic : state.tags;
}

export function isTagPending(state: TagOpState): boolean {
  return state.status === 'pending';
}
