import React, { useState, useEffect, useRef } from 'react';
import { Modal, TextInput, ScrollArea, Stack, Group, Text, Card, Box, Loader, Badge, Highlight } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconCheck } from '@tabler/icons-react';
import type { MP3SearchResult } from '../../lib/types';

interface MoodboardSearchProps {
  opened: boolean;
  onClose: () => void;
  onAddSong: (songPath: string) => Promise<string | null>;
  checkOnBoard: (songPath: string) => Promise<boolean>;
  searchSongs: (query: string) => Promise<MP3SearchResult[]>;
}

export function MoodboardSearch({ opened, onClose, onAddSong, checkOnBoard, searchSongs }: MoodboardSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 250);
  const [results, setResults] = useState<MP3SearchResult[]>([]);
  const [onBoard, setOnBoard] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (opened) setTimeout(() => inputRef.current?.focus(), 100);
    else { setQuery(''); setResults([]); setOnBoard(new Set()); }
  }, [opened]);

  useEffect(() => {
    if (!opened) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await searchSongs(debouncedQuery);
        if (cancelled) {
          return;
        }
        setResults(res);
        const checks = await Promise.all(res.map(r => checkOnBoard(r.file_path)));
        if (cancelled) {
          return;
        }
        setOnBoard(new Set(res.filter((_, i) => checks[i]).map(r => r.file_path)));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [opened, debouncedQuery, searchSongs, checkOnBoard]);

  const handleSelect = async (result: MP3SearchResult) => {
    if (onBoard.has(result.file_path)) return;
    setAdding(result.file_path);
    const error = await onAddSong(result.file_path);
    if (!error) {
      setOnBoard(prev => new Set([...prev, result.file_path]));
    }
    setAdding(null);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add Song to Moodboard" size="lg">
      <Stack gap="sm">
        <TextInput
          ref={inputRef}
          placeholder="Search by song, artist, album..."
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          autoFocus
        />

        <ScrollArea h={400} type="auto">
          {loading && (
            <Group justify="center" py="xl"><Loader size="sm" /><Text size="sm" c="dimmed">Searching...</Text></Group>
          )}

          {!loading && results.length === 0 && debouncedQuery.length > 0 && (
            <Text size="sm" c="dimmed" ta="center" py="xl">No songs found for "{debouncedQuery}"</Text>
          )}

          {!loading && results.length === 0 && debouncedQuery.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="xl">No songs available yet. Import music in MP3 Library first.</Text>
          )}

          <Stack gap="xs">
            {results.map(result => {
              const alreadyOnBoard = onBoard.has(result.file_path);
              const isAdding = adding === result.file_path;
              return (
                <Card
                  key={result.file_path}
                  withBorder
                  p="sm"
                  style={{
                    cursor: alreadyOnBoard ? 'default' : 'pointer',
                    opacity: alreadyOnBoard ? 0.5 : 1,
                  }}
                  onClick={() => handleSelect(result)}
                >
                  <Group justify="space-between">
                    <Group gap="sm">
                      <Box w={40} h={40} style={{ borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                        <img
                          src={`/artwork/${encodeURIComponent(result.file_path)}`}
                          width={40} height={40}
                          style={{ objectFit: 'cover' }}
                          alt=""
                        />
                      </Box>
                      <Box>
                        <Text size="sm" fw={500}>
                          <Highlight highlight={debouncedQuery}>{result.title || result.filename}</Highlight>
                        </Text>
                        <Text size="xs" c="dimmed">
                          <Highlight highlight={debouncedQuery}>{result.artist || 'Unknown Artist'}</Highlight>
                        </Text>
                      </Box>
                    </Group>
                    {alreadyOnBoard ? (
                      <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>Added</Badge>
                    ) : isAdding ? (
                      <Loader size="xs" />
                    ) : (
                      <Badge color="violet" variant="light">+ Add</Badge>
                    )}
                  </Group>
                </Card>
              );
            })}
          </Stack>
        </ScrollArea>
      </Stack>
    </Modal>
  );
}
