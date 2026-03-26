import { describe, it, expect } from 'vitest';
import { navigationReducer, getSelectedSongs, isLocked, getFocusedPosition, type NavigationState } from '../../components/SetView/hooks/useNavigationReducer';

describe('navigationReducer', () => {
  const idle: NavigationState = { mode: 'idle' };

  it('idle → SELECT → selected with 1 song', () => {
    const next = navigationReducer(idle, { type: 'SELECT', filePath: 'a.mp3', column: 0, index: 0 });
    expect(next.mode).toBe('selected');
    if (next.mode === 'selected') {
      expect(next.songs.size).toBe(1);
      expect(next.songs.has('a.mp3')).toBe(true);
      expect(next.column).toBe(0);
      expect(next.index).toBe(0);
    }
  });

  it('selected → EXTEND_SELECT → selected with 2 songs', () => {
    const selected: NavigationState = {
      mode: 'selected', column: 0, index: 0, songs: new Set(['a.mp3']),
    };
    const next = navigationReducer(selected, { type: 'EXTEND_SELECT', filePath: 'b.mp3', column: 0, index: 1 });
    expect(next.mode).toBe('selected');
    if (next.mode === 'selected') {
      expect(next.songs.size).toBe(2);
      expect(next.songs.has('a.mp3')).toBe(true);
      expect(next.songs.has('b.mp3')).toBe(true);
      expect(next.index).toBe(1);
    }
  });

  it('selected → LOCK → locked', () => {
    const selected: NavigationState = {
      mode: 'selected', column: 1, index: 2, songs: new Set(['a.mp3']),
    };
    const next = navigationReducer(selected, { type: 'LOCK' });
    expect(next.mode).toBe('locked');
    if (next.mode === 'locked') {
      expect(next.songs.has('a.mp3')).toBe(true);
      expect(next.column).toBe(1);
      expect(next.index).toBe(2);
    }
  });

  it('locked → UNLOCK → selected (songs preserved)', () => {
    const songs = new Set(['a.mp3', 'b.mp3']);
    const locked: NavigationState = { mode: 'locked', column: 0, index: 1, songs };
    const next = navigationReducer(locked, { type: 'UNLOCK' });
    expect(next.mode).toBe('selected');
    if (next.mode === 'selected') {
      expect(next.songs.size).toBe(2);
      expect(next.songs.has('a.mp3')).toBe(true);
      expect(next.songs.has('b.mp3')).toBe(true);
    }
  });

  it('locked → SELECT → still locked (no change)', () => {
    const locked: NavigationState = {
      mode: 'locked', column: 0, index: 0, songs: new Set(['a.mp3']),
    };
    const next = navigationReducer(locked, { type: 'SELECT', filePath: 'x.mp3', column: 1, index: 0 });
    expect(next).toBe(locked); // reference equality — no change
  });

  it('idle → LOCK → still idle (can\'t lock nothing)', () => {
    const next = navigationReducer(idle, { type: 'LOCK' });
    expect(next).toBe(idle);
  });

  it('locked → CLEAR → idle', () => {
    const locked: NavigationState = {
      mode: 'locked', column: 0, index: 0, songs: new Set(['a.mp3']),
    };
    const next = navigationReducer(locked, { type: 'CLEAR' });
    expect(next.mode).toBe('idle');
  });

  it('FOCUS from idle → focused', () => {
    const next = navigationReducer(idle, { type: 'FOCUS', column: 2, index: 3 });
    expect(next.mode).toBe('focused');
    if (next.mode === 'focused') {
      expect(next.column).toBe(2);
      expect(next.index).toBe(3);
    }
  });

  it('FOCUS from locked → no change', () => {
    const locked: NavigationState = {
      mode: 'locked', column: 0, index: 0, songs: new Set(['a.mp3']),
    };
    const next = navigationReducer(locked, { type: 'FOCUS', column: 1, index: 1 });
    expect(next).toBe(locked);
  });

  it('EXTEND_SELECT from idle → selected with 1 song', () => {
    const next = navigationReducer(idle, { type: 'EXTEND_SELECT', filePath: 'c.mp3', column: 0, index: 0 });
    expect(next.mode).toBe('selected');
    if (next.mode === 'selected') {
      expect(next.songs.size).toBe(1);
      expect(next.songs.has('c.mp3')).toBe(true);
    }
  });

  it('UPDATE_POSITION in selected → updates position, keeps songs', () => {
    const selected: NavigationState = {
      mode: 'selected', column: 0, index: 0, songs: new Set(['a.mp3']),
    };
    const next = navigationReducer(selected, { type: 'UPDATE_POSITION', column: 2, index: 5 });
    expect(next.mode).toBe('selected');
    if (next.mode === 'selected') {
      expect(next.column).toBe(2);
      expect(next.index).toBe(5);
      expect(next.songs.has('a.mp3')).toBe(true);
    }
  });

  it('UPDATE_POSITION in idle → no change', () => {
    const next = navigationReducer(idle, { type: 'UPDATE_POSITION', column: 1, index: 1 });
    expect(next).toBe(idle);
  });

  it('selected with empty songs → LOCK → still selected (guard)', () => {
    const selected: NavigationState = {
      mode: 'selected', column: 0, index: 0, songs: new Set(),
    };
    const next = navigationReducer(selected, { type: 'LOCK' });
    expect(next).toBe(selected);
  });

  it('UNLOCK from non-locked → no change', () => {
    const selected: NavigationState = {
      mode: 'selected', column: 0, index: 0, songs: new Set(['a.mp3']),
    };
    const next = navigationReducer(selected, { type: 'UNLOCK' });
    expect(next).toBe(selected);
  });
});

describe('helper selectors', () => {
  it('getSelectedSongs returns songs for selected/locked, empty for others', () => {
    expect(getSelectedSongs({ mode: 'idle' }).size).toBe(0);
    expect(getSelectedSongs({ mode: 'focused', column: 0, index: 0 }).size).toBe(0);
    const songs = new Set(['a.mp3']);
    expect(getSelectedSongs({ mode: 'selected', column: 0, index: 0, songs })).toBe(songs);
    expect(getSelectedSongs({ mode: 'locked', column: 0, index: 0, songs })).toBe(songs);
  });

  it('isLocked returns true only for locked mode', () => {
    expect(isLocked({ mode: 'idle' })).toBe(false);
    expect(isLocked({ mode: 'focused', column: 0, index: 0 })).toBe(false);
    expect(isLocked({ mode: 'selected', column: 0, index: 0, songs: new Set() })).toBe(false);
    expect(isLocked({ mode: 'locked', column: 0, index: 0, songs: new Set(['a.mp3']) })).toBe(true);
  });

  it('getFocusedPosition returns null for idle, position for others', () => {
    expect(getFocusedPosition({ mode: 'idle' })).toBeNull();
    expect(getFocusedPosition({ mode: 'focused', column: 1, index: 2 })).toEqual({ column: 1, index: 2 });
    expect(getFocusedPosition({ mode: 'selected', column: 3, index: 4, songs: new Set() })).toEqual({ column: 3, index: 4 });
  });
});
