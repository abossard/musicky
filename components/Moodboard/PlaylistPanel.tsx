import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Group, Text, Badge, Button, ActionIcon, Tooltip, Stack,
  Modal, TextInput, Select, Slider, Switch, Popover, ScrollArea, Loader,
} from '@mantine/core';
import {
  IconPlayerPlay, IconDeviceFloppy, IconChevronDown, IconChevronUp,
  IconSettings, IconPlaylist, IconGripVertical, IconTrash,
} from '@tabler/icons-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';

import {
  onGeneratePlaylist, onSavePlaylist, onGetPlaylists, onGetPlaylistWithItems, onDeletePlaylist,
} from './MoodboardPage.telefunc';
import { showSuccess, showError } from '../../lib/notifications';
import type { PlaylistOptions } from '../../lib/playlist-generator';

import './PlaylistPanel.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaylistEntry {
  filePath: string;
  title: string;
  artist: string;
  phase: string | null;
  position: number;
  reason: string;
}

interface PlaylistStats {
  totalSongs: number;
  phaseCounts: Record<string, number>;
  untaggedCount: number;
  clusterCount: number;
}

interface GeneratedPlaylistResult {
  entries: PlaylistEntry[];
  phases: string[];
  stats: PlaylistStats;
}

interface SavedPlaylistInfo {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
}

export interface PlaylistPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onSongClick?: (filePath: string) => void;
  onSongDoubleClick?: (filePath: string) => void;
  onPlayAll?: (filePaths: string[]) => void;
}

// Phase → color mapping
const PHASE_COLORS: Record<string, string> = {
  opener: 'teal',
  buildup: 'blue',
  peak: 'red',
  cooldown: 'orange',
  closer: 'grape',
};

function phaseColor(phase: string | null): string {
  if (!phase) return 'gray';
  return PHASE_COLORS[phase.toLowerCase()] ?? 'violet';
}

function formatDuration(totalSongs: number): string {
  // Estimate ~3.5 min per song
  const totalMinutes = Math.round(totalSongs * 3.5);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ---------------------------------------------------------------------------
// Sortable song item
// ---------------------------------------------------------------------------

interface SortableSongProps {
  entry: PlaylistEntry;
  globalPosition: number;
  onClick?: (filePath: string) => void;
  onDoubleClick?: (filePath: string) => void;
}

function SortableSong({ entry, globalPosition, onClick, onDoubleClick }: SortableSongProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.filePath,
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: transition ?? undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`playlist-song${isDragging ? ' playlist-song--dragging' : ''}`}
      onClick={() => onClick?.(entry.filePath)}
      onDoubleClick={() => onDoubleClick?.(entry.filePath)}
    >
      <span {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', marginRight: 4 }}>
        <IconGripVertical size={12} color="var(--mantine-color-dimmed)" />
      </span>
      <span className="playlist-song-number">{globalPosition + 1}.</span>
      <span className="playlist-song-info">
        {entry.title || 'Untitled'}
        {entry.artist ? <span className="playlist-song-artist"> – {entry.artist}</span> : null}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PlaylistPanel({
  isOpen,
  onToggle,
  onSongClick,
  onSongDoubleClick,
  onPlayAll,
}: PlaylistPanelProps) {
  // Playlist data
  const [playlist, setPlaylist] = useState<GeneratedPlaylistResult | null>(null);
  const [generating, setGenerating] = useState(false);

  // Saved playlists
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylistInfo[]>([]);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  // Options popover
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [options, setOptions] = useState<PlaylistOptions>({
    moodWeight: 0.6,
    connectionWeight: 0.4,
    untaggedPlacement: 'end',
    useLongestPath: false,
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Load saved playlists on open
  useEffect(() => {
    if (isOpen) {
      onGetPlaylists().then(setSavedPlaylists).catch(() => {});
    }
  }, [isOpen]);

  // Group entries by phase
  const phaseGroups = useMemo(() => {
    if (!playlist) return [];
    const groups: { phase: string; entries: PlaylistEntry[] }[] = [];
    const seen = new Set<string>();

    for (const entry of playlist.entries) {
      const key = entry.phase ?? '__untagged__';
      if (!seen.has(key)) {
        seen.add(key);
        groups.push({ phase: key, entries: [] });
      }
      groups.find(g => g.phase === key)!.entries.push(entry);
    }
    return groups;
  }, [playlist]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const result = await onGeneratePlaylist(options);
      setPlaylist(result);
      setSelectedSavedId(null);
      showSuccess({
        title: 'Playlist Generated',
        message: `${result.stats.totalSongs} songs across ${result.phases.length} phases`,
      });
    } catch (err) {
      console.error('Failed to generate playlist:', err);
      showError({ message: 'Failed to generate playlist' });
    } finally {
      setGenerating(false);
    }
  }, [options]);

  const handleSave = useCallback(async () => {
    if (!playlist || !saveName.trim()) return;
    setSaving(true);
    try {
      const entries = playlist.entries.map(e => ({
        filePath: e.filePath,
        position: e.position,
        phase: e.phase ?? undefined,
      }));
      await onSavePlaylist(saveName.trim(), entries);
      setSaveModalOpen(false);
      setSaveName('');
      showSuccess({ title: 'Playlist Saved', message: `"${saveName.trim()}" saved successfully` });
      const updated = await onGetPlaylists();
      setSavedPlaylists(updated);
    } catch (err) {
      console.error('Failed to save playlist:', err);
    } finally {
      setSaving(false);
    }
  }, [playlist, saveName]);

  const handleLoadSaved = useCallback(async (value: string | null) => {
    setSelectedSavedId(value);
    if (!value) return;
    const id = parseInt(value, 10);
    if (isNaN(id)) return;
    try {
      const result = await onGetPlaylistWithItems(id);
      if (result) {
        const phaseCounts: Record<string, number> = {};
        let untaggedCount = 0;
        for (const item of result.items) {
          if (item.phase) {
            phaseCounts[item.phase] = (phaseCounts[item.phase] ?? 0) + 1;
          } else {
            untaggedCount++;
          }
        }
        const phases = Object.keys(phaseCounts);
        setPlaylist({
          entries: result.items.map(item => ({
            filePath: item.filePath,
            title: item.title,
            artist: item.artist,
            phase: item.phase,
            position: item.position,
            reason: 'phase_order',
          })),
          phases,
          stats: {
            totalSongs: result.items.length,
            phaseCounts,
            untaggedCount,
            clusterCount: 0,
          },
        });
      }
    } catch (err) {
      console.error('Failed to load playlist:', err);
    }
  }, []);

  const handleDeleteSaved = useCallback(async () => {
    if (!selectedSavedId) return;
    const id = parseInt(selectedSavedId, 10);
    if (isNaN(id)) return;
    try {
      await onDeletePlaylist(id);
      setSelectedSavedId(null);
      const updated = await onGetPlaylists();
      setSavedPlaylists(updated);
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  }, [selectedSavedId]);

  const handlePlayAll = useCallback(() => {
    if (!playlist || !onPlayAll) return;
    onPlayAll(playlist.entries.map(e => e.filePath));
  }, [playlist, onPlayAll]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !playlist) return;

    const entries = [...playlist.entries];
    const oldIndex = entries.findIndex(e => e.filePath === active.id);
    const newIndex = entries.findIndex(e => e.filePath === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(entries, oldIndex, newIndex).map((e, i) => ({
      ...e,
      position: i,
    }));

    setPlaylist({ ...playlist, entries: reordered });
  }, [playlist]);

  const allFilePaths = useMemo(
    () => playlist?.entries.map(e => e.filePath) ?? [],
    [playlist],
  );

  return (
    <Box className={`playlist-panel ${isOpen ? 'playlist-panel--expanded' : 'playlist-panel--collapsed'}`}>
      {/* Header bar */}
      <div className="playlist-header" onClick={onToggle}>
        <Group gap={8}>
          <IconPlaylist size={14} />
          <Text size="sm" fw={600}>Playlist</Text>
          {playlist && (
            <Badge size="xs" variant="filled" color="violet">{playlist.stats.totalSongs} songs</Badge>
          )}
        </Group>
        <Group gap={4} onClick={(e) => e.stopPropagation()}>
          {/* Load saved */}
          <Select
            size="xs"
            placeholder="Load saved…"
            data={savedPlaylists.map(p => ({ value: String(p.id), label: `${p.name} (${p.itemCount})` }))}
            value={selectedSavedId}
            onChange={handleLoadSaved}
            clearable
            style={{ width: 160 }}
            comboboxProps={{ withinPortal: true }}
          />
          {selectedSavedId && (
            <Tooltip label="Delete saved playlist" position="bottom">
              <ActionIcon size="xs" variant="subtle" color="red" onClick={handleDeleteSaved}>
                <IconTrash size={12} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Options popover */}
          <Popover opened={optionsOpen} onChange={setOptionsOpen} position="top-end" withArrow withinPortal>
            <Popover.Target>
              <Tooltip label="Generation options" position="bottom">
                <ActionIcon size="sm" variant="subtle" onClick={() => setOptionsOpen(o => !o)}>
                  <IconSettings size={14} />
                </ActionIcon>
              </Tooltip>
            </Popover.Target>
            <Popover.Dropdown style={{ width: 260 }}>
              <Text size="xs" fw={600} mb={8}>Playlist Options</Text>
              <Text size="xs" c="dimmed" mb={4}>Mood weight: {options.moodWeight?.toFixed(1)}</Text>
              <Slider
                size="xs"
                min={0} max={1} step={0.1}
                value={options.moodWeight ?? 0.6}
                onChange={(v) => setOptions(o => ({ ...o, moodWeight: v }))}
                mb={8}
              />
              <Text size="xs" c="dimmed" mb={4}>Connection weight: {options.connectionWeight?.toFixed(1)}</Text>
              <Slider
                size="xs"
                min={0} max={1} step={0.1}
                value={options.connectionWeight ?? 0.4}
                onChange={(v) => setOptions(o => ({ ...o, connectionWeight: v }))}
                mb={8}
              />
              <Switch
                size="xs"
                label="Include untagged songs"
                checked={options.untaggedPlacement !== 'exclude'}
                onChange={(e) => setOptions(o => ({
                  ...o,
                  untaggedPlacement: e.currentTarget.checked ? 'end' : 'exclude',
                }))}
                mb={8}
              />
              <Switch
                size="xs"
                label="Use longest path"
                checked={options.useLongestPath ?? false}
                onChange={(e) => setOptions(o => ({ ...o, useLongestPath: e.currentTarget.checked }))}
              />
            </Popover.Dropdown>
          </Popover>

          {/* Generate */}
          <Tooltip label="Generate playlist from moodboard" position="bottom">
            <Button
              size="compact-xs"
              variant="light"
              color="violet"
              leftSection={generating ? <Loader size={12} /> : <IconPlaylist size={12} />}
              onClick={handleGenerate}
              disabled={generating}
            >
              Generate
            </Button>
          </Tooltip>

          {/* Play all */}
          {playlist && onPlayAll && (
            <Tooltip label="Play all" position="bottom">
              <ActionIcon size="sm" variant="light" color="green" onClick={handlePlayAll}>
                <IconPlayerPlay size={14} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Save */}
          {playlist && (
            <Tooltip label="Save playlist" position="bottom">
              <ActionIcon size="sm" variant="light" color="blue" onClick={() => { setSaveName(''); setSaveModalOpen(true); }}>
                <IconDeviceFloppy size={14} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Collapse/expand */}
          <Tooltip label={isOpen ? 'Collapse' : 'Expand'} position="bottom">
            <ActionIcon size="sm" variant="subtle" onClick={onToggle}>
              {isOpen ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      {/* Body (only rendered when expanded) */}
      {isOpen && (
        <div className="playlist-body">
          {!playlist ? (
            <div className="playlist-empty">
              <Stack align="center" gap={4}>
                <IconPlaylist size={24} opacity={0.3} />
                <Text size="xs" c="dimmed">Generate a playlist to see songs organized by phase</Text>
              </Stack>
            </div>
          ) : playlist.entries.length === 0 ? (
            <div className="playlist-empty">
              <Text size="xs" c="dimmed">No songs in playlist. Add songs to the moodboard first.</Text>
            </div>
          ) : (
            <>
              <ScrollArea scrollbarSize={6} type="auto" style={{ flex: 1 }}>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={allFilePaths} strategy={verticalListSortingStrategy}>
                    <div className="playlist-phases">
                      {phaseGroups.map(group => (
                        <div className="playlist-phase" key={group.phase}>
                          <div className="playlist-phase-header">
                            <Badge
                              size="xs"
                              variant="light"
                              color={phaseColor(group.phase === '__untagged__' ? null : group.phase)}
                            >
                              {group.phase === '__untagged__' ? 'Untagged' : group.phase}
                              {' '}({group.entries.length})
                            </Badge>
                          </div>
                          <div className="playlist-phase-songs">
                            {group.entries.map(entry => (
                              <SortableSong
                                key={entry.filePath}
                                entry={entry}
                                globalPosition={entry.position}
                                onClick={onSongClick}
                                onDoubleClick={onSongDoubleClick}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </ScrollArea>

              {/* Stats footer */}
              <div className="playlist-footer">
                <Text size="xs" c="dimmed">
                  Total: {playlist.stats.totalSongs} songs
                </Text>
                <Text size="xs" c="dimmed">
                  ~{formatDuration(playlist.stats.totalSongs)}
                </Text>
                <Text size="xs" c="dimmed">
                  {playlist.phases.length} phase{playlist.phases.length !== 1 ? 's' : ''}
                </Text>
                <Text size="xs" c="dimmed">
                  {playlist.stats.clusterCount} cluster{playlist.stats.clusterCount !== 1 ? 's' : ''}
                </Text>
              </div>
            </>
          )}
        </div>
      )}

      {/* Save modal */}
      <Modal opened={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="Save Playlist" size="sm">
        <TextInput
          label="Playlist name"
          placeholder="My DJ Set"
          value={saveName}
          onChange={(e) => setSaveName(e.currentTarget.value)}
          mb="md"
          data-autofocus
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={() => setSaveModalOpen(false)}>Cancel</Button>
          <Button
            color="violet"
            onClick={handleSave}
            loading={saving}
            disabled={!saveName.trim()}
            leftSection={<IconDeviceFloppy size={14} />}
          >
            Save
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
