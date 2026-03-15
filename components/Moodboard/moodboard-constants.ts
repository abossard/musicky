import { IconVinyl, IconWaveSine, IconHeart, IconTag, IconStar } from '@tabler/icons-react';

export type TagCategory = 'genre' | 'phase' | 'mood' | 'topic' | 'custom';

export type EdgeType = 'genre' | 'phase' | 'mood' | 'similarity' | 'topic' | 'custom';

export type ViewMode = 'free' | 'genre' | 'phase' | 'mood';

export const CATEGORY_ICONS: Record<TagCategory, typeof IconVinyl> = {
  genre: IconVinyl,
  phase: IconWaveSine,
  mood: IconHeart,
  topic: IconTag,
  custom: IconStar,
};

export const CATEGORY_COLORS: Record<string, { border: string; header: string }> = {
  violet: { border: '#9775fa', header: '#2b2042' },
  cyan: { border: '#3bc9db', header: '#1a3a42' },
  pink: { border: '#f06595', header: '#3a1a28' },
  gray: { border: '#868e96', header: '#2c2e33' },
};

export const EDGE_COLORS: Record<EdgeType, string> = {
  genre: '#22b8cf',
  phase: '#7048e8',
  mood: '#e64980',
  similarity: '#40c057',
  topic: '#fd7e14',
  custom: '#868e96',
};

export const TAG_PRESETS: { emoji: string; title: string; category: TagCategory; color: string; tags: string[] }[] = [
  { emoji: '🎭', title: 'Mood', category: 'mood', color: 'pink', tags: ['dark', 'energetic', 'dreamy', 'jungle', 'chill', 'uplifting', 'melancholic', 'hypnotic', 'aggressive', 'euphoric'] },
  { emoji: '🎵', title: 'Genre', category: 'genre', color: 'cyan', tags: ['techno', 'house', 'trance', 'melodic', 'progressive', 'minimal', 'deep', 'afro', 'disco', 'drum & bass'] },
  { emoji: '🎚️', title: 'Phase', category: 'phase', color: 'violet', tags: ['opener', 'buildup', 'peak', 'drop', 'breakdown', 'closer'] },
];

/** Edge drawing style labels for the UI selector */
export const EDGE_STYLE_OPTIONS = [
  { label: 'Curve', value: 'bezier' },
  { label: 'Straight', value: 'straight' },
  { label: 'Step', value: 'step' },
  { label: 'Smooth', value: 'smoothstep' },
  { label: 'Smart', value: 'smart' },
] as const;
