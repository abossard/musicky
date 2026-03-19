import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useNodesState, useEdgesState, type Node, type Edge, type Viewport,
  type OnNodesChange, type OnEdgesChange, type Connection, addEdge,
  MarkerType,
} from '@xyflow/react';
import {
  onLoadMoodboardState, onSaveNodePositions, onSaveViewport,
  onAddSongConnection, onRemoveSongConnection, onUpdateConnectionWeight,
  onAddSongTag, onRemoveSongTag,
  onRemoveCanvasNode, onIsSongOnCanvas,
  onSearchSongs, onGetSongMetadata,
} from '../MoodboardPage.telefunc';
import type { SongNodeData } from '../nodes/SongNode';
import type { TagNodeData, TagCategory } from '../nodes/TagNode';
import type { MoodboardEdgeData, EdgeType } from '../edges/WeightedEdge';
import type { MP3SearchResult } from '../../../database/sqlite/queries/dj-sets';

const CATEGORY_DEFAULT_COLORS: Record<string, string> = {
  genre: 'cyan', phase: 'violet', mood: 'pink', topic: 'orange', custom: 'gray',
};

export type SaveStatus = 'idle' | 'saving' | 'saved';

export function useMoodboardState(currentPlayingPath?: string | null) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedResetTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Load unified moodboard state on mount
  useEffect(() => {
    loadState();
  }, []);

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

  const loadState = async () => {
    setLoading(true);
    try {
      const state = await onLoadMoodboardState();

      // Build sets of what's on canvas for edge filtering
      const canvasSongPaths = new Set(state.songs.map(s => s.filePath));
      const canvasTagIds = new Set(state.tags.map(t => `tag:${t.category}:${t.label}`));

      // Song nodes
      const songNodes: Node[] = state.songs.map(s => ({
        id: `song:${s.filePath}`,
        type: 'song',
        position: { x: s.x, y: s.y },
        data: {
          type: 'song',
          filePath: s.filePath,
          title: s.title || 'Unknown',
          artist: s.artist || 'Unknown Artist',
          artworkUrl: `/artwork/${encodeURIComponent(s.filePath)}`,
          isPlaying: s.filePath === currentPlayingPath,
        } satisfies SongNodeData as any,
      }));

      // Tag nodes
      const tagNodes: Node[] = state.tags.map(t => ({
        id: `tag:${t.category}:${t.label}`,
        type: 'tag',
        position: { x: t.x, y: t.y },
        data: {
          type: 'tag',
          label: t.label,
          category: t.category as TagCategory,
          color: CATEGORY_DEFAULT_COLORS[t.category] || 'gray',
          songCount: 0,
        } satisfies TagNodeData as any,
      }));

      // Song↔Song connection edges (only where both songs are on canvas)
      const connectionEdges: Edge[] = state.connections
        .filter(c => canvasSongPaths.has(c.sourcePath) && canvasSongPaths.has(c.targetPath))
        .map(c => ({
          id: `conn:${c.id}`,
          source: `song:${c.sourcePath}`,
          target: `song:${c.targetPath}`,
          type: 'weighted',
          data: {
            edgeType: c.type as EdgeType,
            weight: c.weight,
            directed: true,
          } satisfies MoodboardEdgeData as any,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#40c057' },
        }));

      // Song↔Tag edges: for each song on canvas, for each of its tags that also has a canvas position
      const tagEdges: Edge[] = [];
      for (const s of state.songs) {
        for (const tag of s.tags) {
          const tagId = `tag:${tag.category}:${tag.label}`;
          if (canvasTagIds.has(tagId)) {
            tagEdges.push({
              id: `tag-edge:${s.filePath}:${tag.category}:${tag.label}`,
              source: `song:${s.filePath}`,
              target: tagId,
              type: 'weighted',
              data: {
                edgeType: tag.category as EdgeType,
                weight: 1,
                directed: false,
              } satisfies MoodboardEdgeData as any,
            });
          }
        }
      }

      // Update tag songCounts based on edges
      const tagCounts = new Map<string, number>();
      for (const e of tagEdges) {
        tagCounts.set(e.target, (tagCounts.get(e.target) || 0) + 1);
      }
      for (const tn of tagNodes) {
        const count = tagCounts.get(tn.id);
        if (count) {
          (tn.data as Record<string, unknown>).songCount = count;
        }
      }

      setNodes([...songNodes, ...tagNodes]);
      setEdges([...connectionEdges, ...tagEdges]);
      setViewport(state.viewport);
    } finally {
      setLoading(false);
    }
  };

  const markSaved = useCallback(() => {
    setSaveStatus('saved');
    clearTimeout(savedResetTimeout.current);
    savedResetTimeout.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, []);

  const performSave = useCallback((vp?: Viewport) => {
    setSaveStatus('saving');
    setNodes(currentNodes => {
      const positions = currentNodes.map(n => ({ nodeId: n.id, x: n.position.x, y: n.position.y }));
      Promise.all([
        onSaveNodePositions(positions),
        onSaveViewport(vp || viewport),
      ]).then(() => markSaved()).catch(console.error);
      return currentNodes;
    });
  }, [viewport, markSaved]);

  // Debounced save — positions + viewport
  const scheduleSave = useCallback((vp?: Viewport) => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => performSave(vp), 2000);
  }, [performSave]);

  // Immediate save for manual trigger (Ctrl+S)
  const saveNow = useCallback(() => {
    clearTimeout(saveTimeout.current);
    performSave();
  }, [performSave]);

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
    const nodeId = `song:${songPath}`;

    // Save position to DB
    await onSaveNodePositions([{ nodeId, x: posX, y: posY }]);

    // Get metadata from cache
    const meta = await onGetSongMetadata(songPath);
    const newNode: Node = {
      id: nodeId,
      type: 'song',
      position: { x: posX, y: posY },
      data: {
        type: 'song',
        filePath: songPath,
        title: meta?.title || 'Unknown',
        artist: meta?.artist || 'Unknown Artist',
        artworkUrl: `/artwork/${encodeURIComponent(songPath)}`,
        isPlaying: false,
      } satisfies SongNodeData as any,
    };
    setNodes(nds => [...nds, newNode]);
    return null; // success
  };

  const addTag = async (label: string, category: TagCategory, color: string, posX: number, posY: number) => {
    const nodeId = `tag:${category}:${label}`;

    // Save position to DB
    await onSaveNodePositions([{ nodeId, x: posX, y: posY }]);

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
    await onRemoveCanvasNode(nodeId);
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
  };

  const connectNodes = async (connection: Connection, edgeType: EdgeType = 'custom', weight: number = 0.7): Promise<Edge | null> => {
    if (!connection.source || !connection.target) return null;

    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    if (!sourceNode || !targetNode) return null;

    const sourceIsSong = sourceNode.type === 'song';
    const targetIsSong = targetNode.type === 'song';

    let edgeId: string;

    if (sourceIsSong && targetIsSong) {
      // Song↔Song connection
      const sourcePath = (sourceNode.data as unknown as SongNodeData).filePath;
      const targetPath = (targetNode.data as unknown as SongNodeData).filePath;
      await onAddSongConnection(sourcePath, targetPath, edgeType, weight);
      edgeId = `conn:new:${sourcePath}:${targetPath}:${edgeType}`;
    } else if (sourceIsSong && targetNode.type === 'tag') {
      // Song↔Tag
      const sourcePath = (sourceNode.data as unknown as SongNodeData).filePath;
      const tagData = targetNode.data as unknown as TagNodeData;
      await onAddSongTag(sourcePath, tagData.label, tagData.category);
      edgeId = `tag-edge:${sourcePath}:${tagData.category}:${tagData.label}`;
    } else if (targetIsSong && sourceNode.type === 'tag') {
      // Tag↔Song (reverse)
      const targetPath = (targetNode.data as unknown as SongNodeData).filePath;
      const tagData = sourceNode.data as unknown as TagNodeData;
      await onAddSongTag(targetPath, tagData.label, tagData.category);
      edgeId = `tag-edge:${targetPath}:${tagData.category}:${tagData.label}`;
    } else {
      // Tag↔Tag — just a visual edge, no DB operation
      edgeId = `visual:${connection.source}:${connection.target}`;
    }

    const directed = sourceIsSong && targetIsSong;
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
    const edge = edges.find(e => e.id === edgeId);
    if (edge) {
      if (edgeId.startsWith('conn:')) {
        // Song↔Song connection — remove by source/target paths
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        if (sourceNode && targetNode) {
          const sourcePath = (sourceNode.data as unknown as SongNodeData).filePath;
          const targetPath = (targetNode.data as unknown as SongNodeData).filePath;
          const connType = (edge.data as unknown as MoodboardEdgeData).edgeType;
          await onRemoveSongConnection(sourcePath, targetPath, connType);
        }
      } else if (edgeId.startsWith('tag-edge:')) {
        // Song↔Tag edge — parse: tag-edge:<filePath>:<category>:<label>
        const rest = edgeId.slice('tag-edge:'.length);
        const lastColon = rest.lastIndexOf(':');
        if (lastColon > 0) {
          const label = rest.slice(lastColon + 1);
          const beforeLabel = rest.slice(0, lastColon);
          const secondLastColon = beforeLabel.lastIndexOf(':');
          if (secondLastColon > 0) {
            const filePath = beforeLabel.slice(0, secondLastColon);
            const category = beforeLabel.slice(secondLastColon + 1);
            await onRemoveSongTag(filePath, label, category);
          }
        }
      }
    }
    setEdges(eds => eds.filter(e => e.id !== edgeId));
  };

  const setEdgeWeight = async (edgeId: string, weight: number) => {
    if (edgeId.startsWith('conn:')) {
      const idPart = edgeId.slice('conn:'.length);
      const connId = parseInt(idPart, 10);
      if (!isNaN(connId)) {
        await onUpdateConnectionWeight(connId, weight);
      }
    }
    setEdges(eds => eds.map(e =>
      e.id === edgeId ? { ...e, data: { ...e.data, weight } } : e
    ));
  };

  const setEdgeType = async (edgeId: string, _edgeType: EdgeType) => {
    // Edge type changes are local-only in the new API
    setEdges(eds => eds.map(e =>
      e.id === edgeId ? { ...e, data: { ...e.data, edgeType: _edgeType } } : e
    ));
  };

  const checkSongOnBoard = async (songPath: string): Promise<boolean> => {
    return onIsSongOnCanvas(songPath);
  };

  const searchSongsForBoard = async (query: string): Promise<MP3SearchResult[]> => {
    const results = await onSearchSongs(query);
    return results.map(r => ({
      file_path: r.filePath,
      filename: r.filePath.split('/').pop() ?? r.filePath,
      title: r.title || undefined,
      artist: r.artist || undefined,
      album: r.album || undefined,
      duration: r.duration || undefined,
    }));
  };

  return {
    nodes, edges, viewport, loading, saveStatus,
    onNodesChange: handleNodesChange,
    onEdgesChange,
    onViewportChange: handleViewportChange,
    addSong, addTag, removeNode, connectNodes, removeEdge, setEdgeWeight, setEdgeType,
    checkSongOnBoard, searchSongs: searchSongsForBoard, setNodes, saveNow,
  };
}
