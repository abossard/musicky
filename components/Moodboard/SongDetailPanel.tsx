import { useState, useEffect, useCallback } from 'react';
import {
  Stack, Text, Image, Badge, Button, TextInput, Group, Divider,
  Skeleton, ScrollArea, ActionIcon, Tooltip, Box, Progress, Loader,
} from '@mantine/core';
import {
  IconPlayerPlay, IconX, IconPlus, IconLink, IconMusic,
  IconArrowRight, IconArrowLeft, IconSearch, IconSparkles,
} from '@tabler/icons-react';
import {
  onGetSongMetadata, onGetSongTags, onGetSongConnections,
  onAddSongTag, onRemoveSongTag, onFindSimilarSongs,
  onGetTagSuggestions,
} from './MoodboardPage.telefunc';
import { getCamelotColor } from '../../lib/camelot';
import { showSuccess } from '../../lib/notifications';

import './SongDetailPanel.css';

export interface SongDetailPanelProps {
  filePath: string | null;
  onSongSelect?: (filePath: string) => void;
  onPlay?: (filePath: string) => void;
  onTagsChanged?: () => void;
}

interface SongMeta {
  filePath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre: string[];
  artworkDataUrl: string | null;
  key?: string;
  camelotKey?: string;
  bpm?: number;
  energyLevel?: number;
  label?: string;
}

interface TagInfo {
  id: number;
  label: string;
  category: string;
  source: string;
}

interface ConnectionInfo {
  id: number;
  otherPath: string;
  otherTitle: string;
  otherArtist: string;
  type: string;
  weight: number;
  direction: 'outgoing' | 'incoming';
}

interface SimilarSong {
  filePath: string;
  title: string;
  artist: string;
  score: number;
}

type TagCategory = 'genre' | 'phase' | 'mood' | 'topic' | 'custom';

const TAG_COLORS: Record<string, string> = {
  genre: 'cyan',
  phase: 'violet',
  mood: 'pink',
  topic: 'orange',
  custom: 'gray',
};

const TAG_CATEGORIES: TagCategory[] = ['phase', 'genre', 'mood', 'topic', 'custom'];

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fileName(filePath: string): string {
  return filePath.split('/').pop()?.replace(/\.mp3$/i, '') ?? filePath;
}

export function SongDetailPanel({ filePath, onSongSelect, onPlay, onTagsChanged }: SongDetailPanelProps) {
  const [metadata, setMetadata] = useState<SongMeta | null>(null);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [similar, setSimilar] = useState<SimilarSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [similarLimit, setSimilarLimit] = useState(5);

  // Per-category inline add state
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newTagValue, setNewTagValue] = useState('');

  // AI suggestion state
  const [suggestions, setSuggestions] = useState<{ genres: string[]; moods: string[]; phases: string[] } | null>(null);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const loadData = useCallback(async (path: string) => {
    setLoading(true);
    setMetadata(null);
    setSimilar([]);
    setSimilarLimit(5);
    try {
      const [meta, tagList, connList] = await Promise.all([
        onGetSongMetadata(path),
        onGetSongTags(path),
        onGetSongConnections(path),
      ]);
      setMetadata(meta);
      setTags(tagList);
      setConnections(connList);

      // Load similar songs in background
      const sim = await onFindSimilarSongs(path, 5);
      setSimilar(sim);
    } catch (err) {
      console.error('[SongDetailPanel] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filePath) {
      loadData(filePath);
    } else {
      setMetadata(null);
      setTags([]);
      setConnections([]);
      setSimilar([]);
    }
  }, [filePath, loadData]);

  const refreshTags = useCallback(async () => {
    if (!filePath) return;
    const tagList = await onGetSongTags(filePath);
    setTags(tagList);
    onTagsChanged?.();
  }, [filePath, onTagsChanged]);

  const handleAddTag = useCallback(async (label: string, category: string) => {
    if (!filePath || !label.trim()) return;
    await onAddSongTag(filePath, label.trim(), category);
    await refreshTags();
    showSuccess({ message: `Tag "${label.trim()}" added` });
    setNewTagValue('');
    setAddingCategory(null);
  }, [filePath, refreshTags]);

  const handleRemoveTag = useCallback(async (label: string, category: string) => {
    if (!filePath) return;
    await onRemoveSongTag(filePath, label, category);
    await refreshTags();
  }, [filePath, refreshTags]);

  const handleSuggestTags = useCallback(async () => {
    if (!filePath) return;
    setSuggestingTags(true);
    setSuggestions(null);
    try {
      const result = await onGetTagSuggestions(filePath);
      setSuggestions(result);
    } catch (e) {
      console.error('Failed to get AI suggestions:', e);
    } finally {
      setSuggestingTags(false);
    }
  }, [filePath]);

  const handleAcceptSuggestion = useCallback(async (label: string, category: string) => {
    if (!filePath) return;
    await onAddSongTag(filePath, label, category);
    await refreshTags();
    // Remove accepted suggestion from the list
    setSuggestions(prev => {
      if (!prev) return prev;
      const key = category === 'genre' ? 'genres' : category === 'mood' ? 'moods' : 'phases';
      return { ...prev, [key]: prev[key].filter(s => s !== label) };
    });
  }, [filePath, refreshTags]);

  const handleFindMore = useCallback(async () => {
    if (!filePath) return;
    const newLimit = similarLimit + 5;
    setSimilarLimit(newLimit);
    const sim = await onFindSimilarSongs(filePath, newLimit);
    setSimilar(sim);
  }, [filePath, similarLimit]);

  if (!filePath) {
    return (
      <Stack gap="md" p="md" align="center" justify="center" className="sdp-empty">
        <IconMusic size={48} stroke={1} opacity={0.3} />
        <Text size="sm" c="dimmed">Select a song to view details.</Text>
      </Stack>
    );
  }

  if (loading && !metadata) {
    return (
      <Stack gap="md" p="md">
        <Skeleton height={200} radius="md" />
        <Skeleton height={20} width="60%" />
        <Skeleton height={16} width="40%" />
        <Skeleton height={16} width="50%" />
        <Skeleton height={16} width="30%" />
        <Skeleton height={36} width="100%" />
        <Divider />
        <Skeleton height={14} width="30%" />
        <Group gap="xs">
          <Skeleton height={24} width={60} radius="xl" />
          <Skeleton height={24} width={70} radius="xl" />
          <Skeleton height={24} width={50} radius="xl" />
        </Group>
      </Stack>
    );
  }

  if (!metadata) {
    return (
      <Stack gap="md" p="md">
        <Text c="red" size="sm">Failed to load metadata for this song.</Text>
      </Stack>
    );
  }

  const tagsByCategory = TAG_CATEGORIES.reduce<Record<string, TagInfo[]>>((acc, cat) => {
    acc[cat] = tags.filter(t => t.category === cat);
    return acc;
  }, {});

  const artworkSrc = metadata.artworkDataUrl
    ?? `/artwork/${encodeURIComponent(metadata.filePath)}`;

  return (
    <ScrollArea h="calc(100vh - 80px)" offsetScrollbars>
      <Stack gap="md" p="md" className="sdp-root">
        {/* Artwork */}
        <Box className="sdp-artwork-wrapper">
          <Image
            src={artworkSrc}
            alt="Album artwork"
            w={200}
            h={200}
            radius="md"
            fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%232c2e33'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23868e96' font-size='48'%3E🎵%3C/text%3E%3C/svg%3E"
            className="sdp-artwork"
          />
        </Box>

        {/* Metadata */}
        <Stack gap={4}>
          <Text size="lg" fw={700} lineClamp={2}>
            {metadata.title || fileName(metadata.filePath)}
          </Text>
          <Text size="sm" c="dimmed">{metadata.artist || 'Unknown Artist'}</Text>
          {metadata.album && <Text size="xs" c="dimmed">Album: {metadata.album}</Text>}
          <Group gap="md">
            <Text size="xs" c="dimmed">Duration: {formatDuration(metadata.duration)}</Text>
            {metadata.genre.length > 0 && (
              <Text size="xs" c="dimmed">Genre: {metadata.genre.join(', ')}</Text>
            )}
          </Group>
        </Stack>

        {/* Play button */}
        {onPlay && (
          <Button
            leftSection={<IconPlayerPlay size={16} />}
            variant="light"
            color="violet"
            fullWidth
            onClick={() => onPlay(metadata.filePath)}
          >
            Play
          </Button>
        )}

        {/* Analysis Section (MIK) */}
        {(metadata.key || metadata.camelotKey || metadata.bpm || metadata.energyLevel) && (
          <>
            <Divider label="Analysis" labelPosition="left" />
            <Stack gap={8} data-testid="song-analysis-section">
              {(metadata.key || metadata.camelotKey) && (
                <Group gap="xs" data-testid="song-detail-key">
                  <Text size="xs" c="dimmed" w={50}>Key</Text>
                  {metadata.camelotKey && (
                    <Badge
                      data-testid="song-detail-key-badge"
                      size="sm"
                      variant="filled"
                      style={{
                        backgroundColor: getCamelotColor(metadata.camelotKey),
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    >
                      {metadata.camelotKey}
                    </Badge>
                  )}
                  {metadata.key && (
                    <Text size="xs" c="dimmed">({metadata.key})</Text>
                  )}
                </Group>
              )}
              {metadata.bpm && (
                <Group gap="xs" data-testid="song-detail-bpm">
                  <Text size="xs" c="dimmed" w={50}>BPM</Text>
                  <Text size="sm" fw={600}>{Math.round(metadata.bpm)}</Text>
                </Group>
              )}
              {metadata.energyLevel && (
                <Group gap="xs" data-testid="song-detail-energy">
                  <Text size="xs" c="dimmed" w={50}>Energy</Text>
                  <Text size="sm" fw={700} style={{ color: `hsl(${(metadata.energyLevel / 10) * 120}, 80%, 50%)` }}>
                    {metadata.energyLevel}
                  </Text>
                  <Progress
                    value={metadata.energyLevel * 10}
                    size="sm"
                    style={{ flex: 1 }}
                    color={`hsl(${(metadata.energyLevel / 10) * 120}, 80%, 50%)`}
                  />
                </Group>
              )}
              {metadata.label && (
                <Group gap="xs" data-testid="song-detail-label">
                  <Text size="xs" c="dimmed" w={50}>Label</Text>
                  <Text size="xs">{metadata.label}</Text>
                </Group>
              )}
            </Stack>
          </>
        )}

        {/* Tags Section */}
        <Divider label={
          <Group gap={8}>
            <Text size="xs" fw={700}>Tags</Text>
            <Tooltip label="Get AI tag suggestions" position="right">
              <ActionIcon
                size="xs"
                variant="subtle"
                color="violet"
                onClick={handleSuggestTags}
                loading={suggestingTags}
                data-testid="suggest-tags-btn"
              >
                <IconSparkles size={12} />
              </ActionIcon>
            </Tooltip>
          </Group>
        } labelPosition="left" />

        {/* AI Suggestions */}
        {suggestions && (Object.values(suggestions).some(arr => arr.length > 0)) && (
          <Box style={{ background: 'rgba(124,58,237,0.08)', borderRadius: 8, padding: '8px 10px' }}>
            <Text size="xs" c="violet" fw={600} mb={4}>✨ AI Suggestions — click to add</Text>
            <Group gap={4} wrap="wrap">
              {suggestions.genres.map(s => (
                <Badge key={`sg-${s}`} size="sm" variant="outline" color="cyan" style={{ cursor: 'pointer' }}
                  onClick={() => handleAcceptSuggestion(s, 'genre')}>{s}</Badge>
              ))}
              {suggestions.moods.map(s => (
                <Badge key={`sm-${s}`} size="sm" variant="outline" color="pink" style={{ cursor: 'pointer' }}
                  onClick={() => handleAcceptSuggestion(s, 'mood')}>{s}</Badge>
              ))}
              {suggestions.phases.map(s => (
                <Badge key={`sp-${s}`} size="sm" variant="outline" color="violet" style={{ cursor: 'pointer' }}
                  onClick={() => handleAcceptSuggestion(s, 'phase')}>{s}</Badge>
              ))}
            </Group>
          </Box>
        )}

        <Stack gap="sm">
          {TAG_CATEGORIES.map(category => {
            const catTags = tagsByCategory[category] ?? [];
            const color = TAG_COLORS[category];
            const isAdding = addingCategory === category;

            return (
              <Box key={category}>
                <Text size="xs" fw={600} tt="capitalize" mb={4} c="dimmed">
                  {category}
                </Text>
                <Group gap={6} wrap="wrap">
                  {catTags.map(tag => (
                    <Badge
                      key={`${tag.category}-${tag.label}`}
                      color={color}
                      variant="light"
                      size="sm"
                      rightSection={
                        <ActionIcon
                          size={14}
                          variant="transparent"
                          color={color}
                          onClick={() => handleRemoveTag(tag.label, tag.category)}
                        >
                          <IconX size={10} />
                        </ActionIcon>
                      }
                    >
                      {tag.label}
                    </Badge>
                  ))}

                  {isAdding ? (
                    <TextInput
                      size="xs"
                      placeholder={`Add ${category}…`}
                      value={newTagValue}
                      onChange={e => setNewTagValue(e.currentTarget.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddTag(newTagValue, category);
                        if (e.key === 'Escape') { setAddingCategory(null); setNewTagValue(''); }
                      }}
                      onBlur={() => { setAddingCategory(null); setNewTagValue(''); }}
                      autoFocus
                      className="sdp-tag-input"
                    />
                  ) : (
                    <Tooltip label={`Add ${category} tag`}>
                      <ActionIcon
                        size={22}
                        variant="subtle"
                        color={color}
                        onClick={() => { setAddingCategory(category); setNewTagValue(''); }}
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Box>
            );
          })}
        </Stack>

        {/* Connections Section */}
        {connections.length > 0 && (
          <>
            <Divider label="Connections" labelPosition="left" />
            <Stack gap={6}>
              {connections.map(conn => (
                <Group
                  key={conn.id}
                  gap="xs"
                  className="sdp-connection-row"
                  onClick={() => onSongSelect?.(conn.otherPath)}
                  wrap="nowrap"
                >
                  <IconLink size={14} opacity={0.5} />
                  {conn.direction === 'outgoing'
                    ? <IconArrowRight size={12} opacity={0.4} />
                    : <IconArrowLeft size={12} opacity={0.4} />}
                  <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                    {conn.otherTitle || fileName(conn.otherPath)}
                  </Text>
                  <Badge size="xs" variant="outline" color={TAG_COLORS[conn.type] ?? 'gray'}>
                    {conn.type}
                  </Badge>
                  <Text size="xs" c="dimmed">{conn.weight.toFixed(1)}</Text>
                </Group>
              ))}
            </Stack>
          </>
        )}

        {/* Similar Songs Section */}
        <Divider label="Similar Songs" labelPosition="left" />
        {similar.length > 0 ? (
          <Stack gap={6}>
            {similar.map(song => (
              <Group
                key={song.filePath}
                gap="xs"
                className="sdp-connection-row"
                onClick={() => onSongSelect?.(song.filePath)}
                wrap="nowrap"
              >
                <IconMusic size={14} opacity={0.5} />
                <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                  {song.title || fileName(song.filePath)}
                </Text>
                {song.artist && <Text size="xs" c="dimmed" lineClamp={1}>{song.artist}</Text>}
                <Text size="xs" c="dimmed">{song.score.toFixed(2)}</Text>
              </Group>
            ))}
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconSearch size={14} />}
              onClick={handleFindMore}
            >
              Find More Similar
            </Button>
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">No similar songs found yet.</Text>
        )}
      </Stack>
    </ScrollArea>
  );
}
