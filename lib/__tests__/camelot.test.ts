import { describe, it, expect } from 'vitest';
import {
  standardToCamelot,
  camelotToStandard,
  getCompatibleCamelotKeys,
  areKeysCompatible,
  getKeyDistance,
  getCamelotColor,
  parseLongKeyFormat,
} from '../camelot';

describe('standardToCamelot', () => {
  it('converts all minor keys', () => {
    const cases: [string, string][] = [
      ['Abm', '1A'], ['G#m', '1A'],
      ['Ebm', '2A'], ['D#m', '2A'],
      ['Bbm', '3A'], ['A#m', '3A'],
      ['Fm', '4A'],
      ['Cm', '5A'],
      ['Gm', '6A'],
      ['Dm', '7A'],
      ['Am', '8A'],
      ['Em', '9A'],
      ['Bm', '10A'],
      ['F#m', '11A'], ['Gbm', '11A'],
      ['C#m', '12A'], ['Dbm', '12A'],
    ];
    for (const [input, expected] of cases) {
      expect(standardToCamelot(input), `${input}`).toBe(expected);
    }
  });

  it('converts all major keys', () => {
    const cases: [string, string][] = [
      ['B', '1B'], ['Cb', '1B'],
      ['F#', '2B'], ['Gb', '2B'],
      ['C#', '3B'], ['Db', '3B'],
      ['Ab', '4B'], ['G#', '4B'],
      ['Eb', '5B'], ['D#', '5B'],
      ['Bb', '6B'], ['A#', '6B'],
      ['F', '7B'],
      ['C', '8B'],
      ['G', '9B'],
      ['D', '10B'],
      ['A', '11B'],
      ['E', '12B'],
    ];
    for (const [input, expected] of cases) {
      expect(standardToCamelot(input), `${input}`).toBe(expected);
    }
  });

  it('returns null for invalid input', () => {
    expect(standardToCamelot('')).toBeNull();
    expect(standardToCamelot('X')).toBeNull();
    expect(standardToCamelot('Hm')).toBeNull();
    expect(standardToCamelot('m')).toBeNull();
  });
});

describe('camelotToStandard', () => {
  it('converts camelot codes to standard notation', () => {
    expect(camelotToStandard('6A')).toBe('Gm');
    expect(camelotToStandard('8B')).toBe('C');
    expect(camelotToStandard('12A')).toBe('C#m');
    expect(camelotToStandard('1B')).toBe('B');
    expect(camelotToStandard('7B')).toBe('F');
  });

  it('is case-insensitive', () => {
    expect(camelotToStandard('6a')).toBe('Gm');
    expect(camelotToStandard('8b')).toBe('C');
  });

  it('returns null for invalid codes', () => {
    expect(camelotToStandard('0A')).toBeNull();
    expect(camelotToStandard('13A')).toBeNull();
    expect(camelotToStandard('6C')).toBeNull();
    expect(camelotToStandard('')).toBeNull();
    expect(camelotToStandard('abc')).toBeNull();
  });
});

describe('getCompatibleCamelotKeys', () => {
  it('returns 4 compatible keys', () => {
    const keys = getCompatibleCamelotKeys('6A');
    expect(keys).toHaveLength(4);
    expect(keys).toContain('6A');  // same
    expect(keys).toContain('5A');  // -1
    expect(keys).toContain('7A');  // +1
    expect(keys).toContain('6B');  // relative major
  });

  it('wraps around from 1 to 12', () => {
    const keys = getCompatibleCamelotKeys('1A');
    expect(keys).toContain('1A');
    expect(keys).toContain('12A'); // wraps backward
    expect(keys).toContain('2A');
    expect(keys).toContain('1B');
  });

  it('wraps around from 12 to 1', () => {
    const keys = getCompatibleCamelotKeys('12B');
    expect(keys).toContain('12B');
    expect(keys).toContain('11B');
    expect(keys).toContain('1B');  // wraps forward
    expect(keys).toContain('12A');
  });

  it('returns empty for invalid input', () => {
    expect(getCompatibleCamelotKeys('invalid')).toEqual([]);
    expect(getCompatibleCamelotKeys('')).toEqual([]);
  });
});

describe('areKeysCompatible', () => {
  it('returns true for adjacent camelot keys', () => {
    expect(areKeysCompatible('6A', '7A')).toBe(true);
    expect(areKeysCompatible('6A', '5A')).toBe(true);
    expect(areKeysCompatible('6A', '6B')).toBe(true);
    expect(areKeysCompatible('6A', '6A')).toBe(true);
  });

  it('accepts standard notation', () => {
    expect(areKeysCompatible('Gm', 'Dm')).toBe(true);  // 6A ↔ 7A
    expect(areKeysCompatible('Am', 'C')).toBe(true);    // 8A ↔ 8B
  });

  it('returns false for distant keys', () => {
    expect(areKeysCompatible('1A', '6A')).toBe(false);
    expect(areKeysCompatible('Am', 'F#')).toBe(false);
  });

  it('returns false for invalid keys', () => {
    expect(areKeysCompatible('invalid', '6A')).toBe(false);
    expect(areKeysCompatible('6A', '')).toBe(false);
  });
});

describe('getKeyDistance', () => {
  it('returns 0 for same key', () => {
    expect(getKeyDistance('6A', '6A')).toBe(0);
    expect(getKeyDistance('Gm', 'Gm')).toBe(0);
  });

  it('returns 1 for adjacent keys', () => {
    expect(getKeyDistance('6A', '7A')).toBe(1);
    expect(getKeyDistance('6A', '5A')).toBe(1);
    expect(getKeyDistance('6A', '6B')).toBe(1);
  });

  it('returns >1 for distant keys', () => {
    expect(getKeyDistance('1A', '6A')).toBeGreaterThan(1);
  });

  it('wraps distances around the wheel', () => {
    // 1A to 12A should be distance 1 (adjacent via wrap)
    expect(getKeyDistance('1A', '12A')).toBe(1);
  });

  it('returns Infinity for invalid keys', () => {
    expect(getKeyDistance('invalid', '6A')).toBe(Infinity);
    expect(getKeyDistance('6A', '')).toBe(Infinity);
  });
});

describe('getCamelotColor', () => {
  it('returns HSL color for valid camelot key', () => {
    const color = getCamelotColor('6A');
    expect(color).toMatch(/^hsl\(\d+, 70%, \d+%\)$/);
  });

  it('returns different lightness for A vs B', () => {
    const colorA = getCamelotColor('6A');
    const colorB = getCamelotColor('6B');
    expect(colorA).toContain('45%');
    expect(colorB).toContain('60%');
  });

  it('accepts standard notation', () => {
    const color = getCamelotColor('Gm');
    expect(color).toMatch(/^hsl\(/);
  });

  it('returns gray for invalid key', () => {
    expect(getCamelotColor('invalid')).toBe('#888888');
    expect(getCamelotColor('')).toBe('#888888');
  });
});

describe('parseLongKeyFormat', () => {
  it('parses minor keys', () => {
    expect(parseLongKeyFormat('B Minor')).toBe('Bm');
    expect(parseLongKeyFormat('C# Minor')).toBe('C#m');
    expect(parseLongKeyFormat('Eb Minor')).toBe('Ebm');
  });

  it('parses major keys', () => {
    expect(parseLongKeyFormat('C Major')).toBe('C');
    expect(parseLongKeyFormat('F# Major')).toBe('F#');
    expect(parseLongKeyFormat('Bb Major')).toBe('Bb');
  });

  it('is case-insensitive for mode', () => {
    expect(parseLongKeyFormat('B minor')).toBe('Bm');
    expect(parseLongKeyFormat('C MAJOR')).toBe('C');
  });

  it('trims whitespace', () => {
    expect(parseLongKeyFormat('  B Minor  ')).toBe('Bm');
  });

  it('returns null for invalid formats', () => {
    expect(parseLongKeyFormat('')).toBeNull();
    expect(parseLongKeyFormat('B')).toBeNull();
    expect(parseLongKeyFormat('Minor')).toBeNull();
    expect(parseLongKeyFormat('H Minor')).toBeNull();
    expect(parseLongKeyFormat('B Diminished')).toBeNull();
  });
});
