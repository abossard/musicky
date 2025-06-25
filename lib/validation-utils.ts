export function isEmpty<T>(array?: T[] | null): array is undefined | null {
  return !array || array.length === 0;
}

export function isNonEmpty<T>(array?: T[] | null): array is T[] {
  return Boolean(array && array.length > 0);
}

export function isValidNumber(value: any): value is number {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}

export function isValidString(value: any): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function hasProperty<T, K extends string>(
  obj: T,
  key: K
): obj is T & Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

export function isValidTrack(track?: { no: number | null; of: number | null }): boolean {
  return Boolean(track && track.no);
}