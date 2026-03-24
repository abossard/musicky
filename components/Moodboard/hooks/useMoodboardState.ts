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
  onSearchSongs, onGetSongMetadata, onGetSongTags,
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
          camelotKey: s.camelotKey,
          bpm: s.bpm,
          energyLevel: s.energyLevel,
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

    // Save song position to DB, fetch metadata + tags in parallel
    const [, meta, tags] = await Promise.all([
      onSaveNodePositions([{ nodeId, x: posX, y: posY }]),
      onGetSongMetadata(songPath),
      onGetSongTags(songPath),
    ]);

    const newSongNode: Node = {
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
        camelotKey: meta?.camelotKey,
        bpm: meta?.bpm,
        energyLevel: meta?.energyLevel,
      } satisfies SongNodeData as any,
    };

    if (tags.length === 0) {
      setNodes(nds => [...nds, newSongNode]);
      return null;
    }

    // Build candidate tag nodes positioned in a circle around the song
    const angleStep = (2 * Math.PI) / tags.length;
    const radius = 200;
    const tagNodeCandidates: Node[] = tags.map((tag, i) => ({
      id: `tag:${tag.category}:${tag.label}`,
      type: 'tag' as const,
      position: {
        x: posX + radius * Math.cos(angleStep * i),
        y: posY + radius * Math.sin(angleStep * i),
      },
      data: {
        type: 'tag',
        label: tag.label,
        category: tag.category as TagCategory,
        color: CATEGORY_DEFAULT_COLORS[tag.category] || 'gray',
        songCount: 1,
      } satisfies TagNodeData as any,
    }));

    // Add song node + only new tag nodes (skip tags already on canvas)
    let newTagPositions: { nodeId: string; x: number; y: number }[] = [];
    setNodes(currentNodes => {
      const existingIds = new Set(currentNodes.map(n => n.id));
      const newTags = tagNodeCandidates.filter(n => !existingIds.has(n.id));
      newTagPositions = newTags.map(n => ({ nodeId: n.id, x: n.position.x, y: n.position.y }));
      return [...currentNodes, newSongNode, ...newTags];
    });

    // Create edges from song to each tag (both existing and new tag nodes)
    const newEdges: Edge[] = tags.map(tag => ({
      id: `tag-edge:${songPath}:${tag.category}:${tag.label}`,
      source: nodeId,
      target: `tag:${tag.category}:${tag.label}`,
      type: 'weighted',
      data: {
        edgeType: tag.category as EdgeType,
        weight: 1,
        directed: false,
      } satisfies MoodboardEdgeData as any,
    }));
    setEdges(eds => {
      let updated = eds;
      for (const edge of newEdges) {
        updated = addEdge(edge, updated);
      }
      return updated;
    });

    // Persist new tag node positions (fire-and-forget)
    if (newTagPositions.length > 0) {
      onSaveNodePositions(newTagPositions).catch(console.error);
    }

    return null;
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

  const mergeTags = useCallback(async (keepNodeId: string, removeNodeId: string) => {
    const keepNode = nodes.find(n => n.id === keepNodeId);
    const removeNode_ = nodes.find(n => n.id === removeNodeId);
    if (!keepNode || !removeNode_ || keepNode.type !== 'tag' || removeNode_.type !== 'tag') return;

    const keepData = keepNode.data as unknown as TagNodeData;
    const removeData = removeNode_.data as unknown as TagNodeData;
    if (keepData.category !== removeData.category) return;

    const edgesToTransfer = edges.filter(
      e => e.source === removeNodeId || e.target === removeNodeId,
    );

    const newEdges: Edge[] = [];
    for (const edge of edgesToTransfer) {
      const newSource = edge.source === removeNodeId ? keepNodeId : edge.source;
      const newTarget = edge.target === removeNodeId ? keepNodeId : edge.target;

      if (newSource === newTarget) continue;
      const exists = edges.some(
        e => (e.source === newSource && e.target === newTarget) ||
             (e.source === newTarget && e.target === newSource),
      );
      if (exists) continue;

      // Persist tag-edge transfers to DB
      if (edge.id.startsWith('tag-edge:')) {
        const songNodeId = edge.source === removeNodeId ? edge.target : edge.source;
        const songNode = nodes.find(n => n.id === songNodeId);
        if (songNode?.type === 'song') {
          const filePath = (songNode.data as unknown as SongNodeData).filePath;
          await onAddSongTag(filePath, keepData.label, keepData.category);
        }
      }

      const newEdgeId = edge.id.startsWith('tag-edge:')
        ? edge.id.replace(
            `${removeData.category}:${removeData.label}`,
            `${keepData.category}:${keepData.label}`,
          )
        : `visual:${newSource}:${newTarget}`;
      newEdges.push({ ...edge, id: newEdgeId, source: newSource, target: newTarget });
    }

    // Remove old tag associations from DB
    for (const edge of edgesToTransfer) {
      if (edge.id.startsWith('tag-edge:')) {
        const songNodeId = edge.source === removeNodeId ? edge.target : edge.source;
        const songNode = nodes.find(n => n.id === songNodeId);
        if (songNode?.type === 'song') {
          const filePath = (songNode.data as unknown as SongNodeData).filePath;
          await onRemoveSongTag(filePath, removeData.label, removeData.category);
        }
      }
    }

    // Update React state: add new edges, remove old edges, remove the node
    setEdges(eds => [
      ...eds.filter(e => e.source !== removeNodeId && e.target !== removeNodeId),
      ...newEdges,
    ]);
    setNodes(nds => nds.filter(n => n.id !== removeNodeId));

    // Remove the merged node from canvas DB
    await onRemoveCanvasNode(removeNodeId);
  }, [nodes, edges, setEdges, setNodes]);

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
    addSong, addTag, removeNode, connectNodes, removeEdge, setEdgeWeight, setEdgeType, mergeTags,
    checkSongOnBoard, searchSongs: searchSongsForBoard, setNodes, saveNow,
    reload: loadState,
  };
}
