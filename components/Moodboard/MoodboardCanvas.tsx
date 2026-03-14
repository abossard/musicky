import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, MiniMap, Controls, Background, BackgroundVariant,
  type Node, type Edge, type Connection, type NodeTypes, type EdgeTypes,
  type OnNodesChange, type OnEdgesChange, type Viewport, useReactFlow,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, ActionIcon, Group, Tooltip, Text, Slider, Select, Stack, CloseButton } from '@mantine/core';
import { IconTrash, IconPlus, IconSearch } from '@tabler/icons-react';
import SongNode, { type SongNodeData } from './nodes/SongNode';
import TagNode from './nodes/TagNode';
import WeightedEdge, { type EdgeType, type MoodboardEdgeData } from './edges/WeightedEdge';
import type { TagCategory } from './nodes/TagNode';

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
  onSearchOpen, onAddTag, onPlaySong,
}: MoodboardCanvasProps) {
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [edgeTypePickerPos, setEdgeTypePickerPos] = useState<{ x: number; y: number } | null>(null);

  const processedNodes = useMemo(() => injectCallbacks(nodes, onPlaySong), [nodes, onPlaySong]);

  const handleConnect = useCallback((connection: Connection) => {
    setPendingConnection(connection);
    setEdgeTypePickerPos({ x: 200, y: 80 });
  }, []);

  const confirmConnection = useCallback((edgeType: EdgeType) => {
    if (pendingConnection) {
      onConnect(pendingConnection, edgeType, 0.7);
    }
    setPendingConnection(null);
    setEdgeTypePickerPos(null);
  }, [pendingConnection, onConnect]);

  const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedEdge(null);
    setPendingConnection(null);
    setEdgeTypePickerPos(null);
  }, []);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    onNodeDelete(node.id);
  }, [onNodeDelete]);

  return (
    <Box style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={processedNodes}
        edges={edges}
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
        fitView={nodes.length > 0}
        minZoom={0.1}
        maxZoom={4}
        snapToGrid
        snapGrid={[15, 15]}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        panOnScroll
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
          <Group gap="xs" style={{ background: '#25262b', padding: '8px 12px', borderRadius: 8, border: '1px solid #373A40' }}>
            <Tooltip label="Add song (Ctrl+K)">
              <ActionIcon variant="light" color="violet" onClick={onSearchOpen} aria-label="Search songs">
                <IconSearch size={18} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Add genre tag">
              <ActionIcon variant="light" color="cyan" onClick={() => onAddTag('Genre', 'genre', 'cyan', 0, 0)} aria-label="Add tag">
                <IconPlus size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Panel>
      </ReactFlow>

      {/* Edge type picker */}
      {edgeTypePickerPos && (
        <Box style={{
          position: 'absolute', top: edgeTypePickerPos.y, left: edgeTypePickerPos.x,
          background: '#25262b', border: '1px solid #373A40', borderRadius: 8,
          padding: 8, zIndex: 100,
        }}>
          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={600}>Connection type:</Text>
            {(['genre', 'phase', 'mood', 'similarity', 'topic', 'custom'] as EdgeType[]).map(t => (
              <ActionIcon key={t} variant="light" color={
                t === 'genre' ? 'cyan' : t === 'phase' ? 'violet' : t === 'mood' ? 'pink' :
                t === 'similarity' ? 'green' : t === 'topic' ? 'orange' : 'gray'
              } size="sm" onClick={() => confirmConnection(t)} style={{ width: '100%', justifyContent: 'flex-start', padding: '4px 8px' }}>
                <Text size="xs" tt="capitalize">{t}</Text>
              </ActionIcon>
            ))}
            <CloseButton size="xs" onClick={() => { setPendingConnection(null); setEdgeTypePickerPos(null); }} />
          </Stack>
        </Box>
      )}

      {/* Edge weight editor */}
      {selectedEdge && (
        <Box style={{
          position: 'absolute', bottom: 80, right: 16,
          background: '#25262b', border: '1px solid #373A40', borderRadius: 8,
          padding: 12, zIndex: 100, width: 220,
        }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600}>Connection</Text>
            <CloseButton size="xs" onClick={() => setSelectedEdge(null)} />
          </Group>
          <Text size="xs" c="dimmed" mb={4}>Weight: {Math.round(((selectedEdge.data as any)?.weight ?? 1) * 100)}%</Text>
          <Slider
            min={0} max={1} step={0.05}
            value={(selectedEdge.data as any)?.weight ?? 1}
            onChange={(val) => {
              onEdgeWeightChange(selectedEdge.id, val);
              setSelectedEdge(prev => prev ? { ...prev, data: { ...prev.data, weight: val } } : null);
            }}
            color="violet"
            mb="xs"
          />
          <Group gap="xs">
            <ActionIcon variant="light" color="red" size="sm" onClick={() => {
              onEdgeDelete(selectedEdge.id);
              setSelectedEdge(null);
            }}>
              <IconTrash size={14} />
            </ActionIcon>
            <Text size="xs" c="dimmed" tt="capitalize">{(selectedEdge.data as any)?.edgeType || 'custom'}</Text>
          </Group>
        </Box>
      )}
    </Box>
  );
}
