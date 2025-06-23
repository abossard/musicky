import React, { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Group,
  Button,
  Text,
  Box,
  ScrollArea,
  Paper,
  Badge,
  Loader,
  Alert,
  ActionIcon,
  Breadcrumbs,
  Anchor,
  TextInput,
  MultiSelect,
  Switch,
  Table,
  Checkbox
} from '@mantine/core';
import {
  IconHome,
  IconArrowUp,
  IconRefresh,
  IconMusic,
  IconSearch,
  IconFolder,
  IconFile
} from '@tabler/icons-react';
import { 
  onReadDirectory as readDirectory, 
  onGetHomeDirectory as getHomeDirectory, 
  onGetDirectoryInfo as getDirectoryInfo,
  onGetMusicDirectories as getMusicDirectories
} from './FileBrowser.telefunc';

// Client-side file size formatting function
const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  lastModified?: Date;
}

export interface FileBrowserProps {
  onFileSelect?: (file: FileItem) => void;
  onMultipleFileSelect?: (files: FileItem[]) => void;
  extensions?: string[];
  allowMultipleSelection?: boolean;
  height?: number | string;
  showSearch?: boolean;
  showFilters?: boolean;
}

export function FileBrowser({
  onFileSelect,
  onMultipleFileSelect,
  extensions = ['mp3'],
  allowMultipleSelection = false,
  height = 600,
  showSearch = true,
  showFilters = true
}: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeExtensions, setActiveExtensions] = useState<string[]>(extensions);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  // Initialize with home directory
  useEffect(() => {
    const initializeHome = async () => {
      try {
        const homeDir = await getHomeDirectory();
        setCurrentPath(homeDir);
      } catch (err) {
        setError('Failed to get home directory');
      }
    };
    initializeHome();
  }, []);

  // Load directory contents when path changes
  const loadDirectory = useCallback(async (path: string) => {
    if (!path) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const options = {
        extensions: activeExtensions,
        includeHidden,
        maxDepth: 1
      };

      const directoryItems = await readDirectory(path, options);
      
      setItems(directoryItems);
      setFilteredItems(directoryItems);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load directory';
      setError(message);
      setItems([]);
      setFilteredItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeExtensions, includeHidden]);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  // Filter items based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }

    const filtered = items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredItems(filtered);
  }, [items, searchQuery]);

  const navigateToPath = (path: string) => {
    setPathHistory(prev => [...prev, currentPath]);
    setCurrentPath(path);
    setSelectedFiles(new Set());
  };

  const navigateUp = async () => {
    try {
      const dirInfo = await getDirectoryInfo(currentPath);
      if (!dirInfo.isHome) {
        navigateToPath(dirInfo.parent);
      }
    } catch (err) {
      setError('Cannot navigate up');
    }
  };

  const navigateBack = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(prev => prev.slice(0, -1));
      setCurrentPath(previousPath);
      setSelectedFiles(new Set());
    }
  };

  const handleItemClick = (item: FileItem) => {
    if (item.isDirectory) {
      navigateToPath(item.path);
    } else {
      if (allowMultipleSelection) {
        const newSelected = new Set(selectedFiles);
        if (newSelected.has(item.path)) {
          newSelected.delete(item.path);
        } else {
          newSelected.add(item.path);
        }
        setSelectedFiles(newSelected);

        if (onMultipleFileSelect) {
          const selectedItems = filteredItems.filter(i => newSelected.has(i.path));
          onMultipleFileSelect(selectedItems);
        }
      } else {
        onFileSelect?.(item);
      }
    }
  };

  const handleQuickNavigate = async () => {
    try {
      const musicDirs = await getMusicDirectories();
      // For now, navigate to the first available music directory
      if (musicDirs.length > 0) {
        navigateToPath(musicDirs[0].path);
      }
    } catch (err) {
      setError('Failed to find music directories');
    }
  };

  const generateBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [];
    
    // Add home
    breadcrumbs.push(
      <Anchor key="home" onClick={async () => {
        const homeDir = await getHomeDirectory();
        setCurrentPath(homeDir);
      }}>
        <Group gap="xs">
          <Text>🏠</Text>
          <Text>Home</Text>
        </Group>
      </Anchor>
    );

    // Add path parts
    let accumulatedPath = '';
    for (let i = 0; i < parts.length; i++) {
      accumulatedPath += '/' + parts[i];
      const fullPath = accumulatedPath;
      
      breadcrumbs.push(
        <Anchor key={fullPath} onClick={() => navigateToPath(fullPath)}>
          <Text>{parts[i]}</Text>
        </Anchor>
      );
    }

    return breadcrumbs;
  };

  return (
    <Paper p="md" shadow="sm" h={height}>
      <Stack gap="md" h="100%">
        {/* Header with navigation */}
        <Group justify="space-between">
          <Group>
            <ActionIcon 
              variant="subtle" 
              onClick={navigateBack}
              disabled={pathHistory.length === 0}
              title="Back"
            >
              <Text>⬆️</Text>
            </ActionIcon>
            <ActionIcon variant="subtle" onClick={() => loadDirectory(currentPath)} title="Refresh">
              <Text>🔄</Text>
            </ActionIcon>
            <ActionIcon variant="subtle" onClick={handleQuickNavigate} title="Quick navigate to music">
              <Text>🎵</Text>
            </ActionIcon>
          </Group>

          <Text size="sm" c="dimmed">
            {filteredItems.length} items
          </Text>
        </Group>

        {/* Breadcrumbs */}
        <Box>
          <Breadcrumbs separator="/">
            {generateBreadcrumbs()}
          </Breadcrumbs>
        </Box>

        {/* Search and Filters */}
        {(showSearch || showFilters) && (
          <Stack gap="sm">
            {showSearch && (
              <TextInput
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={<Text>🔍</Text>}
              />
            )}

            {showFilters && (
              <Group>
                <MultiSelect
                  label="File Extensions"
                  placeholder="Select extensions"
                  data={['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma']}
                  value={activeExtensions}
                  onChange={setActiveExtensions}
                  clearable
                  searchable
                  size="sm"
                  style={{ minWidth: 200 }}
                />
                
                <Switch
                  label="Show hidden files"
                  checked={includeHidden}
                  onChange={(e) => setIncludeHidden(e.currentTarget.checked)}
                  size="sm"
                />
              </Group>
            )}
          </Stack>
        )}

        {/* Error Display */}
        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {/* File List Container */}
        <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <ScrollArea style={{ flex: 1 }}>
            {loading ? (
              <Group justify="center" p="xl">
                <Loader size="md" />
                <Text>Loading files...</Text>
              </Group>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    {allowMultipleSelection && <Table.Th w={40}></Table.Th>}
                    <Table.Th>Name</Table.Th>
                    <Table.Th w={100}>Size</Table.Th>
                    <Table.Th w={120}>Modified</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredItems.map((item) => (
                    <Table.Tr
                      key={item.path}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleItemClick(item)}
                    >
                      {allowMultipleSelection && (
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          {!item.isDirectory && (
                            <Checkbox
                              checked={selectedFiles.has(item.path)}
                              onChange={() => handleItemClick(item)}
                            />
                          )}
                        </Table.Td>
                      )}
                      <Table.Td>
                        <Group gap="sm">
                          {item.isDirectory ? (
                            <Text>📁</Text>
                          ) : (
                            <Text>📄</Text>
                          )}
                          <Text>{item.name}</Text>
                          {item.extension && (
                            <Badge size="xs" variant="light">
                              {item.extension}
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {item.size ? formatFileSize(item.size) : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {item.lastModified?.toLocaleDateString() || '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </ScrollArea>

          {/* Selection Summary - Fixed at bottom */}
          {allowMultipleSelection && selectedFiles.size > 0 && (
            <Box p="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
              <Group justify="space-between">
                <Text size="sm">
                  {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
                </Text>
                <Button size="sm" onClick={() => setSelectedFiles(new Set())}>
                  Clear Selection
                </Button>
              </Group>
            </Box>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
