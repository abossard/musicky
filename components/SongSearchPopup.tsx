import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, 
  TextInput, 
  ScrollArea, 
  Stack, 
  Group, 
  Text, 
  Card,
  Loader,
  Badge,
  Box,
  ActionIcon,
  Highlight
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconMusic, IconX } from '@tabler/icons-react';
import { onSearchMusic } from './MusicSearch.telefunc';
import { onAddSongToSet } from './DJSetItems.telefunc';
import type { MP3SearchResult } from '../database/sqlite/queries/dj-sets';
// Browser-compatible basename function
const basename = (path: string): string => {
  return path.split('/').pop() || path.split('\\').pop() || path;
};

interface SongSearchPopupProps {
  opened: boolean;
  onClose: () => void;
  setId: number;
  insertAfterPosition: number;
  onSongAdded?: () => void;
}

interface SearchResultItemProps {
  result: MP3SearchResult;
  searchQuery: string;
  onSelect: (result: MP3SearchResult) => void;
  isSelected?: boolean;
}

function SearchResultItem({ result, searchQuery, onSelect, isSelected }: SearchResultItemProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDisplayName = (filePath: string) => {
    const filename = basename(filePath);
    return filename.replace(/\.[^/.]+$/, '');
  };

  const displayName = result.title || getDisplayName(result.file_path);

  return (
    <Card
      data-testid="search-result-item"
      withBorder
      p="sm"
      style={{
        cursor: 'pointer',
        backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined,
      }}
      onClick={() => onSelect(result)}
    >
      <Group justify="space-between">
        <Group>
          <IconMusic size={16} color="var(--mantine-color-blue-6)" />
          <Box>
            <Text size="sm" fw={500}>
              <Highlight highlight={searchQuery} highlightColor="yellow">
                {displayName}
              </Highlight>
            </Text>
            {result.artist && (
              <Text size="xs" c="dimmed">
                <Highlight highlight={searchQuery} highlightColor="yellow">
                  {result.artist}
                </Highlight>
                {result.album && ` • ${result.album}`}
              </Text>
            )}
            <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
              {result.file_path}
            </Text>
          </Box>
        </Group>

        <Group>
          {result.duration && (
            <Badge variant="light" size="sm">
              {formatDuration(result.duration)}
            </Badge>
          )}
        </Group>
      </Group>
    </Card>
  );
}

export function SongSearchPopup({ 
  opened, 
  onClose, 
  setId, 
  insertAfterPosition, 
  onSongAdded 
}: SongSearchPopupProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [results, setResults] = useState<MP3SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [adding, setAdding] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when modal opens
  useEffect(() => {
    if (opened) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [opened]);

  // Reset state when modal closes
  useEffect(() => {
    if (!opened) {
      setSearch('');
      setResults([]);
      setSelectedIndex(-1);
      setAdding(false);
    }
  }, [opened]);

  // Perform search when debounced search changes
  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      performSearch(debouncedSearch);
    } else {
      setResults([]);
      setSelectedIndex(-1);
    }
  }, [debouncedSearch]);

  const performSearch = async (query: string) => {
    try {
      setLoading(true);
      const searchResults = await onSearchMusic(query, 50);
      setResults(searchResults);
      setSelectedIndex(searchResults.length > 0 ? 0 : -1);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setSelectedIndex(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSong = async (result: MP3SearchResult) => {
    if (adding) return;
    
    try {
      setAdding(true);
      await onAddSongToSet(setId, result.file_path, insertAfterPosition + 1);
      onSongAdded?.();
      onClose();
    } catch (error) {
      console.error('Error adding song:', error);
    } finally {
      setAdding(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (results.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelectSong(results[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  };

  return (
    <Modal
      data-testid="search-popup"
      opened={opened}
      onClose={onClose}
      title="Search Songs"
      size="lg"
      centered
    >
      <Stack>
        <TextInput
          data-testid="search-input"
          ref={searchInputRef}
          placeholder="Search for songs, artists, or albums..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          leftSection={<IconSearch size={16} />}
          rightSection={
            loading ? (
              <Loader size="sm" />
            ) : search ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setSearch('')}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
        />

        {search.length > 0 && search.length < 2 && (
          <Text size="sm" c="dimmed" ta="center">
            Type at least 2 characters to search
          </Text>
        )}

        {debouncedSearch.length >= 2 && (
          <ScrollArea data-testid="search-results" h={400} type="auto">
            {loading ? (
              <Box ta="center" py="xl">
                <Loader size="sm" />
                <Text size="sm" c="dimmed" mt="sm">
                  Searching...
                </Text>
              </Box>
            ) : results.length > 0 ? (
              <Stack gap="xs">
                {results.map((result, index) => (
                  <SearchResultItem
                    key={result.file_path}
                    result={result}
                    searchQuery={debouncedSearch}
                    onSelect={handleSelectSong}
                    isSelected={index === selectedIndex}
                  />
                ))}
              </Stack>
            ) : (
              <Box ta="center" py="xl">
                <Text size="sm" c="dimmed">
                  No songs found for "{debouncedSearch}"
                </Text>
              </Box>
            )}
          </ScrollArea>
        )}

        {results.length > 0 && (
          <Text size="xs" c="dimmed" ta="center">
            Use arrow keys to navigate, Enter to select, Escape to close
          </Text>
        )}
      </Stack>
    </Modal>
  );
}