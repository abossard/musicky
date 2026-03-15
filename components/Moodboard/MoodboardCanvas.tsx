import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow, MiniMap, Controls, Background, BackgroundVariant, ConnectionMode,
  type Node, type Edge, type Connection, type NodeTypes, type EdgeTypes,
  type OnNodesChange, type OnEdgesChange, type Viewport,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './Moodboard.css';
import { Box, ActionIcon, Group, Tooltip, Text, Slider, CloseButton, Stack, Popover, Badge, TextInput, Button, ScrollArea, SegmentedControl } from '@mantine/core';
import { IconTrash, IconPlus, IconSearch, IconLayoutDistributeHorizontal, IconGridDots, IconBoxMultiple } from '@tabler/icons-react';
import SongNode, { type SongNodeData } from './nodes/SongNode';
import TagNode from './nodes/TagNode';
import ContainerNode, { type ContainerNodeData } from './nodes/ContainerNode';
import WeightedEdge, { type EdgeType, type MoodboardEdgeData } from './edges/WeightedEdge';
import type { TagCategory } from './nodes/TagNode';
import { applyClusterLayout, applyGridLayout } from './hooks/useMoodboardLayout';

export type ViewMode = 'free' | 'genre' | 'phase' | 'mood';

const TAG_PRESETS: { emoji: string; title: string; category: TagCategory; color: string; tags: string[] }[] = [
  { emoji: '🎭', title: 'Mood', category: 'mood', color: 'pink', tags: ['dark', 'energetic', 'dreamy', 'jungle', 'chill', 'uplifting', 'melancholic', 'hypnotic', 'aggressive', 'euphoric'] },
  { emoji: '🎵', title: 'Genre', category: 'genre', color: 'cyan', tags: ['techno', 'house', 'trance', 'melodic', 'progressive', 'minimal', 'deep', 'afro', 'disco', 'drum & bass'] },
  { emoji: '🎚️', title: 'Phase', category: 'phase', color: 'violet', tags: ['opener', 'buildup', 'peak', 'drop', 'breakdown', 'closer'] },
];

const nodeTypes: NodeTypes = {
  song: SongNode as any,
  tag: TagNode as any,
  container: ContainerNode as any,
};

const edgeTypes: EdgeTypes = {
  weighted: WeightedEdge as any,
};

interface MoodboardCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  viewport: Viewport;
  onViewportChange: (vp: Viewport) => void;
  onConnect: (connection: Connection, edgeType: EdgeType, weight: number) => void;
  onNodeDelete: (nodeId: string) => void;
  onEdgeDelete: (edgeId: string) => void;
  onEdgeWeightChange: (edgeId: string, weight: number) => void;
  onSearchOpen: () => void;
  onAddTag: (label: string, category: TagCategory, color: string, x: number, y: number) => void;
  onPlaySong: (filePath: string) => void;
  onNodesUpdate: (nodes: Node[]) => void;
}

// Inject onPlay callback into song node data
function injectCallbacks(nodes: Node[], onPlaySong: (path: string) => void): Node[] {
  return nodes.map(n => {
    if (n.type !== 'song') return n;
    return { ...n, data: { ...n.data, onPlay: onPlaySong } };
  });
}

export function MoodboardCanvas({
  nodes, edges, onNodesChange, onEdgesChange,
  viewport, onViewportChange,
  onConnect, onNodeDelete, onEdgeDelete, onEdgeWeightChange,
  onSearchOpen, onAddTag, onPlaySong, onNodesUpdate,
}: MoodboardCanvasProps) {
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [tagPaletteOpen, setTagPaletteOpen] = useState(false);
  const [customTagText, setCustomTagText] = useState('');
  const [activeFilterTags, setActiveFilterTags] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('free');

  const toggleFilter = useCallback((tagNodeId: string) => {
    setActiveFilterTags(prev => {
      const next = new Set(prev);
      if (next.has(tagNodeId)) next.delete(tagNodeId);
      else next.add(tagNodeId);
      return next;
    });
  }, []);

  const handleClusterLayout = useCallback(() => {
    const laid = applyClusterLayout(nodes, edges);
    onNodesUpdate(laid);
  }, [nodes, edges, onNodesUpdate]);

  const handleGridLayout = useCallback(() => {
    const laid = applyGridLayout(nodes);
    onNodesUpdate(laid);
  }, [nodes, onNodesUpdate]);

  // Compute filter states for all nodes and edges
  const { filteredNodes, filteredEdges } = useMemo(() => {
    if (activeFilterTags.size === 0) {
      // No filter — everything normal
      const fn = injectCallbacks(nodes, onPlaySong).map(n => {
        if (n.type === 'tag') return { ...n, data: { ...n.data, onFilterToggle: toggleFilter, isFilterActive: false, filterState: 'normal' } };
        return { ...n, data: { ...n.data, filterState: 'normal' } };
      });
      return { filteredNodes: fn, filteredEdges: edges };
    }

    // Find songs connected to ALL active filter tags
    const songToTags = new Map<string, Set<string>>();
    for (const edge of edges) {
      const songId = nodes.find(n => n.id === edge.source && n.type === 'song')?.id
        || nodes.find(n => n.id === edge.target && n.type === 'song')?.id;
      const tagId = nodes.find(n => n.id === edge.source && n.type === 'tag')?.id
        || nodes.find(n => n.id === edge.target && n.type === 'tag')?.id;
      if (songId && tagId) {
        const set = songToTags.get(songId) || new Set();
        set.add(tagId);
        songToTags.set(songId, set);
      }
    }

    // Primary = connected to ALL active tags
    const primarySongIds = new Set<string>();
    for (const [songId, connectedTags] of songToTags) {
      if ([...activeFilterTags].every(t => connectedTags.has(t))) {
        primarySongIds.add(songId);
      }
    }

    // Secondary = songs connected to primary songs via song→song edges
    const secondarySongIds = new Set<string>();
    for (const edge of edges) {
      const srcSong = nodes.find(n => n.id === edge.source && n.type === 'song');
      const tgtSong = nodes.find(n => n.id === edge.target && n.type === 'song');
      if (srcSong && tgtSong) {
        if (primarySongIds.has(srcSong.id) && !primarySongIds.has(tgtSong.id)) secondarySongIds.add(tgtSong.id);
        if (primarySongIds.has(tgtSong.id) && !primarySongIds.has(srcSong.id)) secondarySongIds.add(srcSong.id);
      }
    }

    const fn = injectCallbacks(nodes, onPlaySong).map(n => {
      if (n.type === 'tag') {
        const isActive = activeFilterTags.has(n.id);
        return { ...n, data: { ...n.data, onFilterToggle: toggleFilter, isFilterActive: isActive, filterState: isActive ? 'primary' : 'normal' } };
      }
      const fs = primarySongIds.has(n.id) ? 'primary'
        : secondarySongIds.has(n.id) ? 'secondary'
        : 'hidden';
      return { ...n, data: { ...n.data, filterState: fs } };
    });

    // Set edge filter states too
    const fe = edges.map(e => {
      const srcPrimary = primarySongIds.has(e.source) || activeFilterTags.has(e.source);
      const tgtPrimary = primarySongIds.has(e.target) || activeFilterTags.has(e.target);
      const srcSecondary = secondarySongIds.has(e.source);
      const tgtSecondary = secondarySongIds.has(e.target);
      const fs = (srcPrimary && tgtPrimary) ? 'primary'
        : (srcPrimary && tgtSecondary) || (srcSecondary && tgtPrimary) ? 'secondary'
        : 'hidden';
      return { ...e, data: { ...e.data, filterState: fs } };
    });

    return { filteredNodes: fn, filteredEdges: fe };
  }, [nodes, edges, activeFilterTags, onPlaySong, toggleFilter]);

  // Container view: transform flat nodes into grouped nodes when viewMode !== 'free'
  const { viewNodes, viewEdges } = useMemo(() => {
    if (viewMode === 'free') {
      return { viewNodes: filteredNodes, viewEdges: filteredEdges };
    }

    const category = viewMode as TagCategory;
    const tagNodesOfCategory = nodes.filter(n => n.type === 'tag' && (n.data as any)?.category === category);
    const songNodes = nodes.filter(n => n.type === 'song');
    const otherTags = nodes.filter(n => n.type === 'tag' && (n.data as any)?.category !== category);

    // Build song→tag adjacency for this category
    const songToContainerTag = new Map<string, string>();
    for (const edge of edges) {
      const songId = songNodes.find(n => n.id === edge.source)?.id || songNodes.find(n => n.id === edge.target)?.id;
      const tagId = tagNodesOfCategory.find(n => n.id === edge.source)?.id || tagNodesOfCategory.find(n => n.id === edge.target)?.id;
      if (songId && tagId && !songToContainerTag.has(songId)) {
        songToContainerTag.set(songId, tagId);
      }
    }

    // Create container nodes with auto-layout positioning
    const containerNodes: Node[] = [];
    const childrenByContainer = new Map<string, Node[]>();
    const SONG_TILE = 150;
    const PADDING = 80;
    const HEADER = 80;
    const COLS = 3;
    const CONTAINER_GAP = 120;

    // Collect containers with their children
    const containerDefs: { id: string; tag: Node; children: Node[] }[] = [];
    for (const tag of tagNodesOfCategory) {
      const containerId = `container-${tag.id}`;
      const children = songNodes.filter(s => songToContainerTag.get(s.id) === tag.id);
      containerDefs.push({ id: containerId, tag, children });
    }

    // Add uncategorized
    const uncategorized = songNodes.filter(s => !songToContainerTag.has(s.id));
    if (uncategorized.length > 0) {
      containerDefs.push({
        id: 'container-uncategorized',
        tag: { id: 'uncategorized', data: { label: 'Uncategorized', category: 'custom', color: 'gray' } } as any,
        children: uncategorized,
      });
    }

    // Auto-layout containers in a grid (2 columns of containers)
    const CONTAINER_COLS = 2;
    let containerX = 0;
    let containerY = 0;
    let maxHeightInRow = 0;

    containerDefs.forEach((def, idx) => {
      const cols = Math.min(COLS, Math.max(1, def.children.length));
      const rows = Math.max(1, Math.ceil(def.children.length / COLS));
      const w = cols * SONG_TILE + PADDING * 2;
      const h = HEADER + rows * SONG_TILE + PADDING;

      childrenByContainer.set(def.id, def.children);

      const borderColor = def.tag.data?.color === 'violet' ? '#9775fa' : def.tag.data?.color === 'cyan' ? '#3bc9db' : def.tag.data?.color === 'pink' ? '#f06595' : '#868e96';
      const bgColor = def.tag.data?.color === 'violet' ? 'rgba(112,72,232,0.12)' : def.tag.data?.color === 'cyan' ? 'rgba(34,184,207,0.12)' : def.tag.data?.color === 'pink' ? 'rgba(230,73,128,0.12)' : 'rgba(134,142,150,0.12)';
      containerNodes.push({
        id: def.id,
        type: 'container',
        position: { x: containerX, y: containerY },
        data: {
          label: (def.tag.data as any)?.label || 'Tag',
          category: (def.tag.data as any)?.category || category,
          color: (def.tag.data as any)?.color || 'gray',
          childCount: def.children.length,
          width: w,
          height: h,
        } satisfies ContainerNodeData as any,
        style: { width: w, height: h },
        zIndex: 0,
      });

      maxHeightInRow = Math.max(maxHeightInRow, h);
      if ((idx + 1) % CONTAINER_COLS === 0) {
        containerX = 0;
        containerY += maxHeightInRow + CONTAINER_GAP;
        maxHeightInRow = 0;
      } else {
        containerX += w + CONTAINER_GAP;
      }
    });

    // Position song nodes at absolute positions overlapping their container
    const allChildNodes: Node[] = [];
    // Build a map of container positions
    const containerPositions = new Map<string, { x: number; y: number }>();
    containerNodes.forEach(c => containerPositions.set(c.id, c.position));

    for (const [containerId, children] of childrenByContainer) {
      const cp = containerPositions.get(containerId) || { x: 0, y: 0 };
      children.forEach((song, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        allChildNodes.push({
          ...injectCallbacks([song], onPlaySong)[0],
          position: { x: cp.x + PADDING + col * SONG_TILE, y: cp.y + HEADER + PADDING + row * SONG_TILE },
          data: { ...song.data, onPlay: onPlaySong, filterState: 'normal' },
          zIndex: 200,
        });
      });
    }

    // Keep non-category tag nodes visible
    const otherTagNodes = otherTags.map(n => ({
      ...n,
      data: { ...n.data, onFilterToggle: toggleFilter, isFilterActive: false, filterState: 'normal' },
    }));

    // Order: containers first, then children, then other tags
    const vn = [...containerNodes, ...allChildNodes, ...otherTagNodes];

    // Only keep edges that don't connect to container-category tags (they're now containers)
    const tagIdsInContainers = new Set(tagNodesOfCategory.map(t => t.id));
    const ve = filteredEdges.filter(e => !tagIdsInContainers.has(e.source) && !tagIdsInContainers.has(e.target));

    return { viewNodes: vn, viewEdges: ve };
  }, [viewMode, filteredNodes, filteredEdges, nodes, edges, onPlaySong, toggleFilter]);

  const handleConnect = useCallback((connection: Connection) => {
    const targetNode = nodes.find(n => n.id === connection.target);
    let edgeType: EdgeType = 'custom';
    if (targetNode?.type === 'tag') {
      const category = (targetNode.data as any)?.category as TagCategory | undefined;
      if (category === 'genre' || category === 'mood' || category === 'phase' || category === 'topic') {
        edgeType = category;
      }
    } else {
      const sourceNode = nodes.find(n => n.id === connection.source);
      if (sourceNode?.type === 'song' && targetNode?.type === 'song') {
        edgeType = 'similarity';
      }
    }
    onConnect(connection, edgeType, 0.7);
  }, [nodes, onConnect]);

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedEdge(null);
  }, []);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    onNodeDelete(node.id);
  }, [onNodeDelete]);

  return (
    <Box style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={viewNodes}
        edges={viewEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodeContextMenu={handleNodeContextMenu}
        defaultViewport={viewport}
        onMoveEnd={(_event, vp) => onViewportChange(vp)}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.05}
        maxZoom={4}
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        connectionMode={ConnectionMode.Loose}
        style={{ background: '#1A1B1E' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2C2E33" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => n.type === 'song' ? '#7048e8' : '#22b8cf'}
          maskColor="rgba(0,0,0,0.7)"
          style={{ background: '#25262b' }}
        />

        {/* Toolbar panel */}
        <Panel position="top-left">
          <Group gap={4} style={{ background: 'rgba(37,38,43,0.9)', padding: '4px 8px', borderRadius: 6, border: '1px solid #373A40', backdropFilter: 'blur(8px)' }}>
            <Tooltip label="Add song (Ctrl+K)">
              <ActionIcon variant="light" color="violet" onClick={onSearchOpen} aria-label="Search songs">
                <IconSearch size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Cluster layout (group by tags)">
              <ActionIcon variant="light" color="teal" onClick={handleClusterLayout} aria-label="Cluster layout">
                <IconLayoutDistributeHorizontal size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Grid layout">
              <ActionIcon variant="light" color="gray" onClick={handleGridLayout} aria-label="Grid layout">
                <IconGridDots size={18} />
              </ActionIcon>
            </Tooltip>
            <Box style={{ width: 1, height: 20, background: '#555', margin: '0 2px' }} />
            <SegmentedControl
              size="xs"
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              data={[
                { label: 'Free', value: 'free' },
                { label: 'Phase', value: 'phase' },
                { label: 'Genre', value: 'genre' },
                { label: 'Mood', value: 'mood' },
              ]}
              style={{ background: 'rgba(0,0,0,0.3)' }}
            />
            <Popover opened={tagPaletteOpen} onChange={setTagPaletteOpen} position="bottom-start" shadow="md" width={320}>
              <Popover.Target>
                <Tooltip label="Add tag">
                  <ActionIcon variant="light" color="cyan" onClick={() => setTagPaletteOpen(o => !o)} aria-label="Add tag">
                    <IconPlus size={18} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown style={{ background: '#25262b', border: '1px solid #373A40' }}>
                <ScrollArea.Autosize mah={400}>
                  <Stack gap="sm">
                    {TAG_PRESETS.map(preset => (
                      <Box key={preset.category}>
                        <Text size="xs" fw={600} mb={4}>{preset.emoji} {preset.title}</Text>
                        <Group gap={6} wrap="wrap">
                          {preset.tags.map(tag => (
                            <Badge
                              key={tag}
                              variant="light"
                              color={preset.color}
                              size="sm"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                onAddTag(tag, preset.category, preset.color, 0, 0);
                                setTagPaletteOpen(false);
                              }}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </Group>
                      </Box>
                    ))}
                    <Box>
                      <Text size="xs" fw={600} mb={4}>✏️ Custom</Text>
                      <Group gap="xs" wrap="nowrap">
                        <TextInput
                          size="xs"
                          placeholder="Custom tag…"
                          value={customTagText}
                          onChange={e => setCustomTagText(e.currentTarget.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && customTagText.trim()) {
                              onAddTag(customTagText.trim(), 'custom', 'gray', 0, 0);
                              setCustomTagText('');
                              setTagPaletteOpen(false);
                            }
                          }}
                          style={{ flex: 1 }}
                        />
                        <Button
                          size="xs"
                          variant="light"
                          color="gray"
                          disabled={!customTagText.trim()}
                          onClick={() => {
                            onAddTag(customTagText.trim(), 'custom', 'gray', 0, 0);
                            setCustomTagText('');
                            setTagPaletteOpen(false);
                          }}
                        >
                          Add
                        </Button>
                      </Group>
                    </Box>
                  </Stack>
                </ScrollArea.Autosize>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Panel>

        {/* Filter bar — shows when filters are active */}
        {activeFilterTags.size > 0 && (
          <Panel position="bottom-center">
            <Group gap={6} style={{ background: 'rgba(37,38,43,0.95)', padding: '6px 12px', borderRadius: 8, border: '1px solid #373A40', backdropFilter: 'blur(8px)' }}>
              <Text size="xs" c="dimmed" fw={600}>Filter:</Text>
              {nodes.filter(n => n.type === 'tag' && activeFilterTags.has(n.id)).map(n => {
                const td = n.data as any;
                return (
                  <Badge key={n.id} size="sm" variant="filled" color={td.color || 'violet'}
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleFilter(n.id)}
                    rightSection="×"
                  >{td.label}</Badge>
                );
              })}
              <Text size="xs" c="dimmed">
                {filteredNodes.filter(n => n.type === 'song' && (n.data as any).filterState === 'primary').length} matches
              </Text>
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setActiveFilterTags(new Set())} title="Clear filters">
                <IconTrash size={12} />
              </ActionIcon>
            </Group>
          </Panel>
        )}

        {/* Hint for filtering */}
        {activeFilterTags.size === 0 && nodes.some(n => n.type === 'tag') && (
          <Panel position="bottom-center">
            <Text size="xs" c="dimmed" style={{ background: 'rgba(37,38,43,0.7)', padding: '3px 10px', borderRadius: 4 }}>
              Double-click a tag to filter
            </Text>
          </Panel>
        )}
      </ReactFlow>

      {/* Edge weight editor */}
      {selectedEdge && (
        <Box style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(37,38,43,0.9)', border: '1px solid #373A40', borderRadius: 6,
          padding: '8px 10px', zIndex: 100, width: 180, backdropFilter: 'blur(8px)',
        }}>
          <Group justify="space-between" mb={4}>
            <Text size="xs" fw={600}>{Math.round(((selectedEdge.data as any)?.weight ?? 1) * 100)}% <Text span size="xs" c="dimmed" tt="capitalize">{(selectedEdge.data as any)?.edgeType || ''}</Text></Text>
            <Group gap={4}>
              <ActionIcon variant="subtle" color="red" size="xs" onClick={() => { onEdgeDelete(selectedEdge.id); setSelectedEdge(null); }}>
                <IconTrash size={12} />
              </ActionIcon>
              <CloseButton size="xs" onClick={() => setSelectedEdge(null)} />
            </Group>
          </Group>
          <Slider
            min={0} max={1} step={0.05}
            value={(selectedEdge.data as any)?.weight ?? 1}
            onChange={(val) => {
              onEdgeWeightChange(selectedEdge.id, val);
              setSelectedEdge(prev => prev ? { ...prev, data: { ...prev.data, weight: val } } : null);
            }}
            color="violet"
            size="xs"
          />
        </Box>
      )}
    </Box>
  );
}

