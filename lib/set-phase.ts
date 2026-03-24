export interface SetPhase {
  id: string;
  name: string;
  description: string;
  targetBpmRange?: [number, number];
  targetEnergyRange?: [number, number];
  color?: string;
}

export function toKebabCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Convert a plain phase name string to a SetPhase object */
export function stringToSetPhase(name: string): SetPhase {
  return {
    id: toKebabCase(name),
    name,
    description: '',
  };
}

/** Auto-migrate: if the parsed JSON is a string[], convert to SetPhase[] */
export function migratePhases(parsed: unknown): SetPhase[] {
  if (!Array.isArray(parsed)) return [];
  if (parsed.length === 0) return [];

  // Already SetPhase[] (objects with id + name)
  if (typeof parsed[0] === 'object' && parsed[0] !== null && 'id' in parsed[0] && 'name' in parsed[0]) {
    return parsed as SetPhase[];
  }

  // Legacy string[]
  if (typeof parsed[0] === 'string') {
    return (parsed as string[]).map(stringToSetPhase);
  }

  return [];
}
