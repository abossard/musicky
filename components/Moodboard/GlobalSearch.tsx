import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, TextInput, ScrollArea, Text, Group, Badge, Loader, Box } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconMusic } from '@tabler/icons-react';
import { onSearchSongs, onGetSongTags } from './MoodboardPage.telefunc';

import './GlobalSearch.css';

interface SearchResult {
  filePath: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
  tags: { label: string; category: string }[];
  fuzzyScore: number;
}

interface GlobalSearchProps {
  opened: boolean;
  onClose: () => void;
  onSelectSong: (filePath: string, isOnCanvas: boolean) => void;
  canvasFilePaths: Set<string>;
}

function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

function scoreSong(query: string, song: { title: string; artist: string; album: string; filePath: string }): number {
  if (!query) return 1;
  const filename = song.filePath.split('/').pop() ?? '';
  const fields = [song.title, song.artist, song.album, filename];
  let best = 0;
  for (const field of fields) {
    if (!field) continue;
    // Prefer substring match
    if (field.toLowerCase().includes(query.toLowerCase())) {
      best = Math.max(best, query.length + 100);
    } else {
      best = Math.max(best, fuzzyMatch(query, field));
    }
  }
  return best;
}

export function GlobalSearch({ opened, onClose, onSelectSong, canvasFilePaths }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 200);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Focus input when opened
  useEffect(() => {
    if (opened) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [opened]);

  // Search when query changes
  useEffect(() => {
    if (!opened) return;
    let cancelled = false;

    const doSearch = async () => {
      setLoading(true);
      try {
        const serverResults = await onSearchSongs(debouncedQuery, 50);
        if (cancelled) return;

        // Score and sort results with fuzzy matching
        const scored: SearchResult[] = serverResults
          .map(r => ({
            filePath: r.filePath,
            title: r.title || r.filePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Unknown',
            artist: r.artist || 'Unknown Artist',
            album: r.album || '',
            artworkUrl: r.artworkUrl,
            tags: [] as { label: string; category: string }[],
            fuzzyScore: scoreSong(debouncedQuery, r),
          }))
          .filter(r => !debouncedQuery || r.fuzzyScore > 0)
          .sort((a, b) => b.fuzzyScore - a.fuzzyScore);

        setResults(scored);
        setSelectedIndex(0);

        // Load tags for top results (batch, async)
        const topPaths = scored.slice(0, 20).map(r => r.filePath);
        if (topPaths.length > 0) {
          const tagResults = await Promise.all(
            topPaths.map(fp => onGetSongTags(fp).then(tags => ({ fp, tags })))
          );
          if (cancelled) return;
          setResults(prev =>
            prev.map(r => {
              const match = tagResults.find(t => t.fp === r.filePath);
              return match ? { ...r, tags: match.tags.map(t => ({ label: t.label, category: t.category })) } : r;
            })
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    doSearch();
    return () => { cancelled = true; };
  }, [opened, debouncedQuery]);

  const scrollToIndex = useCallback((idx: number) => {
    const el = itemRefs.current.get(idx);
    el?.scrollIntoView({ block: 'nearest' });
  }, []);

  const handleSelect = useCallback((index: number) => {
    const result = results[index];
    if (!result) return;
    const isOnCanvas = canvasFilePaths.has(result.filePath);
    onSelectSong(result.filePath, isOnCanvas);
    onClose();
  }, [results, canvasFilePaths, onSelectSong, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = Math.min(prev + 1, results.length - 1);
          scrollToIndex(next);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          const next = Math.max(prev - 1, 0);
          scrollToIndex(next);
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        handleSelect(selectedIndex);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results.length, selectedIndex, handleSelect, onClose, scrollToIndex]);

  const categoryColor: Record<string, string> = {
    phase: 'violet',
    genre: 'cyan',
    mood: 'pink',
    topic: 'orange',
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      centered
      size={520}
      padding={0}
      radius="md"
      overlayProps={{ backgroundOpacity: 0.6, blur: 2 }}
      data-testid="global-search-modal"
    >
      <Box className="global-search-overlay" onKeyDown={handleKeyDown}>
        {/* Search input */}
        <Box className="global-search-input-wrapper">
          <TextInput
            ref={inputRef}
            placeholder="Search songs by title, artist, or album…"
            leftSection={<IconSearch size={18} />}
            rightSection={loading ? <Loader size={14} /> : null}
            value={query}
            onChange={e => setQuery(e.currentTarget.value)}
            size="lg"
            variant="unstyled"
            autoFocus
            data-testid="global-search-input"
          />
        </Box>

        {/* Results */}
        <ScrollArea className="global-search-results" type="auto" ref={scrollAreaRef}>
          {!debouncedQuery && results.length === 0 && !loading && (
            <Box className="global-search-hint">
              <Text size="sm" c="dimmed">Type to search songs by title, artist, or album</Text>
            </Box>
          )}

          {debouncedQuery && !loading && results.length === 0 && (
            <Box className="global-search-hint">
              <Text size="sm" c="dimmed">No results for &ldquo;{debouncedQuery}&rdquo;</Text>
            </Box>
          )}

          {results.map((result, index) => {
            const isOnCanvas = canvasFilePaths.has(result.filePath);
            return (
              <div
                key={result.filePath}
                ref={el => { if (el) itemRefs.current.set(index, el); else itemRefs.current.delete(index); }}
                className="global-search-result"
                data-selected={index === selectedIndex}
                data-testid="global-search-result"
                onClick={() => handleSelect(index)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {/* Artwork */}
                <div className="global-search-result-artwork">
                  {result.artworkUrl ? (
                    <img src={result.artworkUrl} alt="" loading="lazy" />
                  ) : (
                    <IconMusic size={16} color="var(--mantine-color-dark-3)" />
                  )}
                </div>

                {/* Song info */}
                <div className="global-search-result-info">
                  <Text size="sm" fw={500} truncate="end" lh={1.3}>
                    {result.title}
                  </Text>
                  <Text size="xs" c="dimmed" truncate="end">
                    {result.artist}{result.album ? ` · ${result.album}` : ''}
                  </Text>
                </div>

                {/* Badges */}
                <div className="global-search-result-badges">
                  {result.tags.slice(0, 2).map(tag => (
                    <Badge
                      key={`${tag.category}:${tag.label}`}
                      size="xs"
                      variant="light"
                      color={categoryColor[tag.category] || 'gray'}
                    >
                      {tag.label}
                    </Badge>
                  ))}
                  {isOnCanvas ? (
                    <Badge size="xs" variant="light" color="green">On Board</Badge>
                  ) : (
                    <Badge size="xs" variant="light" color="violet">+ Add</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </ScrollArea>

        {/* Footer with keyboard hints */}
        <Group className="global-search-footer" gap="md">
          <Group gap={4}>
            <kbd>↑</kbd><kbd>↓</kbd>
            <Text size="xs" c="dimmed">Navigate</Text>
          </Group>
          <Group gap={4}>
            <kbd>↵</kbd>
            <Text size="xs" c="dimmed">Select</Text>
          </Group>
          <Group gap={4}>
            <kbd>Esc</kbd>
            <Text size="xs" c="dimmed">Close</Text>
          </Group>
        </Group>
      </Box>
    </Modal>
  );
}
