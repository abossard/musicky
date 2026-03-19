import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useNodesState, useEdgesState, type Node, type Edge, type Viewport,
  type OnNodesChange, type OnEdgesChange, type Connection, addEdge,
  MarkerType,
} from '@xyflow/react';
import {
  onLoadBoard, onSaveBoard, onAddSongNode, onAddTagNode,
  onDeleteNode, onAddEdge, onDeleteEdge, onUpdateEdgeWeight,
  onSearchSongs, onIsSongOnBoard, onGetSongMetadata,
  type BoardState,
} from '../Moodboard.telefunc';
import type { SongNodeData } from '../nodes/SongNode';
import type { TagNodeData, TagCategory } from '../nodes/TagNode';
import type { MoodboardEdgeData, EdgeType } from '../edges/WeightedEdge';

export function useMoodboardState(boardId: number | null, currentPlayingPath?: string | null) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [loading, setLoading] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;

  // Load board
  useEffect(() => {
    if (!boardId) { setNodes([]); setEdges([]); return; }
    loadBoard(boardId);
  }, [boardId]);

  // Update isPlaying on song nodes when currentPlayingPath changes
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      if (n.type !== 'song') return n;
      const songData = n.data as unknown as SongNodeData;
      const isPlaying = songData.filePath === currentPlayingPath;
      if (songData.isPlaying === isPlaying) return n;
      return { ...n, data: { ...n.data, isPlaying } };
    }));
  }, [currentPlayingPath]);

  const loadBoard = async (id: number) => {
    setLoading(true);
    try {
      const state = await onLoadBoard(id);
      if (!state) return;

      const loadedNodes: Node[] = await Promise.all(state.nodes.map(async (row) => {
        if (row.node_type === 'song' && row.song_path) {
          const meta = await onGetSongMetadata(row.song_path);
          return {
            id: row.id,
            type: 'song',
            position: { x: row.position_x, y: row.position_y },
            data: {
              type: 'song',
              filePath: row.song_path,
              title: meta?.title || meta?.filename || 'Unknown',
              artist: meta?.artist || 'Unknown Artist',
              album: meta?.album || undefined,
              duration: meta?.duration || undefined,
              artworkUrl: `/artwork/${encodeURIComponent(row.song_path)}`,
              isPlaying: row.song_path === currentPlayingPath,
            } satisfies SongNodeData as any,
          };
        }
        // Tag node
        const connectedSongs = state.edges.filter(
          e => e.source_node_id === row.id || e.target_node_id === row.id
        ).length;
        return {
          id: row.id,
          type: 'tag',
          position: { x: row.position_x, y: row.position_y },
          data: {
            type: 'tag',
            label: row.tag_label || 'Tag',
            category: (row.tag_category || 'custom') as TagCategory,
            color: row.tag_color || 'gray',
            songCount: connectedSongs,
          } satisfies TagNodeData as any,
        };
      }));

      const loadedEdges: Edge[] = state.edges.map(row => {
        // Check if both source and target are song nodes
        const sourceIsSong = state.nodes.find(n => n.id === row.source_node_id)?.node_type === 'song';
        const targetIsSong = state.nodes.find(n => n.id === row.target_node_id)?.node_type === 'song';
        const directed = sourceIsSong && targetIsSong;
        return {
          id: row.id,
          source: row.source_node_id,
          target: row.target_node_id,
          type: 'weighted',
          data: {
            edgeType: row.edge_type as EdgeType,
            weight: row.weight,
            directed,
          } satisfies MoodboardEdgeData as any,
          ...(directed ? { markerEnd: { type: MarkerType.ArrowClosed, color: '#40c057' } } : {}),
        };
      });

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      if (state.board.viewport_json) {
        try { setViewport(JSON.parse(state.board.viewport_json)); } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  // Debounced save — positions + viewport
  const scheduleSave = useCallback((vp?: Viewport) => {
    if (!boardIdRef.current) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const bid = boardIdRef.current;
      if (!bid) return;
      setNodes(currentNodes => {
        const positions = currentNodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y }));
        onSaveBoard(bid, positions, JSON.stringify(vp || viewport)).catch(console.error);
        return currentNodes;
      });
    }, 2000);
  }, [viewport]);

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    if (changes.some(c => c.type === 'position' && (c as any).dragging === false)) {
      scheduleSave();
    }
  }, [onNodesChange, scheduleSave]);

  const handleViewportChange = useCallback((vp: Viewport) => {
    setViewport(vp);
    scheduleSave(vp);
  }, [scheduleSave]);

  // --- Actions ---

  const addSong = async (songPath: string, posX: number, posY: number) => {
    if (!boardIdRef.current) return null;
    const result = await onAddSongNode(boardIdRef.current, songPath, posX, posY);
    if (!result.success || !result.nodeId) return result.error || 'Failed';

    const meta = await onGetSongMetadata(songPath);
    const newNode: Node = {
      id: result.nodeId,
      type: 'song',
      position: { x: posX, y: posY },
      data: {
        type: 'song',
        filePath: songPath,
        title: meta?.title || meta?.filename || 'Unknown',
        artist: meta?.artist || 'Unknown Artist',
        album: meta?.album || undefined,
        artworkUrl: `/artwork/${encodeURIComponent(songPath)}`,
        isPlaying: false,
      } satisfies SongNodeData as any,
    };
    setNodes(nds => [...nds, newNode]);
    scheduleSave();
    return null; // success
  };

  const addTag = async (label: string, category: TagCategory, color: string, posX: number, posY: number) => {
    if (!boardIdRef.current) return;
    const nodeId = await onAddTagNode(boardIdRef.current, label, category, color, posX, posY);
    const newNode: Node = {
      id: nodeId,
      type: 'tag',
      position: { x: posX, y: posY },
      data: {
        type: 'tag', label, category, color, songCount: 0,
      } satisfies TagNodeData as any,
    };
    setNodes(nds => [...nds, newNode]);
  };

  const removeNode = async (nodeId: string) => {
    await onDeleteNode(nodeId);
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
  };

  const connectNodes = async (connection: Connection, edgeType: EdgeType = 'custom', weight: number = 0.7): Promise<Edge | null> => {
    if (!boardIdRef.current || !connection.source || !connection.target) return null;
    const edgeId = await onAddEdge(boardIdRef.current, connection.source, connection.target, edgeType, weight);

    // Song→song edges are directed (flow direction)
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    const directed = sourceNode?.type === 'song' && targetNode?.type === 'song';

    const newEdge: Edge = {
      id: edgeId,
      source: connection.source,
      target: connection.target,
      type: 'weighted',
      data: { edgeType, weight, directed } satisfies MoodboardEdgeData as any,
      ...(directed ? { markerEnd: { type: MarkerType.ArrowClosed, color: '#40c057' } } : {}),
    };
    setEdges(eds => addEdge(newEdge, eds));
    return newEdge;
  };

  const removeEdge = async (edgeId: string) => {
    await onDeleteEdge(edgeId);
    setEdges(eds => eds.filter(e => e.id !== edgeId));
  };

  const setEdgeWeight = async (edgeId: string, weight: number) => {
    await onUpdateEdgeWeight(edgeId, weight);
    setEdges(eds => eds.map(e =>
      e.id === edgeId ? { ...e, data: { ...e.data, weight } } : e
    ));
  };

  const checkSongOnBoard = async (songPath: string): Promise<boolean> => {
    if (!boardIdRef.current) return false;
    return onIsSongOnBoard(boardIdRef.current, songPath);
  };

  const searchSongs = async (query: string) => {
    return onSearchSongs(query);
  };

  return {
    nodes, edges, viewport, loading,
    onNodesChange: handleNodesChange,
    onEdgesChange,
    onViewportChange: handleViewportChange,
    addSong, addTag, removeNode, connectNodes, removeEdge, setEdgeWeight,
    checkSongOnBoard, searchSongs, setNodes,
  };
}
