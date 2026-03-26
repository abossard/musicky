import React, { useState, useEffect, useCallback } from 'react';
import { Stack, Text, Box, Badge, Group, Divider, ActionIcon, Tooltip, Loader } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { onGetAllTags, onGetTagSuggestions } from '../Moodboard/MoodboardPage.telefunc';

interface TagPaletteProps {
  selectedSong: string | null;
  activeTags: { label: string; category: string }[];
  onToggleTag: (label: string, category: string) => void;
}

interface TagOption {
  label: string;
  count: number;
}

function TagPaletteSidebarInner({ selectedSong, activeTags, onToggleTag }: TagPaletteProps) {
  const [genres, setGenres] = useState<TagOption[]>([]);
  const [moods, setMoods] = useState<TagOption[]>([]);
  const [suggestions, setSuggestions] = useState<{ genres: string[]; moods: string[] } | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Load available tags
  useEffect(() => {
    onGetAllTags('genre').then(tags => setGenres(tags.map(t => ({ label: t.label, count: t.count }))));
    onGetAllTags('mood').then(tags => setMoods(tags.map(t => ({ label: t.label, count: t.count }))));
  }, []);

  // Clear suggestions when song changes
  useEffect(() => {
    setSuggestions(null);
  }, [selectedSong]);

  const handleSuggest = useCallback(async () => {
    if (!selectedSong) return;
    setLoadingSuggestions(true);
    try {
      const result = await onGetTagSuggestions(selectedSong);
      setSuggestions({ genres: result.genres, moods: result.moods });
    } catch {
      setSuggestions(null);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [selectedSong]);

  const isActive = (label: string, category: string) =>
    activeTags.some(t => t.label === label && t.category === category);

  const renderTagButton = (label: string, category: string, color: string, isSuggested?: boolean) => {
    const active = isActive(label, category);
    return (
      <Badge
        key={`${category}-${label}`}
        size="sm"
        variant={active ? 'filled' : isSuggested ? 'outline' : 'light'}
        color={active ? color : isSuggested ? 'violet' : 'dark'}
        style={{
          cursor: selectedSong ? 'pointer' : 'default',
          opacity: selectedSong ? 1 : 0.5,
          boxShadow: isSuggested && !active ? '0 0 8px rgba(124,58,237,0.3)' : undefined,
          transition: 'all 0.15s',
        }}
        leftSection={isSuggested && !active ? <IconSparkles size={8} /> : undefined}
        onClick={() => selectedSong && onToggleTag(label, category)}
      >
        {label}
      </Badge>
    );
  };

  return (
    <Box style={{
      width: 180,
      flexShrink: 0,
      borderLeft: '1px solid var(--mantine-color-dark-5)',
      background: 'var(--mantine-color-dark-7)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Group gap={6} px={10} py={8} style={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}>
        <Text size="xs" fw={700} tt="uppercase" style={{ letterSpacing: 1, flex: 1 }}>
          Tags
        </Text>
        {selectedSong && (
          <Tooltip label="AI suggestions" position="left">
            <ActionIcon size="xs" variant="subtle" color="violet" onClick={handleSuggest} loading={loadingSuggestions}>
              <IconSparkles size={12} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      <Box style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
        {!selectedSong ? (
          <Text size="xs" c="dimmed" ta="center" py="xl">Select a song to tag</Text>
        ) : (
          <Stack gap="md">
            {/* Genres */}
            <Box>
              <Text size="xs" fw={600} c="cyan" mb={4}>GENRES</Text>
              <Group gap={4} wrap="wrap">
                {/* AI-suggested genres first */}
                {suggestions?.genres
                  .filter(g => !genres.some(gx => gx.label === g))
                  .map(g => renderTagButton(g, 'genre', 'cyan', true))}
                {suggestions?.genres
                  .filter(g => genres.some(gx => gx.label === g))
                  .map(g => renderTagButton(g, 'genre', 'cyan', true))}
                {genres
                  .filter(g => !suggestions?.genres.includes(g.label))
                  .map(g => renderTagButton(g.label, 'genre', 'cyan'))}
              </Group>
            </Box>

            <Divider />

            {/* Moods */}
            <Box>
              <Text size="xs" fw={600} c="pink" mb={4}>MOODS</Text>
              <Group gap={4} wrap="wrap">
                {suggestions?.moods
                  .filter(m => !moods.some(mx => mx.label === m))
                  .map(m => renderTagButton(m, 'mood', 'pink', true))}
                {suggestions?.moods
                  .filter(m => moods.some(mx => mx.label === m))
                  .map(m => renderTagButton(m, 'mood', 'pink', true))}
                {moods
                  .filter(m => !suggestions?.moods.includes(m.label))
                  .map(m => renderTagButton(m.label, 'mood', 'pink'))}
              </Group>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}

export const TagPaletteSidebar = React.memo(TagPaletteSidebarInner);
