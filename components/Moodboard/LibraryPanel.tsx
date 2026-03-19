import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  TextInput, Select, ScrollArea, Box, Group, Stack, Text, Badge, Skeleton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconMusic } from '@tabler/icons-react';
import { onGetLibrarySongs, onSearchSongs, onGetAllTags } from './MoodboardPage.telefunc';

import './LibraryPanel.css';

export interface LibraryPanelProps {
  onSongSelect: (filePath: string) => void;
  onSongDoubleClick?: (filePath: string) => void;
  onSongDragStart?: (filePath: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

interface LibrarySong {
  filePath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  fileSize: number;
  artworkUrl: string | null;
}

interface SongTagInfo {
  id: number;
  label: string;
  category: string;
  source: string;
}

interface TagInfo {
  label: string;
  category: string;
  count: number;
}

export function LibraryPanel({ onSongSelect, onSongDoubleClick, onSongDragStart, searchInputRef: externalSearchRef }: LibraryPanelProps) {
  const [songs, setSongs] = useState<LibrarySong[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);

  // Filters
  const [phaseFilter, setPhaseFilter] = useState<string | null>(null);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [moodFilter, setMoodFilter] = useState<string | null>(null);

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const internalSearchRef = useRef<HTMLInputElement>(null);
  const searchInputRef = externalSearchRef || internalSearchRef;
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Song-to-tags mapping for client-side filtering
  const [songTagsMap, setSongTagsMap] = useState<Map<string, SongTagInfo[]>>(new Map());

  // Load data on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([onGetLibrarySongs(), onGetAllTags()])
      .then(([songList, tagList]) => {
        if (cancelled) return;
        setSongs(songList);
        setTags(tagList);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Build filter options from tags
  const filterOptions = useMemo(() => {
    const byCategory = (cat: string) =>
      tags.filter(t => t.category === cat).map(t => ({ value: t.label, label: `${t.label} (${t.count})` }));
    return {
      phase: byCategory('phase'),
      genre: byCategory('genre'),
      mood: byCategory('mood'),
    };
  }, [tags]);

  // Search: use server-side search when query present, otherwise show all
  useEffect(() => {
    if (!debouncedSearch.trim()) return;
    let cancelled = false;
    onSearchSongs(debouncedSearch, 500).then(results => {
      if (!cancelled) setSongs(results);
    });
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  // Reload full library when search is cleared
  useEffect(() => {
    if (debouncedSearch.trim() === '' && !loading) {
      onGetLibrarySongs().then(setSongs);
    }
  }, [debouncedSearch, loading]);

  // Client-side filtering by tag categories
  const filteredSongs = useMemo(() => {
    if (!phaseFilter && !genreFilter && !moodFilter) return songs;
    return songs.filter(song => {
      const st = songTagsMap.get(song.filePath);
      if (!st) return !phaseFilter && !genreFilter && !moodFilter;
      if (phaseFilter && !st.some(t => t.category === 'phase' && t.label === phaseFilter)) return false;
      if (genreFilter && !st.some(t => t.category === 'genre' && t.label === genreFilter)) return false;
      if (moodFilter && !st.some(t => t.category === 'mood' && t.label === moodFilter)) return false;
      return true;
    });
  }, [songs, phaseFilter, genreFilter, moodFilter, songTagsMap]);

  // Lazily load tags for songs when filters are active
  useEffect(() => {
    if (!phaseFilter && !genreFilter && !moodFilter) return;
    const untagged = songs.filter(s => !songTagsMap.has(s.filePath));
    if (untagged.length === 0) return;

    const loadTags = async () => {
      const { onGetSongTags } = await import('./MoodboardPage.telefunc');
      const chunk = untagged.slice(0, 100);
      const results = await Promise.all(
        chunk.map(s =>
          onGetSongTags(s.filePath).then((t) => [s.filePath, t] as const)
        )
      );
      setSongTagsMap(prev => {
        const next = new Map(prev);
        for (const [fp, t] of results) next.set(fp, t);
        return next;
      });
    };
    loadTags();
  }, [songs, phaseFilter, genreFilter, moodFilter, songTagsMap]);

  // Reset focused index when filtered list changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [filteredSongs.length]);

  // Auto-focus search input
  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  const scrollToIndex = useCallback((idx: number) => {
    const el = itemRefs.current.get(idx);
    el?.scrollIntoView({ block: 'nearest' });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const len = filteredSongs.length;
    if (len === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.min(prev + 1, len - 1);
          scrollToIndex(next);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          scrollToIndex(next);
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < len) {
          onSongSelect(filteredSongs[focusedIndex].filePath);
        }
        break;
      case ' ':
        if (e.target === searchInputRef.current) break;
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < len && onSongDoubleClick) {
          onSongDoubleClick(filteredSongs[focusedIndex].filePath);
        }
        break;
    }
  }, [filteredSongs, focusedIndex, onSongSelect, onSongDoubleClick, scrollToIndex]);

  const handleDragStart = useCallback((filePath: string, e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-moodboard-song', filePath);
    e.dataTransfer.setData('text/plain', filePath);
    e.dataTransfer.effectAllowed = 'copy';
    onSongDragStart?.(filePath);
  }, [onSongDragStart]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Loading skeleton
  if (loading) {
    return (
      <Box className="library-panel">
        <Box className="library-panel-header">
          <Skeleton height={30} radius="sm" mb={6} />
        </Box>
        <Stack gap={0} p={0}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Group key={i} gap={8} p="4px 10px" style={{ borderBottom: '1px solid var(--mantine-color-dark-6)' }}>
              <Skeleton width={32} height={32} radius={4} />
              <Stack gap={2} style={{ flex: 1 }}>
                <Skeleton height={12} width="70%" />
                <Skeleton height={10} width="50%" />
              </Stack>
            </Group>
          ))}
        </Stack>
      </Box>
    );
  }

  // Empty state
  if (songs.length === 0 && !loading && !debouncedSearch) {
    return (
      <Box className="library-panel">
        <Box className="library-panel-header">
          <Group gap={6}>
            <IconMusic size={14} />
            <Text size="sm" fw={600}>Library</Text>
          </Group>
        </Box>
        <Box className="library-panel-empty">
          <IconMusic size={32} color="var(--mantine-color-dark-3)" />
          <Text size="sm" c="dimmed">No songs found.</Text>
          <Text size="xs" c="dimmed">
            Set a base folder in Settings and scan your library.
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="library-panel" onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Header / Search */}
      <Box className="library-panel-header">
        <TextInput
          ref={searchInputRef}
          size="xs"
          placeholder="Search songs…"
          value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          leftSection={<IconSearch size={14} />}
          data-testid="library-search"
        />
      </Box>

      {/* Filters */}
      {(filterOptions.phase.length > 0 || filterOptions.genre.length > 0 || filterOptions.mood.length > 0) && (
        <Box className="library-panel-filters">
          <Stack gap={4}>
            {filterOptions.phase.length > 0 && (
              <Select
                size="xs"
                placeholder="Phase: All"
                data={filterOptions.phase}
                value={phaseFilter}
                onChange={setPhaseFilter}
                clearable
                comboboxProps={{ withinPortal: true }}
              />
            )}
            {filterOptions.genre.length > 0 && (
              <Select
                size="xs"
                placeholder="Genre: All"
                data={filterOptions.genre}
                value={genreFilter}
                onChange={setGenreFilter}
                clearable
                comboboxProps={{ withinPortal: true }}
              />
            )}
            {filterOptions.mood.length > 0 && (
              <Select
                size="xs"
                placeholder="Mood: All"
                data={filterOptions.mood}
                value={moodFilter}
                onChange={setMoodFilter}
                clearable
                comboboxProps={{ withinPortal: true }}
              />
            )}
          </Stack>
        </Box>
      )}

      {/* Song List */}
      <ScrollArea className="library-song-list" type="auto" data-testid="library-song-list">
        {filteredSongs.length === 0 ? (
          <Box className="library-panel-empty" style={{ height: 'auto', paddingTop: 40 }}>
            <Text size="sm" c="dimmed">No songs match your filters.</Text>
          </Box>
        ) : (
          filteredSongs.map((song, index) => (
            <div
              key={song.filePath}
              ref={el => { if (el) itemRefs.current.set(index, el); else itemRefs.current.delete(index); }}
              className="library-song-item"
              data-focused={index === focusedIndex}
              data-testid="library-song-item"
              draggable
              onClick={() => {
                setFocusedIndex(index);
                onSongSelect(song.filePath);
              }}
              onDoubleClick={() => onSongDoubleClick?.(song.filePath)}
              onDragStart={e => handleDragStart(song.filePath, e)}
            >
              {/* Artwork */}
              {song.artworkUrl ? (
                <img
                  className="library-song-artwork"
                  src={song.artworkUrl}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <div className="library-song-artwork-placeholder">
                  <IconMusic size={14} />
                </div>
              )}

              {/* Song info */}
              <div className="library-song-info">
                <Text size="xs" fw={600} truncate="end" lh={1.2}>
                  {song.title || song.filePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Unknown'}
                </Text>
                <Group gap={4} wrap="nowrap">
                  <Text size="xs" c="dimmed" truncate="end" style={{ flex: 1 }}>
                    {song.artist || 'Unknown Artist'}
                  </Text>
                  {song.duration > 0 && (
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      {formatDuration(song.duration)}
                    </Text>
                  )}
                </Group>
              </div>

              {/* Phase badge (from tag map if available) */}
              {songTagsMap.get(song.filePath)?.filter(t => t.category === 'phase').map(t => (
                <Badge key={t.label} size="xs" variant="light" color="violet" style={{ flexShrink: 0 }}>
                  {t.label}
                </Badge>
              ))}
            </div>
          ))
        )}
      </ScrollArea>

      {/* Footer */}
      <Box className="library-panel-footer">
        <Text size="xs" c="dimmed">{filteredSongs.length} songs</Text>
      </Box>
    </Box>
  );
}
