import { parseHashtags } from './mp3-parsing';

/** Known tag vocabularies — used to categorize hashtags */
const KNOWN_PHASES = new Set(['opener', 'buildup', 'peak', 'drop', 'breakdown', 'cooldown', 'closer', 'feature', 'warmup', 'release', 'starter']);
const KNOWN_MOODS = new Set(['dark', 'energetic', 'dreamy', 'euphoric', 'hypnotic', 'melancholic', 'aggressive', 'chill', 'uplifting', 'groovy']);

export interface CategorizedTags {
  phases: string[];
  genres: string[];
  moods: string[];
  custom: string[];
}

/**
 * Categorize parsed hashtags into phases, genres, moods, and custom.
 * Known phases and moods are matched by name.
 * Everything else is assumed to be a genre (most common DJ tag type).
 * Accepts optional known tags from the database for better matching.
 */
export function categorizeHashtags(
  hashtags: string[],
  knownGenres?: Set<string>,
  knownMoods?: Set<string>,
  knownPhases?: Set<string>,
): CategorizedTags {
  const result: CategorizedTags = { phases: [], genres: [], moods: [], custom: [] };

  for (const tag of hashtags) {
    const lower = tag.toLowerCase();
    if (KNOWN_PHASES.has(lower) || knownPhases?.has(lower)) {
      result.phases.push(lower);
    } else if (KNOWN_MOODS.has(lower) || knownMoods?.has(lower)) {
      result.moods.push(lower);
    } else if (knownGenres?.has(lower)) {
      result.genres.push(lower);
    } else {
      // Default: assume it's a genre (most DJ hashtags are genres)
      result.genres.push(lower);
    }
  }

  return result;
}
