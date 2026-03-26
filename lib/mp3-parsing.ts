/**
 * Pure calculation functions extracted from MP3MetadataManager.
 * These have no I/O — they transform data structures only.
 */
import { MUSICK_TAG_PREFIX, type MusickTagData, type MusickTagField } from './mp3-metadata';

/** Pure calculation: extract Musicky tags from raw native ID3v2 frames */
export function extractMusickTagsFromFrames(
  nativeFrames: Array<{ id: string; value: any }>
): MusickTagData | null {
  const txxxPrefix = `TXXX:${MUSICK_TAG_PREFIX}`;
  const txxxFrames = nativeFrames.filter(
    (f: { id: string; value: any }) => f.id.startsWith(txxxPrefix)
  );

  if (txxxFrames.length === 0) return null;

  const tagData: MusickTagData = {};
  for (const frame of txxxFrames) {
    const key = frame.id.slice(txxxPrefix.length) as MusickTagField;
    let val: string;
    if (typeof frame.value === 'string') {
      val = frame.value;
    } else if (typeof frame.value === 'object' && frame.value) {
      const obj = frame.value as Record<string, unknown>;
      val = (obj.text as string) ?? (obj.value as string) ?? '';
    } else {
      continue;
    }

    switch (key) {
      case 'genres':
      case 'phases':
      case 'moods':
      case 'topics':
      case 'tags':
        tagData[key] = val.split(',').map((s: string) => s.trim()).filter(Boolean);
        break;
      case 'related':
        try { tagData.related = JSON.parse(val); } catch { /* ignore malformed */ }
        break;
      case 'version':
        tagData.version = parseInt(val, 10) || 1;
        break;
    }
  }

  return Object.keys(tagData).length > 0 ? tagData : null;
}

/** Pure calculation: extract MIK (Mixed In Key) and store attributes from native frames */
export function extractMIKAttributes(
  nativeFrames: Array<{ id: string; value: any }>
): { energyLevel?: number; label?: string } {
  let energyLevel: number | undefined;
  let label: string | undefined;

  for (const frame of nativeFrames) {
    const val = typeof frame.value === 'string' ? frame.value : '';
    switch (frame.id) {
      case 'TXXX:EnergyLevel': {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
          energyLevel = parsed;
        }
        break;
      }
      case 'TXXX:LABEL':
        if (val.trim()) label = val.trim();
        break;
    }
  }

  return { energyLevel, label };
}

/** Pure calculation: extract comment text from metadata comment objects */
export function extractCommentText(comments?: any[]): string | undefined {
  if (!comments || !Array.isArray(comments) || comments.length === 0) {
    return undefined;
  }

  const firstComment = comments[0];
  if (typeof firstComment === 'string') {
    return firstComment;
  }

  if (typeof firstComment === 'object' && firstComment.text) {
    return firstComment.text;
  }

  return undefined;
}
