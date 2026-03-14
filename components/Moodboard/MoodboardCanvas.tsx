import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow, MiniMap, Controls, Background, BackgroundVariant,
  type Node, type Edge, type Connection, type NodeTypes, type EdgeTypes,
  type OnNodesChange, type OnEdgesChange, type Viewport, useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, ActionIcon, Group, Tooltip, Text, Slider, CloseButton, Stack, Popover, Badge, TextInput, Button, ScrollArea } from '@mantine/core';
import { IconTrash, IconPlus, IconSearch, IconLayoutDistributeHorizontal, IconGridDots } from '@tabler/icons-react';
import SongNode, { type SongNodeData } from './nodes/SongNode';
import TagNode from './nodes/TagNode';
import WeightedEdge, { type EdgeType, type MoodboardEdgeData } from './edges/WeightedEdge';
import type { TagCategory } from './nodes/TagNode';
import { applyClusterLayout, applyGridLayout } from './hooks/useMoodboardLayout';

const TAG_PRESETS: { emoji: string; title: string; category: TagCategory; color: string; tags: string[] }[] = [
  { emoji: '🎭', title: 'Mood', category: 'mood', color: 'pink', tags: ['dark', 'energetic', 'dreamy', 'jungle', 'chill', 'uplifting', 'melancholic', 'hypnotic', 'aggressive', 'euphoric'] },
  { emoji: '🎵', title: 'Genre', category: 'genre', color: 'cyan', tags: ['techno', 'house', 'trance', 'melodic', 'progressive', 'minimal', 'deep', 'afro', 'disco', 'drum & bass'] },
  { emoji: '🎚️', title: 'Phase', category: 'phase', color: 'violet', tags: ['opener', 'buildup', 'peak', 'drop', 'breakdown', 'closer'] },
];

const nodeTypes: NodeTypes = {
  song: SongNode as any,
  tag: TagNode as any,
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
        nodes={filteredNodes}
        edges={filteredEdges}
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

