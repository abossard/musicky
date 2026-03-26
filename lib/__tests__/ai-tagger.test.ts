import { describe, it, expect } from 'vitest';
import { buildSuggestionPrompt, parseSuggestionResponse } from '../ai-tagger';

describe('buildSuggestionPrompt', () => {
  it('includes song title and artist', () => {
    const prompt = buildSuggestionPrompt({ title: 'Strobe', artist: 'Deadmau5' });
    expect(prompt).toContain('Strobe');
    expect(prompt).toContain('Deadmau5');
  });

  it('includes BPM when provided', () => {
    const prompt = buildSuggestionPrompt({ title: 'Test', bpm: 128 });
    expect(prompt).toContain('128');
  });

  it('includes key when provided', () => {
    const prompt = buildSuggestionPrompt({ title: 'Test', key: 'Am' });
    expect(prompt).toContain('Am');
  });

  it('includes energy level when provided', () => {
    const prompt = buildSuggestionPrompt({ title: 'Test', energyLevel: 7 });
    expect(prompt).toContain('7/10');
  });

  it('includes existing genres, moods, phases', () => {
    const prompt = buildSuggestionPrompt({
      title: 'Test',
      existingGenres: ['house', 'techno'],
      existingMoods: ['dark'],
      existingPhases: ['peak'],
    });
    expect(prompt).toContain('house, techno');
    expect(prompt).toContain('dark');
    expect(prompt).toContain('peak');
  });

  it('includes known vocabulary tags', () => {
    const prompt = buildSuggestionPrompt({
      title: 'Test',
      knownTags: {
        genres: ['house', 'techno', 'trance'],
        moods: ['energetic', 'dark', 'chill'],
        phases: ['intro', 'build', 'peak'],
      },
    });
    expect(prompt).toContain('house, techno, trance');
    expect(prompt).toContain('energetic, dark, chill');
    expect(prompt).toContain('intro, build, peak');
  });

  it('uses "Unknown" for missing title and artist', () => {
    const prompt = buildSuggestionPrompt({});
    expect(prompt).toContain('Unknown');
  });

  it('omits BPM/key/energy lines when not provided', () => {
    const prompt = buildSuggestionPrompt({ title: 'Test' });
    expect(prompt).not.toContain('BPM:');
    expect(prompt).not.toContain('Key:');
    expect(prompt).not.toContain('Energy:');
  });

  it('asks for JSON response format', () => {
    const prompt = buildSuggestionPrompt({ title: 'Test' });
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('genres');
    expect(prompt).toContain('moods');
    expect(prompt).toContain('phases');
  });
});

describe('parseSuggestionResponse', () => {
  it('parses valid JSON response', () => {
    const response = '{"genres": ["House", "Techno"], "moods": ["Dark"], "phases": ["Peak"]}';
    const result = parseSuggestionResponse(response);
    expect(result.genres).toEqual(['house', 'techno']);
    expect(result.moods).toEqual(['dark']);
    expect(result.phases).toEqual(['peak']);
  });

  it('strips markdown code fences', () => {
    const response = '```json\n{"genres": ["House"], "moods": ["Chill"], "phases": ["Intro"]}\n```';
    const result = parseSuggestionResponse(response);
    expect(result.genres).toEqual(['house']);
    expect(result.moods).toEqual(['chill']);
    expect(result.phases).toEqual(['intro']);
  });

  it('normalizes to lowercase and trims', () => {
    const response = '{"genres": [" HOUSE ", " Techno"], "moods": [], "phases": []}';
    const result = parseSuggestionResponse(response);
    expect(result.genres).toEqual(['house', 'techno']);
  });

  it('limits each category to 5 items', () => {
    const response = '{"genres": ["a","b","c","d","e","f","g"], "moods": [], "phases": []}';
    const result = parseSuggestionResponse(response);
    expect(result.genres).toHaveLength(5);
  });

  it('handles missing arrays with empty defaults', () => {
    const response = '{"genres": ["house"]}';
    const result = parseSuggestionResponse(response);
    expect(result.genres).toEqual(['house']);
    expect(result.moods).toEqual([]);
    expect(result.phases).toEqual([]);
  });

  it('returns empty arrays when properties are not arrays', () => {
    const response = '{"genres": "house", "moods": 42, "phases": null}';
    const result = parseSuggestionResponse(response);
    expect(result.genres).toEqual([]);
    expect(result.moods).toEqual([]);
    expect(result.phases).toEqual([]);
  });

  it('throws on completely malformed JSON', () => {
    expect(() => parseSuggestionResponse('not json at all')).toThrow();
  });

  it('handles empty JSON object', () => {
    const result = parseSuggestionResponse('{}');
    expect(result.genres).toEqual([]);
    expect(result.moods).toEqual([]);
    expect(result.phases).toEqual([]);
  });
});
