import { describe, it, expect } from 'vitest';
import {
  extractMusickTagsFromFrames,
  extractMIKAttributes,
  extractCommentText,
} from '../mp3-parsing';

describe('extractMusickTagsFromFrames', () => {
  it('extracts genres, moods, phases from TXXX frames', () => {
    const frames = [
      { id: 'TXXX:µ:genres', value: 'house, techno' },
      { id: 'TXXX:µ:moods', value: 'energetic, dark' },
      { id: 'TXXX:µ:phases', value: 'peak, build' },
    ];
    const result = extractMusickTagsFromFrames(frames);
    expect(result).not.toBeNull();
    expect(result!.genres).toEqual(['house', 'techno']);
    expect(result!.moods).toEqual(['energetic', 'dark']);
    expect(result!.phases).toEqual(['peak', 'build']);
  });

  it('extracts topics and tags', () => {
    const frames = [
      { id: 'TXXX:µ:topics', value: 'summer, festival' },
      { id: 'TXXX:µ:tags', value: 'favorite, classic' },
    ];
    const result = extractMusickTagsFromFrames(frames);
    expect(result!.topics).toEqual(['summer', 'festival']);
    expect(result!.tags).toEqual(['favorite', 'classic']);
  });

  it('parses related as JSON', () => {
    const related = [{ title: 'Song A', artist: 'Artist X', type: 'similarity', weight: 0.8 }];
    const frames = [
      { id: 'TXXX:µ:related', value: JSON.stringify(related) },
    ];
    const result = extractMusickTagsFromFrames(frames);
    expect(result!.related).toEqual(related);
  });

  it('parses version as integer', () => {
    const frames = [
      { id: 'TXXX:µ:version', value: '2' },
    ];
    const result = extractMusickTagsFromFrames(frames);
    expect(result!.version).toBe(2);
  });

  it('handles object-style frame values with text property', () => {
    const frames = [
      { id: 'TXXX:µ:genres', value: { text: 'house, trance' } },
    ];
    const result = extractMusickTagsFromFrames(frames);
    expect(result!.genres).toEqual(['house', 'trance']);
  });

  it('handles object-style frame values with value property', () => {
    const frames = [
      { id: 'TXXX:µ:moods', value: { value: 'chill' } },
    ];
    const result = extractMusickTagsFromFrames(frames);
    expect(result!.moods).toEqual(['chill']);
  });

  it('returns null when no µ: frames exist', () => {
    const frames = [
      { id: 'TXXX:EnergyLevel', value: '5' },
      { id: 'TIT2', value: 'Some Song' },
    ];
    expect(extractMusickTagsFromFrames(frames)).toBeNull();
  });

  it('returns null for empty frames array', () => {
    expect(extractMusickTagsFromFrames([])).toBeNull();
  });

  it('filters out empty strings from comma-separated lists', () => {
    const frames = [
      { id: 'TXXX:µ:genres', value: 'house,,techno, ,' },
    ];
    const result = extractMusickTagsFromFrames(frames);
    expect(result!.genres).toEqual(['house', 'techno']);
  });

  it('skips frames with non-string non-object values', () => {
    const frames = [
      { id: 'TXXX:µ:genres', value: 42 },
    ];
    expect(extractMusickTagsFromFrames(frames)).toBeNull();
  });

  it('handles malformed JSON in related field gracefully', () => {
    const frames = [
      { id: 'TXXX:µ:related', value: 'not valid json' },
      { id: 'TXXX:µ:genres', value: 'house' },
    ];
    const result = extractMusickTagsFromFrames(frames);
    expect(result).not.toBeNull();
    expect(result!.related).toBeUndefined();
    expect(result!.genres).toEqual(['house']);
  });
});

describe('extractMIKAttributes', () => {
  it('extracts energy level from TXXX:EnergyLevel', () => {
    const frames = [
      { id: 'TXXX:EnergyLevel', value: '7' },
    ];
    const result = extractMIKAttributes(frames);
    expect(result.energyLevel).toBe(7);
  });

  it('extracts label from TXXX:LABEL', () => {
    const frames = [
      { id: 'TXXX:LABEL', value: 'Defected Records' },
    ];
    const result = extractMIKAttributes(frames);
    expect(result.label).toBe('Defected Records');
  });

  it('extracts both energy and label', () => {
    const frames = [
      { id: 'TXXX:EnergyLevel', value: '3' },
      { id: 'TXXX:LABEL', value: 'Anjunadeep' },
    ];
    const result = extractMIKAttributes(frames);
    expect(result.energyLevel).toBe(3);
    expect(result.label).toBe('Anjunadeep');
  });

  it('rejects energy level outside 1-10 range', () => {
    expect(extractMIKAttributes([{ id: 'TXXX:EnergyLevel', value: '0' }]).energyLevel).toBeUndefined();
    expect(extractMIKAttributes([{ id: 'TXXX:EnergyLevel', value: '11' }]).energyLevel).toBeUndefined();
    expect(extractMIKAttributes([{ id: 'TXXX:EnergyLevel', value: '-1' }]).energyLevel).toBeUndefined();
  });

  it('rejects non-numeric energy level', () => {
    expect(extractMIKAttributes([{ id: 'TXXX:EnergyLevel', value: 'high' }]).energyLevel).toBeUndefined();
  });

  it('trims label whitespace', () => {
    const result = extractMIKAttributes([{ id: 'TXXX:LABEL', value: '  Spinnin  ' }]);
    expect(result.label).toBe('Spinnin');
  });

  it('ignores empty label', () => {
    const result = extractMIKAttributes([{ id: 'TXXX:LABEL', value: '   ' }]);
    expect(result.label).toBeUndefined();
  });

  it('returns empty object for unrelated frames', () => {
    const frames = [
      { id: 'TIT2', value: 'Song Title' },
      { id: 'TXXX:µ:genres', value: 'house' },
    ];
    const result = extractMIKAttributes(frames);
    expect(result.energyLevel).toBeUndefined();
    expect(result.label).toBeUndefined();
  });

  it('returns empty object for empty frames', () => {
    const result = extractMIKAttributes([]);
    expect(result.energyLevel).toBeUndefined();
    expect(result.label).toBeUndefined();
  });

  it('handles non-string frame value for energy', () => {
    const result = extractMIKAttributes([{ id: 'TXXX:EnergyLevel', value: 7 }]);
    expect(result.energyLevel).toBeUndefined();
  });
});

describe('extractCommentText', () => {
  it('returns string comment directly', () => {
    expect(extractCommentText(['Hello world'])).toBe('Hello world');
  });

  it('extracts text property from object comment', () => {
    expect(extractCommentText([{ text: 'A comment', language: 'eng' }])).toBe('A comment');
  });

  it('returns first comment from multiple', () => {
    expect(extractCommentText(['first', 'second'])).toBe('first');
  });

  it('returns undefined for empty array', () => {
    expect(extractCommentText([])).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(extractCommentText(undefined)).toBeUndefined();
  });

  it('returns undefined for non-array', () => {
    expect(extractCommentText(null as any)).toBeUndefined();
  });

  it('returns undefined for object without text property', () => {
    expect(extractCommentText([{ lang: 'eng' }])).toBeUndefined();
  });
});
