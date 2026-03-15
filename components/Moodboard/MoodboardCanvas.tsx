import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow, MiniMap, Controls, Background, BackgroundVariant, ConnectionMode,
  type Node, type Edge, type Connection, type NodeTypes, type EdgeTypes,
  type OnNodesChange, type OnEdgesChange, type Viewport,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './Moodboard.css';
import { Box, ActionIcon, Group, Tooltip, Text, Badge, SegmentedControl } from '@mantine/core';
import { IconTrash, IconSearch, IconLayoutDistributeHorizontal, IconGridDots } from '@tabler/icons-react';
import { EdgeWeightEditor } from './EdgeWeightEditor';
import SongNode from './nodes/SongNode';
import TagNode from './nodes/TagNode';
import ContainerNode from './nodes/ContainerNode';
import WeightedEdge, { type EdgeType } from './edges/WeightedEdge';
import type { TagCategory } from './nodes/TagNode';
import { applyClusterLayout, applyGridLayout } from './hooks/useMoodboardLayout';
import { computeFilterStates } from './hooks/useMoodboardFilter';
import { transformToContainerView } from './hooks/useContainerView';
import { TagPalette } from './TagPalette';
import type { ViewMode } from './moodboard-constants';

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

  // Compute pure filter states, then apply callbacks/UI concerns
  const { nodeStates, edgeStates } = useMemo(
    () => computeFilterStates(nodes, edges, activeFilterTags),
    [nodes, edges, activeFilterTags],
  );

  const { filteredNodes, filteredEdges } = useMemo(() => {
    const fn = injectCallbacks(nodes, onPlaySong).map(n => {
      const fs = nodeStates.get(n.id) ?? 'normal';
      if (n.type === 'tag') {
        const isActive = activeFilterTags.has(n.id);
        return { ...n, data: { ...n.data, onFilterToggle: toggleFilter, isFilterActive: isActive, filterState: fs } };
      }
      return { ...n, data: { ...n.data, filterState: fs } };
    });
    const fe = edges.map(e => {
      const fs = edgeStates.get(e.id) ?? 'normal';
      return { ...e, data: { ...e.data, filterState: fs } };
    });
    return { filteredNodes: fn, filteredEdges: fe };
  }, [nodes, edges, nodeStates, edgeStates, activeFilterTags, onPlaySong, toggleFilter]);

  // Container view: transform flat nodes into grouped nodes when viewMode !== 'free'
  const { viewNodes, viewEdges } = useMemo(() => {
    const containerResult = transformToContainerView(nodes, edges, viewMode);
    if (!containerResult) {
      return { viewNodes: filteredNodes, viewEdges: filteredEdges };
    }

    // Inject callbacks into the pure result
    const vn = containerResult.viewNodes.map(n => {
      if (n.type === 'song') {
        return { ...n, data: { ...n.data, onPlay: onPlaySong } };
      }
      if (n.type === 'tag') {
        return { ...n, data: { ...n.data, onFilterToggle: toggleFilter, isFilterActive: false } };
      }
      return n;
    });

    return { viewNodes: vn, viewEdges: containerResult.viewEdges };
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
            <TagPalette onAddTag={(label, cat, color) => onAddTag(label, cat, color, 0, 0)} />
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
        <EdgeWeightEditor
          edge={selectedEdge}
          onWeightChange={(id, w) => {
            onEdgeWeightChange(id, w);
            setSelectedEdge(prev => prev ? { ...prev, data: { ...prev.data, weight: w } } : null);
          }}
          onDelete={onEdgeDelete}
          onClose={() => setSelectedEdge(null)}
        />
      )}
    </Box>
  );
}

