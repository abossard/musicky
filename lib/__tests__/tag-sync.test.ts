import { describe, it, expect } from 'vitest';
import { computeTagDiff } from '../tag-sync-engine';

const empty = { genres: [], phases: [], moods: [], topics: [], tags: [] };

describe('computeTagDiff', () => {
  it('returns no diffs when current equals proposed', () => {
    const tags = { genres: ['house'], phases: ['peak'], moods: ['dark'], topics: [], tags: [] };
    expect(computeTagDiff(tags, tags)).toEqual([]);
  });

  it('returns no diffs when both are empty', () => {
    expect(computeTagDiff(empty, empty)).toEqual([]);
  });

  it('detects genre change', () => {
    const current = { ...empty, genres: ['house'] };
    const proposed = { ...empty, genres: ['techno'] };
    const diffs = computeTagDiff(current, proposed);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe('µ:genres');
    expect(diffs[0].currentValue).toBe('house');
    expect(diffs[0].proposedValue).toBe('techno');
  });

  it('detects multiple field changes', () => {
    const current = { genres: ['house'], phases: ['intro'], moods: ['chill'], topics: [], tags: [] };
    const proposed = { genres: ['techno'], phases: ['peak'], moods: ['dark'], topics: [], tags: [] };
    const diffs = computeTagDiff(current, proposed);
    expect(diffs).toHaveLength(3);
    const fields = diffs.map(d => d.field);
    expect(fields).toContain('µ:genres');
    expect(fields).toContain('µ:phases');
    expect(fields).toContain('µ:moods');
  });

  it('normalizes order before comparison', () => {
    const current = { ...empty, genres: ['techno', 'house'] };
    const proposed = { ...empty, genres: ['house', 'techno'] };
    // After sorting, both become "house, techno"
    expect(computeTagDiff(current, proposed)).toEqual([]);
  });

  it('skips diff when proposed is empty', () => {
    const current = { ...empty, genres: ['house'] };
    const proposed = { ...empty, genres: [] };
    expect(computeTagDiff(current, proposed)).toEqual([]);
  });

  it('generates diff when current is empty but proposed is not', () => {
    const proposed = { ...empty, moods: ['energetic'] };
    const diffs = computeTagDiff(empty, proposed);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].field).toBe('µ:moods');
    expect(diffs[0].currentValue).toBe('');
    expect(diffs[0].proposedValue).toBe('energetic');
  });

  it('handles topics and tags fields', () => {
    const current = { ...empty, topics: ['summer'], tags: ['favorite'] };
    const proposed = { ...empty, topics: ['winter'], tags: ['classic'] };
    const diffs = computeTagDiff(current, proposed);
    expect(diffs).toHaveLength(2);
    const fields = diffs.map(d => d.field);
    expect(fields).toContain('µ:topics');
    expect(fields).toContain('µ:tags');
  });

  it('produces comma-separated sorted values', () => {
    const current = { ...empty, genres: [] };
    const proposed = { ...empty, genres: ['techno', 'acid', 'house'] };
    const diffs = computeTagDiff(current, proposed);
    expect(diffs[0].proposedValue).toBe('acid, house, techno');
  });

  it('detects partial overlap as a change', () => {
    const current = { ...empty, genres: ['house', 'techno'] };
    const proposed = { ...empty, genres: ['house', 'trance'] };
    const diffs = computeTagDiff(current, proposed);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].currentValue).toBe('house, techno');
    expect(diffs[0].proposedValue).toBe('house, trance');
  });
});
