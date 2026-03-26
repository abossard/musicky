import { describe, it, expect } from 'vitest';
import {
  tagOpReducer, initialTagState, getDisplayTags, isTagPending,
  type TagOpState, type TagInfo,
} from '../../components/SetView/hooks/useTagReducer';

const rock: TagInfo = { label: 'Rock', category: 'genre' };
const jazz: TagInfo = { label: 'Jazz', category: 'genre' };
const chill: TagInfo = { label: 'Chill', category: 'mood' };

function idleWith(tags: TagInfo[], songPath: string | null = '/song.mp3'): TagOpState {
  return { status: 'idle', tags, songPath };
}

describe('tagOpReducer', () => {
  it('LOAD_SONG resets to idle with empty tags', () => {
    const state = tagOpReducer(initialTagState, { type: 'LOAD_SONG', songPath: '/a.mp3' });
    expect(state).toEqual({ status: 'idle', tags: [], songPath: '/a.mp3' });
  });

  it('TAGS_LOADED sets tags on idle state', () => {
    const state = tagOpReducer(
      idleWith([], '/a.mp3'),
      { type: 'TAGS_LOADED', tags: [rock, jazz] },
    );
    expect(state.status).toBe('idle');
    expect(state.tags).toEqual([rock, jazz]);
  });

  it('TOGGLE_START from idle adds tag optimistically', () => {
    const state = tagOpReducer(idleWith([rock]), { type: 'TOGGLE_START', label: 'Jazz', category: 'genre' });
    expect(state.status).toBe('pending');
    if (state.status !== 'pending') throw new Error('expected pending');
    expect(state.optimistic).toEqual([rock, jazz]);
    expect(state.tags).toEqual([rock]); // original preserved for rollback
    expect(state.op).toBe('add:genre:Jazz');
  });

  it('TOGGLE_START from idle removes tag optimistically', () => {
    const state = tagOpReducer(idleWith([rock, jazz]), { type: 'TOGGLE_START', label: 'Rock', category: 'genre' });
    expect(state.status).toBe('pending');
    if (state.status !== 'pending') throw new Error('expected pending');
    expect(state.optimistic).toEqual([jazz]);
    expect(state.tags).toEqual([rock, jazz]);
    expect(state.op).toBe('remove:genre:Rock');
  });

  it('TOGGLE_START is guarded when already pending', () => {
    const pending: TagOpState = {
      status: 'pending', tags: [rock], optimistic: [rock, jazz],
      songPath: '/a.mp3', op: 'add:genre:Jazz',
    };
    const state = tagOpReducer(pending, { type: 'TOGGLE_START', label: 'Chill', category: 'mood' });
    expect(state).toBe(pending); // same reference, no change
  });

  it('TOGGLE_START is guarded when songPath is null', () => {
    const idle = idleWith([], null);
    const state = tagOpReducer(idle, { type: 'TOGGLE_START', label: 'Rock', category: 'genre' });
    expect(state).toBe(idle);
  });

  it('TOGGLE_SUCCESS transitions pending → idle with new tags', () => {
    const pending: TagOpState = {
      status: 'pending', tags: [rock], optimistic: [rock, jazz],
      songPath: '/a.mp3', op: 'add:genre:Jazz',
    };
    const state = tagOpReducer(pending, { type: 'TOGGLE_SUCCESS', tags: [rock, jazz, chill] });
    expect(state.status).toBe('idle');
    expect(state.tags).toEqual([rock, jazz, chill]);
    expect(state.songPath).toBe('/a.mp3');
  });

  it('TOGGLE_FAILURE rolls back to original tags', () => {
    const pending: TagOpState = {
      status: 'pending', tags: [rock], optimistic: [rock, jazz],
      songPath: '/a.mp3', op: 'add:genre:Jazz',
    };
    const state = tagOpReducer(pending, { type: 'TOGGLE_FAILURE', error: 'DB error' });
    expect(state.status).toBe('error');
    expect(state.tags).toEqual([rock]); // rolled back
    if (state.status !== 'error') throw new Error('expected error');
    expect(state.error).toBe('DB error');
  });

  it('TOGGLE_START recovers from error state', () => {
    const errorState: TagOpState = {
      status: 'error', tags: [rock], songPath: '/a.mp3', error: 'prev error',
    };
    const state = tagOpReducer(errorState, { type: 'TOGGLE_START', label: 'Jazz', category: 'genre' });
    expect(state.status).toBe('pending');
    if (state.status !== 'pending') throw new Error('expected pending');
    expect(state.optimistic).toEqual([rock, jazz]);
  });

  it('CLEAR resets everything', () => {
    const state = tagOpReducer(idleWith([rock, jazz]), { type: 'CLEAR' });
    expect(state).toEqual(initialTagState);
  });
});

describe('getDisplayTags', () => {
  it('returns optimistic tags when pending', () => {
    const pending: TagOpState = {
      status: 'pending', tags: [rock], optimistic: [rock, jazz],
      songPath: '/a.mp3', op: 'add:genre:Jazz',
    };
    expect(getDisplayTags(pending)).toEqual([rock, jazz]);
  });

  it('returns actual tags when idle', () => {
    expect(getDisplayTags(idleWith([rock]))).toEqual([rock]);
  });

  it('returns actual tags when error', () => {
    const err: TagOpState = { status: 'error', tags: [rock], songPath: '/a.mp3', error: 'fail' };
    expect(getDisplayTags(err)).toEqual([rock]);
  });
});

describe('isTagPending', () => {
  it('returns true when pending', () => {
    const pending: TagOpState = {
      status: 'pending', tags: [], optimistic: [rock],
      songPath: '/a.mp3', op: 'add:genre:Rock',
    };
    expect(isTagPending(pending)).toBe(true);
  });

  it('returns false when idle', () => {
    expect(isTagPending(idleWith([]))).toBe(false);
  });
});
