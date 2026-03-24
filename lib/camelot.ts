/**
 * Camelot Wheel: key notation conversion and harmonic compatibility.
 *
 * Mixed In Key writes standard musical key notation into TKEY (e.g. "Gm", "C#m", "F#").
 * This module converts between standard notation and the Camelot system used by DJs
 * for harmonic mixing (e.g. "6A", "12A", "11B").
 *
 * Camelot Wheel layout:
 *   Number 1–12, Letter A (minor) / B (major)
 *   Compatible keys: same number ±1 (same letter), or same number (switch letter)
 */

/** Map from standard root note to Camelot number (minor keys → A, major keys → B) */
const MINOR_KEY_MAP: Record<string, number> = {
  'Ab': 1, 'G#': 1,
  'Eb': 2, 'D#': 2,
  'Bb': 3, 'A#': 3,
  'F': 4,
  'C': 5,
  'G': 6,
  'D': 7,
  'A': 8,
  'E': 9,
  'B': 10,
  'F#': 11, 'Gb': 11,
  'C#': 12, 'Db': 12,
};

const MAJOR_KEY_MAP: Record<string, number> = {
  'B': 1,  'Cb': 1,
  'F#': 2, 'Gb': 2,
  'C#': 3, 'Db': 3,
  'Ab': 4, 'G#': 4,
  'Eb': 5, 'D#': 5,
  'Bb': 6, 'A#': 6,
  'F': 7,
  'C': 8,
  'G': 9,
  'D': 10,
  'A': 11,
  'E': 12,
};

/** Reverse map: Camelot code → standard key notation */
const CAMELOT_TO_STANDARD: Record<string, string> = {};
for (const [note, num] of Object.entries(MINOR_KEY_MAP)) {
  // Use sharps as canonical (skip flats if already have the number)
  const code = `${num}A`;
  if (!CAMELOT_TO_STANDARD[code] || !note.includes('b')) {
    CAMELOT_TO_STANDARD[code] = `${note}m`;
  }
}
for (const [note, num] of Object.entries(MAJOR_KEY_MAP)) {
  const code = `${num}B`;
  if (!CAMELOT_TO_STANDARD[code] || !note.includes('b')) {
    CAMELOT_TO_STANDARD[code] = note;
  }
}

/**
 * Parse a standard key string from TKEY into root note + mode.
 * Examples: "Gm" → { root: "G", minor: true }
 *           "C#" → { root: "C#", minor: false }
 *           "F#m" → { root: "F#", minor: true }
 *           "Ebm" → { root: "Eb", minor: true }
 */
function parseStandardKey(key: string): { root: string; minor: boolean } | null {
  if (!key || key.length === 0) return null;
  const trimmed = key.trim();
  const minor = trimmed.endsWith('m');
  const root = minor ? trimmed.slice(0, -1) : trimmed;
  if (root.length === 0) return null;
  return { root, minor };
}

/**
 * Convert standard musical key notation to Camelot code.
 * @example standardToCamelot("Gm") → "6A"
 * @example standardToCamelot("C#m") → "12A"
 * @example standardToCamelot("F") → "7B"
 * @example standardToCamelot("F#") → "2B"
 */
export function standardToCamelot(standardKey: string): string | null {
  const parsed = parseStandardKey(standardKey);
  if (!parsed) return null;

  if (parsed.minor) {
    const num = MINOR_KEY_MAP[parsed.root];
    return num != null ? `${num}A` : null;
  } else {
    const num = MAJOR_KEY_MAP[parsed.root];
    return num != null ? `${num}B` : null;
  }
}

/**
 * Convert Camelot code to standard musical key notation.
 * @example camelotToStandard("6A") → "Gm"
 * @example camelotToStandard("8B") → "C"
 */
export function camelotToStandard(camelotKey: string): string | null {
  return CAMELOT_TO_STANDARD[camelotKey.toUpperCase()] ?? null;
}

/** Parse a Camelot code into its number and letter components. */
function parseCamelot(key: string): { num: number; letter: 'A' | 'B' } | null {
  const match = key.trim().toUpperCase().match(/^(\d{1,2})([AB])$/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (num < 1 || num > 12) return null;
  return { num, letter: match[2] as 'A' | 'B' };
}

/** Wrap Camelot number to 1–12 range. */
function wrapCamelot(n: number): number {
  return ((n - 1 + 12) % 12) + 1;
}

/**
 * Get all harmonically compatible Camelot keys for a given key.
 * Compatible = same key, ±1 position (same letter), or switch letter (same number).
 * @returns Array of 4 compatible Camelot codes (including the input key)
 */
export function getCompatibleCamelotKeys(camelotKey: string): string[] {
  const parsed = parseCamelot(camelotKey);
  if (!parsed) return [];
  const { num, letter } = parsed;
  const otherLetter = letter === 'A' ? 'B' : 'A';
  return [
    `${num}${letter}`,                    // Same key
    `${wrapCamelot(num - 1)}${letter}`,   // -1 position
    `${wrapCamelot(num + 1)}${letter}`,   // +1 position
    `${num}${otherLetter}`,               // Relative major/minor
  ];
}

/**
 * Check if two keys are harmonically compatible.
 * Accepts either standard notation or Camelot codes.
 */
export function areKeysCompatible(key1: string, key2: string): boolean {
  let c1 = parseCamelot(key1) ? key1.toUpperCase() : standardToCamelot(key1);
  let c2 = parseCamelot(key2) ? key2.toUpperCase() : standardToCamelot(key2);
  if (!c1 || !c2) return false;
  return getCompatibleCamelotKeys(c1).includes(c2);
}

/**
 * Get the harmonic distance between two Camelot keys.
 * 0 = same key, 1 = adjacent/compatible, 2+ = distant
 */
export function getKeyDistance(key1: string, key2: string): number {
  let c1 = parseCamelot(key1) ? key1 : standardToCamelot(key1);
  let c2 = parseCamelot(key2) ? key2 : standardToCamelot(key2);
  if (!c1 || !c2) return Infinity;

  const p1 = parseCamelot(c1)!;
  const p2 = parseCamelot(c2)!;

  if (p1.num === p2.num && p1.letter === p2.letter) return 0;

  const numDist = Math.min(
    Math.abs(p1.num - p2.num),
    12 - Math.abs(p1.num - p2.num)
  );
  const letterDist = p1.letter === p2.letter ? 0 : 1;

  if (numDist <= 1 && letterDist === 0) return 1;
  if (numDist === 0 && letterDist === 1) return 1;
  return numDist + letterDist;
}

/**
 * Get a CSS color for a Camelot key position.
 * Each of the 12 positions gets a distinct hue, A/B share the same hue but differ in lightness.
 */
export function getCamelotColor(key: string): string {
  let parsed = parseCamelot(key);
  if (!parsed) {
    const camelot = standardToCamelot(key);
    if (camelot) parsed = parseCamelot(camelot);
    if (!parsed) return '#888888';
  }

  const hue = ((parsed.num - 1) * 30) % 360;
  const lightness = parsed.letter === 'A' ? 45 : 60;
  return `hsl(${hue}, 70%, ${lightness}%)`;
}

/**
 * Parse "B Minor" or "C# Major" long format (Beatport TXXX:INITIAL_KEY) to standard.
 * @example parseLongKeyFormat("B Minor") → "Bm"
 * @example parseLongKeyFormat("C Major") → "C"
 */
export function parseLongKeyFormat(longKey: string): string | null {
  const match = longKey.trim().match(/^([A-G][#b]?)\s+(Minor|Major)$/i);
  if (!match) return null;
  const root = match[1];
  const minor = match[2].toLowerCase() === 'minor';
  return minor ? `${root}m` : root;
}
