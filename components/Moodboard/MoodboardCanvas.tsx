import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, MiniMap, Controls, Background, BackgroundVariant, ConnectionMode,
  useReactFlow,
  type Node, type Edge, type Connection, type NodeTypes, type EdgeTypes,
  type OnNodesChange, type OnEdgesChange, type Viewport,
  Panel,
  type OnConnectStart,
  type OnConnectEnd,
  type OnSelectionChangeFunc,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './Moodboard.css';
import { Box, ActionIcon, Group, Tooltip, Text, Badge, SegmentedControl, Slider, Switch } from '@mantine/core';
import { IconTrash, IconSearch, IconLayoutDistributeHorizontal, IconGridDots } from '@tabler/icons-react';
import { EdgeWeightEditor } from './EdgeWeightEditor';
import { MoodboardConnectionLine } from './edges/MoodboardConnectionLine';
import SongNode from './nodes/SongNode';
import TagNode from './nodes/TagNode';
import ContainerNode from './nodes/ContainerNode';
import WeightedEdge, { type EdgeType, type EdgeStyle } from './edges/WeightedEdge';
import type { TagCategory } from './nodes/TagNode';
import { applyClusterLayout, applyGridLayout } from './hooks/useMoodboardLayout';
import { computeFilterStates } from './hooks/useMoodboardFilter';
import { transformToContainerView } from './hooks/useContainerView';
import { TagPalette } from './TagPalette';
import type { ViewMode } from './moodboard-constants';
import { EDGE_STYLE_OPTIONS, DEFAULT_BUNDLE_CONFIG, type BundleConfig } from './moodboard-constants';
import { computeBundles } from '../../lib/edge-bundling';
import { getCompatibleCamelotKeys } from '../../lib/camelot';
import type { SongNodeData, HarmonyHighlight } from './nodes/SongNode';

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
  onConnect: (connection: Connection, edgeType: EdgeType, weight: number) => Promise<Edge | null>;
  onNodeDelete: (nodeId: string) => void;
  onEdgeDelete: (edgeId: string) => void;
  onEdgeWeightChange: (edgeId: string, weight: number) => void;
  onEdgeTypeChange?: (edgeId: string, newType: string) => void;
  onSearchOpen: () => void;
  onAddTag: (label: string, category: TagCategory, color: string, x: number, y: number) => void;
  onPlaySong: (filePath: string) => void;
  onHoverPlaySong: (filePath: string) => void;
  onNodesUpdate: (nodes: Node[]) => void;
  onAddSong?: (filePath: string, x: number, y: number) => void;
  onSelectedSongKeyChange?: (key: string | null) => void;
  scrollToNodeRef?: React.MutableRefObject<((nodeId: string) => void) | null>;
}

function injectCallbacks(
  nodes: Node[],
  onPlaySong: (path: string) => void,
  onHoverPlaySong: (path: string) => void,
): Node[] {
  return nodes.map(n => {
    if (n.type !== 'song') return n;
    return {
      ...n,
      data: {
        ...n.data,
        onPlayToggle: onPlaySong,
        onHoverPlay: onHoverPlaySong,
      },
    };
  });
}

interface PendingConnection {
  nodeId: string;
  handleId: string | null;
  handleType: 'source' | 'target' | null;
}

function resolveEdgeType(nodes: Node[], connection: Connection): EdgeType {
  const targetNode = nodes.find((node) => node.id === connection.target);

  if (targetNode?.type === 'tag') {
    const category = (targetNode.data as any)?.category as TagCategory | undefined;
    if (category === 'genre' || category === 'mood' || category === 'phase' || category === 'topic') {
      return category;
    }
  }

  const sourceNode = nodes.find((node) => node.id === connection.source);
  if (sourceNode?.type === 'song' && targetNode?.type === 'song') {
    return 'similarity';
  }

  return 'custom';
}

export function MoodboardCanvas({
  nodes, edges, onNodesChange, onEdgesChange,
  viewport, onViewportChange,
  onConnect, onNodeDelete, onEdgeDelete, onEdgeWeightChange, onEdgeTypeChange,
  onSearchOpen, onAddTag, onPlaySong, onHoverPlaySong, onNodesUpdate, onAddSong,
  onSelectedSongKeyChange,
  scrollToNodeRef,
}: MoodboardCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingConnectionRef = useRef<PendingConnection | null>(null);
  const connectionCreatedRef = useRef(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { screenToFlowPosition, setCenter, getNode, setNodes: rfSetNodes } = useReactFlow();
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editorPosition, setEditorPosition] = useState<{ x: number; y: number } | null>(null);
  const [activeFilterTags, setActiveFilterTags] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('free');
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('smart');
  const [smartNodePadding, setSmartNodePadding] = useState(15);
  const [smartGridRatio, setSmartGridRatio] = useState(10);
  const [bundleConfig, setBundleConfig] = useState<BundleConfig>(DEFAULT_BUNDLE_CONFIG);

  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  useEffect(() => {
    if (!selectedEdgeId) return;
    if (!edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
      setEditorPosition(null);
    }
  }, [edges, selectedEdgeId]);

  useEffect(() => {
    if (selectedNodeIds.length === 0) {
      return;
    }

    const existingNodeIds = new Set(nodes.map((node) => node.id));
    const nextSelectedNodeIds = selectedNodeIds.filter((nodeId) => existingNodeIds.has(nodeId));

    if (nextSelectedNodeIds.length !== selectedNodeIds.length) {
      setSelectedNodeIds(nextSelectedNodeIds);
    }
  }, [nodes, selectedNodeIds]);

  // Expose scrollToNode via ref for parent components (e.g. GlobalSearch)
  useEffect(() => {
    if (!scrollToNodeRef) return;
    scrollToNodeRef.current = (nodeId: string) => {
      const node = getNode(nodeId);
      if (node) {
        setCenter(node.position.x + 60, node.position.y + 60, { zoom: 1.5, duration: 500 });
        rfSetNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })));
      }
    };
    return () => { scrollToNodeRef.current = null; };
  }, [scrollToNodeRef, setCenter, getNode, rfSetNodes]);

  const focusCanvas = useCallback(() => {
    containerRef.current?.focus();
  }, []);

  const getRelativePosition = useCallback((event: MouseEvent | TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 160, y: 160 };
    }

    const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? rect.left + rect.width / 2) : event.clientX;
    const clientY = 'touches' in event ? (event.touches[0]?.clientY ?? rect.top + rect.height / 2) : event.clientY;

    return {
      x: Math.min(Math.max(clientX - rect.left, 24), rect.width - 24),
      y: Math.min(Math.max(clientY - rect.top, 24), rect.height - 24),
    };
  }, []);

  const selectEdge = useCallback((edgeId: string, position?: { x: number; y: number } | null) => {
    setSelectedEdgeId(edgeId);
    if (position) {
      setEditorPosition(position);
    }
    focusCanvas();
  }, [focusCanvas]);

  const createEdge = useCallback(async (connection: Connection, position?: { x: number; y: number } | null) => {
    if (!connection.source || !connection.target || connection.source === connection.target) {
      return null;
    }

    const createdEdge = await onConnect(connection, resolveEdgeType(nodes, connection), 0.7);
    if (!createdEdge) {
      return null;
    }

    connectionCreatedRef.current = true;
    selectEdge(createdEdge.id, position ?? editorPosition ?? null);
    return createdEdge;
  }, [editorPosition, nodes, onConnect, selectEdge]);

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

  // Compute harmony highlights based on the selected song's Camelot key
  const harmonyMap = useMemo<Map<string, HarmonyHighlight>>(() => {
    const map = new Map<string, HarmonyHighlight>();
    if (selectedNodeIds.length !== 1) return map;

    const selectedNode = nodes.find(n => n.id === selectedNodeIds[0]);
    if (!selectedNode || selectedNode.type !== 'song') return map;

    const selectedKey = (selectedNode.data as unknown as SongNodeData).camelotKey;
    if (!selectedKey) return map;

    const compatibleKeys = new Set(getCompatibleCamelotKeys(selectedKey));

    for (const n of nodes) {
      if (n.type !== 'song') continue;
      if (n.id === selectedNode.id) {
        map.set(n.id, 'selected');
        continue;
      }
      const key = (n.data as unknown as SongNodeData).camelotKey;
      if (!key) continue;
      map.set(n.id, compatibleKeys.has(key) ? 'compatible' : 'incompatible');
    }
    return map;
  }, [selectedNodeIds, nodes]);

  // Notify parent about the selected song's Camelot key for library filtering
  useEffect(() => {
    if (!onSelectedSongKeyChange) return;
    if (selectedNodeIds.length !== 1) {
      onSelectedSongKeyChange(null);
      return;
    }
    const selectedNode = nodes.find(n => n.id === selectedNodeIds[0]);
    if (!selectedNode || selectedNode.type !== 'song') {
      onSelectedSongKeyChange(null);
      return;
    }
    const key = (selectedNode.data as unknown as SongNodeData).camelotKey ?? null;
    onSelectedSongKeyChange(key);
  }, [selectedNodeIds, nodes, onSelectedSongKeyChange]);

  const { filteredNodes, filteredEdges } = useMemo(() => {
    const fn = injectCallbacks(nodes, onPlaySong, onHoverPlaySong).map(n => {
      const fs = nodeStates.get(n.id) ?? 'normal';
      const hh = harmonyMap.get(n.id) ?? null;
      if (n.type === 'tag') {
        const isActive = activeFilterTags.has(n.id);
        return { ...n, data: { ...n.data, onFilterToggle: toggleFilter, isFilterActive: isActive, filterState: fs } };
      }
      return { ...n, data: { ...n.data, filterState: fs, harmonyHighlight: hh } };
    });

    // Compute bundles for high fan-out edges
    const bundles = computeBundles(nodes, edges, bundleConfig);

    const fe = edges.map(e => {
      const fs = edgeStates.get(e.id) ?? 'normal';
      const bundleInfo = bundles.get(e.id);
      return {
        ...e,
        selected: e.id === selectedEdgeId,
        data: { ...e.data, filterState: fs, edgeStyle, smartNodePadding, smartGridRatio, bundleInfo },
      };
    });
    return { filteredNodes: fn, filteredEdges: fe };
  }, [nodes, edges, nodeStates, edgeStates, activeFilterTags, onPlaySong, onHoverPlaySong, toggleFilter, edgeStyle, smartNodePadding, smartGridRatio, bundleConfig, selectedEdgeId, harmonyMap]);

  // Container view: transform flat nodes into grouped nodes when viewMode !== 'free'
  const { viewNodes, viewEdges } = useMemo(() => {
    const containerResult = transformToContainerView(nodes, edges, viewMode);
    if (!containerResult) {
      return { viewNodes: filteredNodes, viewEdges: filteredEdges };
    }

    // Inject callbacks into the pure result
    const vn = containerResult.viewNodes.map(n => {
      if (n.type === 'song') {
        return {
          ...n,
          data: {
            ...n.data,
            onPlayToggle: onPlaySong,
            onHoverPlay: onHoverPlaySong,
          },
        };
      }
      if (n.type === 'tag') {
        return { ...n, data: { ...n.data, onFilterToggle: toggleFilter, isFilterActive: false } };
      }
      return n;
    });

    return { viewNodes: vn, viewEdges: containerResult.viewEdges };
  }, [viewMode, filteredNodes, filteredEdges, nodes, edges, onPlaySong, onHoverPlaySong, toggleFilter]);

  const handleConnect = useCallback(async (connection: Connection) => {
    await createEdge(connection);
  }, [createEdge]);

  const handleConnectStart = useCallback<OnConnectStart>((_event, params) => {
    pendingConnectionRef.current = params.nodeId ? {
      nodeId: params.nodeId,
      handleId: params.handleId,
      handleType: params.handleType,
    } : null;
    connectionCreatedRef.current = false;
  }, []);

  const handleConnectEnd = useCallback<OnConnectEnd>(async (event, connectionState) => {
    const pending = pendingConnectionRef.current;
    pendingConnectionRef.current = null;

    if (!pending) {
      connectionCreatedRef.current = false;
      return;
    }

    if (connectionCreatedRef.current) {
      connectionCreatedRef.current = false;
      return;
    }

    const position = getRelativePosition(event);
    const closestNode = (event.target as HTMLElement | null)?.closest?.('.react-flow__node');
    const domTargetId = closestNode?.getAttribute('data-id');
    const stateTargetId = connectionState.toNode?.id ?? null;
    const targetId = stateTargetId || domTargetId;

    if (!targetId || targetId === pending.nodeId) {
      return;
    }

    await createEdge({
      source: pending.nodeId,
      sourceHandle: pending.handleId ?? undefined,
      target: targetId,
      targetHandle: connectionState.toHandle?.id ?? undefined,
    }, position);
  }, [createEdge, getRelativePosition]);

  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    selectEdge(edge.id, getRelativePosition(event.nativeEvent));
  }, [getRelativePosition, selectEdge]);

  const handleSelectionChange = useCallback<OnSelectionChangeFunc>(({ nodes: selectedNodes, edges: selectedEdges }) => {
    const nextSelectedNodeIds = selectedNodes.map((node) => node.id);
    setSelectedNodeIds(nextSelectedNodeIds);

    if (selectedEdges.length > 0) {
      setSelectedEdgeId(selectedEdges[0].id);
    } else {
      setSelectedEdgeId(null);
      setEditorPosition(null);
    }

    focusCanvas();
  }, [focusCanvas]);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setEditorPosition(null);
  }, []);

  const handleEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    deletedEdges.forEach((edge) => onEdgeDelete(edge.id));
    if (deletedEdges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null);
      setEditorPosition(null);
    }
  }, [onEdgeDelete, selectedEdgeId]);

  const handleCanvasKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const element = event.target as HTMLElement | null;
    const tagName = element?.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      if (!selectedEdgeId && selectedNodeIds.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (selectedEdgeId) {
        onEdgeDelete(selectedEdgeId);
        setSelectedEdgeId(null);
        setEditorPosition(null);
      }

      selectedNodeIds.forEach((nodeId) => onNodeDelete(nodeId));
      setSelectedNodeIds([]);
    }

    if (event.key === 'Escape') {
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setEditorPosition(null);
    }
  }, [onEdgeDelete, onNodeDelete, selectedEdgeId, selectedNodeIds]);

  const connectionLineComponent = useCallback((props: any) => (
    <MoodboardConnectionLine
      {...props}
      edgeStyle={edgeStyle}
      smartNodePadding={smartNodePadding}
      smartGridRatio={smartGridRatio}
    />
  ), [edgeStyle, smartGridRatio, smartNodePadding]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    onNodeDelete(node.id);
  }, [onNodeDelete]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (event.dataTransfer.types.includes('application/x-moodboard-song')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const filePath = event.dataTransfer.getData('application/x-moodboard-song');
    if (!filePath || !onAddSong) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    onAddSong(filePath, position.x, position.y);
  }, [screenToFlowPosition, onAddSong]);

  return (
    <Box
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleCanvasKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={isDragOver ? 'moodboard-canvas-drop-active' : undefined}
      style={{ width: '100%', height: '100%', position: 'relative', outline: 'none' }}
    >
      <ReactFlow
        nodes={viewNodes}
        edges={viewEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onEdgeClick={handleEdgeClick}
        onSelectionChange={handleSelectionChange}
        onEdgesDelete={handleEdgesDelete}
        onPaneClick={handlePaneClick}
        onNodeContextMenu={handleNodeContextMenu}
        connectionLineComponent={connectionLineComponent}
        defaultViewport={viewport}
        onMoveEnd={(_event, vp) => onViewportChange(vp)}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.05}
        maxZoom={4}
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
        edgesFocusable
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
          <Group gap={4} style={{ background: 'rgba(30,30,30,0.95)', padding: '4px 8px', borderRadius: 6, border: '1px solid #373A40' }}>
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
            <Box style={{ width: 1, height: 20, background: '#555', margin: '0 2px' }} />
            <Tooltip label="Edge drawing style">
              <SegmentedControl
                size="xs"
                value={edgeStyle}
                onChange={(v) => setEdgeStyle(v as EdgeStyle)}
                data={EDGE_STYLE_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
                style={{ background: 'rgba(0,0,0,0.3)' }}
              />
            </Tooltip>
          </Group>
        </Panel>

        {/* Edge settings — top-right */}
        <Panel position="top-right">
          <Box style={{ background: 'rgba(30,30,30,0.95)', padding: '8px 12px', borderRadius: 6, border: '1px solid #373A40', minWidth: 190 }}>
            {/* Smart edge settings */}
            {edgeStyle === 'smart' && (<>
              <Text size="xs" fw={600} c="dimmed" mb={4}>Smart Edge</Text>
              <Text size="xs" c="dimmed">Padding: {smartNodePadding}px</Text>
              <Slider size="xs" min={2} max={50} value={smartNodePadding} onChange={setSmartNodePadding}
                color="teal" style={{ marginBottom: 4 }} />
              <Text size="xs" c="dimmed">Grid: {smartGridRatio}</Text>
              <Slider size="xs" min={2} max={25} value={smartGridRatio} onChange={setSmartGridRatio}
                color="teal" style={{ marginBottom: 8 }} />
            </>)}

            {/* Bundle settings */}
            <Text size="xs" fw={600} c="dimmed" mb={4}>Edge Bundling</Text>
            <Switch size="xs" label="Bundle high fan-out" checked={bundleConfig.enabled}
              onChange={(e) => setBundleConfig(prev => ({ ...prev, enabled: e.currentTarget.checked }))}
              style={{ marginBottom: 4 }} />
            {bundleConfig.enabled && (<>
              <Text size="xs" c="dimmed">Threshold: ≥{bundleConfig.threshold} edges</Text>
              <Slider size="xs" min={2} max={20} value={bundleConfig.threshold}
                onChange={(v) => setBundleConfig(prev => ({ ...prev, threshold: v }))}
                color="cyan" style={{ marginBottom: 4 }} />
              <Text size="xs" c="dimmed">Stub spacing: {bundleConfig.stubSpacing}px</Text>
              <Slider size="xs" min={1} max={12} value={bundleConfig.stubSpacing}
                onChange={(v) => setBundleConfig(prev => ({ ...prev, stubSpacing: v }))}
                color="cyan" style={{ marginBottom: 4 }} />
              <Text size="xs" c="dimmed">Spine distance: {bundleConfig.spineDistance}px</Text>
              <Slider size="xs" min={30} max={200} value={bundleConfig.spineDistance}
                onChange={(v) => setBundleConfig(prev => ({ ...prev, spineDistance: v }))}
                color="cyan" />
            </>)}
          </Box>
        </Panel>

        {/* Filter bar — shows when filters are active */}
        {activeFilterTags.size > 0 && (
          <Panel position="bottom-center">
            <Group gap={6} style={{ background: 'rgba(30,30,30,0.95)', padding: '6px 12px', borderRadius: 8, border: '1px solid #373A40' }}>
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

        {/* Empty canvas hint */}
        {nodes.length === 0 && (
          <Panel position="bottom-center">
            <Box className="moodboard-empty-state">
              <IconSearch size={32} opacity={0.4} />
              <Text size="sm" c="dimmed" fw={500}>
                Drag songs from the library to start building your moodboard
              </Text>
              <Text size="xs" c="dimmed">
                Or press Ctrl+K to search and add songs
              </Text>
            </Box>
          </Panel>
        )}

        {/* No connections hint */}
        {nodes.filter(n => n.type === 'song').length >= 2 && edges.length === 0 && (
          <Panel position="bottom-center">
            <Text size="xs" c="dimmed" style={{ background: 'rgba(37,38,43,0.7)', padding: '3px 10px', borderRadius: 4 }}>
              Connect songs by dragging between their handles to discover relationships
            </Text>
          </Panel>
        )}
      </ReactFlow>

      {/* Edge weight editor */}
      {selectedEdge && editorPosition && (
        <EdgeWeightEditor
          edge={selectedEdge}
          position={editorPosition}
          onWeightChange={(id, w) => {
            onEdgeWeightChange(id, w);
          }}
          onTypeChange={onEdgeTypeChange}
          onDelete={(id) => {
            onEdgeDelete(id);
            setSelectedEdgeId(null);
            setEditorPosition(null);
          }}
          onClose={() => {
            setSelectedEdgeId(null);
            setEditorPosition(null);
          }}
        />
      )}
    </Box>
  );
}

