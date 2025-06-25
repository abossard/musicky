export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalize(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}