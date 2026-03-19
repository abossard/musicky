/**
 * Consolidated Telefunc API for the Moodboard page.
 * Provides RPC functions for library scanning, tags, connections,
 * phase flow, playlist generation, canvas state, and discovery.
 */

// --- Database queries ---
import { saveBaseFolder, readBaseFolder } from '../../database/sqlite/queries/library-settings';
import {
  addSongTag, removeSongTag, getTagsForSong, getAllTags, searchTags, bulkSetSongTags,
  type TagCategory, type SongTag, type TagCount,
} from '../../database/sqlite/queries/song-tags';
import {
  addSongConnection as dbAddConnection,
  removeSongConnectionByPaths, updateConnectionWeight as dbUpdateWeight,
  getConnectionsForSong, getAllConnections, bulkAddConnections,
  type SongConnection, type ConnectionType, type ConnectionSource,
} from '../../database/sqlite/queries/song-connections';
import {
  getPhaseEdges as dbGetPhaseEdges, addPhaseEdge as dbAddPhaseEdge,
  removePhaseEdge as dbRemovePhaseEdge, getAllPhases,
  wouldCreateCycle as dbWouldCreateCycle,
} from '../../database/sqlite/queries/phase-edges';
import {
  createPlaylist, getPlaylists as dbGetPlaylists, getPlaylistWithItems as dbGetPlaylistWithItems,
  deletePlaylist as dbDeletePlaylist, setPlaylistItems,
} from '../../database/sqlite/queries/playlists';
import {
  getAllNodePositions, bulkUpdatePositions as dbBulkUpdatePositions,
  getCanvasState, setViewport as dbSetViewport, setViewMode as dbSetViewMode,
  getViewport, getViewMode, songNodeId, tagNodeId, parseSongNodeId,
} from '../../database/sqlite/queries/canvas-state';
import {
  insertMP3Cache, searchMP3Cache, getMP3CacheByPath, deleteMP3Cache,
  type MP3CacheItem, type MP3SearchResult,
} from '../../database/sqlite/queries/dj-sets';

// --- Domain engines ---
import {
  buildSongGraph, findSimilarSongs, discoverHiddenConnections,
  type SongNode, type SongEdge,
} from '../../lib/graph-engine';
import {
  getPhaseOrder as computePhaseOrder, suggestDefaultFlow,
  type PhaseEdge as PhaseEdgeDomain,
} from '../../lib/phase-graph';
import {
  generatePlaylist, type PlaylistOptions, type GeneratedPlaylist,
} from '../../lib/playlist-generator';
import {
  scanFolder, resolveAllConnections,
} from '../../lib/scan-engine';
import { MP3MetadataManager, type MusickTagData, MUSICK_TAG_PREFIX } from '../../lib/mp3-metadata';
import {
  addTagEdit,
  clearPendingTagEditsByDirection,
} from '../../database/sqlite/queries/mp3-tag-edits';

// Shared metadata manager instance
const mp3Manager = new MP3MetadataManager();

// ============================================================================
// Response types
// ============================================================================

interface LibrarySong {
  filePath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  fileSize: number;
  artworkUrl: string | null;
}

interface SongTagInfo {
  id: number;
  label: string;
  category: string;
  source: string;
}

interface TagInfo {
  label: string;
  category: string;
  count: number;
}

interface ConnectionInfo {
  id: number;
  otherPath: string;
  otherTitle: string;
  otherArtist: string;
  type: string;
  weight: number;
  direction: 'outgoing' | 'incoming';
}

interface SimilarSong {
  filePath: string;
  title: string;
  artist: string;
  score: number;
}

interface PhaseEdgeInfo {
  id: number;
  fromPhase: string;
  toPhase: string;
  weight: number;
}

interface PlaylistInfo {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
}

interface PlaylistWithItems {
  id: number;
  name: string;
  description: string | null;
  items: { filePath: string; position: number; phase: string | null; title: string; artist: string }[];
}

interface MoodboardState {
  songs: { filePath: string; title: string; artist: string; x: number; y: number; tags: SongTagInfo[] }[];
  connections: { sourcePath: string; targetPath: string; type: string; weight: number }[];
  positions: { nodeId: string; x: number; y: number }[];
  tags: { label: string; category: string; x: number; y: number }[];
  viewport: { x: number; y: number; zoom: number };
  viewMode: string;
  phaseEdges: PhaseEdgeInfo[];
  phaseOrder: string[];
}

interface GeneratedPlaylistResult {
  entries: { filePath: string; title: string; artist: string; phase: string | null; position: number; reason: string }[];
  phases: string[];
  stats: { totalSongs: number; phaseCounts: Record<string, number>; untaggedCount: number; clusterCount: number };
}

interface SongMetadata {
  filePath: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre: string[];
  artworkDataUrl: string | null;
}

interface DiscoveredConnection {
  sourcePath: string;
  sourceTitle: string;
  targetPath: string;
  targetTitle: string;
  type: string;
  sharedTags: string[];
}

// ============================================================================
// Helpers
// ============================================================================

function artworkUrl(filePath: string): string {
  return `/artwork/${encodeURIComponent(filePath)}`;
}

function cacheToLibrarySong(c: MP3CacheItem): LibrarySong {
  return {
    filePath: c.file_path,
    title: c.title ?? '',
    artist: c.artist ?? '',
    album: c.album ?? '',
    duration: c.duration ?? 0,
    fileSize: c.file_size ?? 0,
    artworkUrl: artworkUrl(c.file_path),
  };
}

function songTagToInfo(t: SongTag): SongTagInfo {
  return { id: t.id, label: t.tag_label, category: t.tag_category, source: t.source };
}

function tagCountToInfo(t: TagCount): TagInfo {
  return { label: t.tag_label, category: t.tag_category, count: t.count };
}

function dbPhaseEdgeToInfo(e: { id: number; from_phase: string; to_phase: string; weight: number }): PhaseEdgeInfo {
  return { id: e.id, fromPhase: e.from_phase, toPhase: e.to_phase, weight: e.weight };
}

/** Build SongNode[] + SongEdge[] from database for graph operations */
function buildGraphDataFromDB(): { songs: SongNode[]; connections: SongEdge[] } {
  const allConnections = getAllConnections();
  const songPaths = new Set<string>();
  for (const c of allConnections) {
    songPaths.add(c.source_path);
    songPaths.add(c.target_path);
  }

  // Also include all songs from the cache with tags
  const allTags = getAllTags();
  for (const _t of allTags) {
    // We need all songs that have tags — gather from song_tags
  }

  // Build nodes from cache + tags
  const nodeMap = new Map<string, SongNode>();
  for (const fp of songPaths) {
    const cached = getMP3CacheByPath(fp);
    const tags = getTagsForSong(fp);
    nodeMap.set(fp, {
      filePath: fp,
      title: cached?.title,
      artist: cached?.artist,
      tags: tags.map(t => ({ label: t.tag_label, category: t.tag_category as SongNode['tags'][0]['category'] })),
    });
  }

  // Also add nodes that have tags but no connections
  const allTagRows = getAllTags();
  // We need a different approach: get all songs that have at least one tag
  // We'll rely on the cache for the full library
  // For now, songPaths from connections is sufficient; onLoadMoodboardState also adds from positions

  const edges: SongEdge[] = allConnections.map(c => ({
    sourceFilePath: c.source_path,
    targetFilePath: c.target_path,
    type: c.connection_type,
    weight: c.weight,
  }));

  return { songs: Array.from(nodeMap.values()), connections: edges };
}

// ============================================================================
// Library & Scanning
// ============================================================================

export async function onGetBaseFolder(): Promise<string | null> {
  return readBaseFolder();
}

export async function onSetBaseFolder(path: string): Promise<void> {
  saveBaseFolder(path);
}

export async function onScanLibrary(): Promise<{
  totalFiles: number;
  newFiles: number;
  updatedFiles: number;
  removedFiles: number;
  tagsDiscovered: number;
  connectionsDiscovered: number;
  importSuggestions: number;
  errors: { filePath: string; error: string }[];
}> {
  const base = readBaseFolder();
  if (!base) throw new Error('Base folder not set');

  // 1. Scan all MP3 files
  const { songs, errors } = await scanFolder(base, mp3Manager);

  let newFiles = 0;
  let updatedFiles = 0;
  let tagsDiscovered = 0;

  // 2. Update mp3_file_cache and song_tags for each song
  for (const song of songs) {
    const existing = getMP3CacheByPath(song.filePath);
    const filename = song.filePath.split('/').pop() ?? song.filePath;
    const stat = await import('fs').then(fs => {
      try {
        const s = fs.statSync(song.filePath);
        return { size: s.size, mtime: s.mtime.toISOString() };
      } catch {
        return { size: 0, mtime: new Date().toISOString() };
      }
    });

    insertMP3Cache({
      file_path: song.filePath,
      filename,
      artist: song.artist,
      title: song.title,
      album: song.album,
      duration: song.duration,
      file_size: stat.size,
      last_modified: stat.mtime,
    });

    if (!existing) {
      newFiles++;
    } else {
      updatedFiles++;
    }

    // Set tags from scan
    if (song.tags.length > 0) {
      bulkSetSongTags(song.filePath, song.tags.map(t => ({
        label: t.label,
        category: t.category as TagCategory,
        source: 'id3_import' as const,
      })));
      tagsDiscovered += song.tags.length;
    }
  }

  // 3. Resolve related-song references into file-path connections
  const resolvedConnections = resolveAllConnections(songs);
  if (resolvedConnections.length > 0) {
    bulkAddConnections(resolvedConnections.map(c => ({
      sourcePath: c.sourcePath,
      targetPath: c.targetPath,
      type: c.type as ConnectionType,
      weight: c.weight,
      source: 'id3_import' as ConnectionSource,
    })));
  }

  // 4. Discover hidden connections (shared-tag edges)
  const songNodes: SongNode[] = songs.map(s => ({
    filePath: s.filePath,
    title: s.title,
    artist: s.artist,
    tags: s.tags,
  }));
  const existingEdges: SongEdge[] = resolvedConnections.map(c => ({
    sourceFilePath: c.sourcePath,
    targetFilePath: c.targetPath,
    type: c.type,
    weight: c.weight,
  }));
  const discovered = discoverHiddenConnections(songNodes, existingEdges);
  if (discovered.length > 0) {
    bulkAddConnections(discovered.map(e => ({
      sourcePath: e.sourceFilePath,
      targetPath: e.targetFilePath,
      type: e.type as ConnectionType,
      weight: e.weight,
      source: 'auto_discovered' as ConnectionSource,
    })));
  }

  // 5. Auto-detect import suggestions: find songs with µ: tags that differ from song_tags
  let importSuggestions = 0;
  clearPendingTagEditsByDirection('import');

  for (const song of songs) {
    let id3Tags: MusickTagData | null;
    try {
      id3Tags = await mp3Manager.readMusickTags(song.filePath);
    } catch { continue; }
    if (!id3Tags) continue;

    const dbTags = getTagsForSong(song.filePath);
    const dbMusickData = MP3MetadataManager.tagsToMusickData(
      dbTags.map(t => ({ label: t.tag_label, category: t.tag_category })),
      [],
    );

    // Compare each field and create import suggestions where they differ
    const fields: { name: string; id3Val: string[]; dbVal: string[] }[] = [
      { name: `${MUSICK_TAG_PREFIX}genres`, id3Val: id3Tags.genres || [], dbVal: dbMusickData.genres || [] },
      { name: `${MUSICK_TAG_PREFIX}phases`, id3Val: id3Tags.phases || [], dbVal: dbMusickData.phases || [] },
      { name: `${MUSICK_TAG_PREFIX}moods`,  id3Val: id3Tags.moods  || [], dbVal: dbMusickData.moods  || [] },
      { name: `${MUSICK_TAG_PREFIX}topics`, id3Val: id3Tags.topics || [], dbVal: dbMusickData.topics || [] },
      { name: `${MUSICK_TAG_PREFIX}tags`,   id3Val: id3Tags.tags   || [], dbVal: dbMusickData.tags   || [] },
    ];

    for (const f of fields) {
      const id3Norm = [...f.id3Val].sort().join(', ');
      const dbNorm = [...f.dbVal].sort().join(', ');
      if (id3Norm !== dbNorm && id3Norm !== '') {
        addTagEdit(song.filePath, f.name, dbNorm || null, id3Norm, 'import');
        importSuggestions++;
      }
    }

    // Related songs
    if (id3Tags.related && id3Tags.related.length > 0) {
      const id3RelStr = JSON.stringify(id3Tags.related.sort((a, b) => `${a.title}${a.artist}`.localeCompare(`${b.title}${b.artist}`)));
      addTagEdit(song.filePath, `${MUSICK_TAG_PREFIX}related`, null, id3RelStr, 'import');
      importSuggestions++;
    }
  }

  return {
    totalFiles: songs.length,
    newFiles,
    updatedFiles,
    removedFiles: 0,
    tagsDiscovered,
    connectionsDiscovered: resolvedConnections.length + discovered.length,
    importSuggestions,
    errors,
  };
}

export async function onGetLibrarySongs(): Promise<LibrarySong[]> {
  const base = readBaseFolder();
  if (!base) return [];
  // Search with empty string returns all cached results (up to a large limit)
  const results = searchMP3Cache('', 10000);
  return results.map(r => ({
    filePath: r.file_path,
    title: r.title ?? '',
    artist: r.artist ?? '',
    album: r.album ?? '',
    duration: r.duration ?? 0,
    fileSize: 0,
    artworkUrl: artworkUrl(r.file_path),
  }));
}

export async function onSearchSongs(query: string, limit = 30): Promise<LibrarySong[]> {
  const results = searchMP3Cache(query.trim(), limit);
  return results.map(r => ({
    filePath: r.file_path,
    title: r.title ?? '',
    artist: r.artist ?? '',
    album: r.album ?? '',
    duration: r.duration ?? 0,
    fileSize: 0,
    artworkUrl: artworkUrl(r.file_path),
  }));
}

// ============================================================================
// Tags
// ============================================================================

export async function onGetSongTags(filePath: string): Promise<SongTagInfo[]> {
  return getTagsForSong(filePath).map(songTagToInfo);
}

export async function onAddSongTag(filePath: string, label: string, category: string): Promise<void> {
  addSongTag(filePath, label, category as TagCategory);
}

export async function onRemoveSongTag(filePath: string, label: string, category: string): Promise<void> {
  removeSongTag(filePath, label, category as TagCategory);
}

export async function onGetAllTags(category?: string): Promise<TagInfo[]> {
  return getAllTags(category as TagCategory | undefined).map(tagCountToInfo);
}

export async function onSearchTags(query: string, category?: string): Promise<TagInfo[]> {
  return searchTags(query, category as TagCategory | undefined).map(tagCountToInfo);
}

// ============================================================================
// Song Connections
// ============================================================================

export async function onAddSongConnection(
  sourcePath: string,
  targetPath: string,
  type: string,
  weight?: number,
): Promise<void> {
  dbAddConnection(sourcePath, targetPath, type as ConnectionType, weight);
}

export async function onRemoveSongConnection(
  sourcePath: string,
  targetPath: string,
  type: string,
): Promise<void> {
  removeSongConnectionByPaths(sourcePath, targetPath, type as ConnectionType);
}

export async function onUpdateConnectionWeight(id: number, weight: number): Promise<void> {
  dbUpdateWeight(id, weight);
}

export async function onGetSongConnections(filePath: string): Promise<ConnectionInfo[]> {
  const rows = getConnectionsForSong(filePath);
  return rows.map((c: SongConnection) => {
    const isOutgoing = c.source_path === filePath;
    const otherPath = isOutgoing ? c.target_path : c.source_path;
    const cached = getMP3CacheByPath(otherPath);
    return {
      id: c.id,
      otherPath,
      otherTitle: cached?.title ?? '',
      otherArtist: cached?.artist ?? '',
      type: c.connection_type,
      weight: c.weight,
      direction: isOutgoing ? 'outgoing' as const : 'incoming' as const,
    };
  });
}

export async function onFindSimilarSongs(filePath: string, limit = 10): Promise<SimilarSong[]> {
  const { songs, connections } = buildGraphDataFromDB();

  // Ensure target is in the graph
  if (!songs.find(s => s.filePath === filePath)) {
    const cached = getMP3CacheByPath(filePath);
    const tags = getTagsForSong(filePath);
    songs.push({
      filePath,
      title: cached?.title,
      artist: cached?.artist,
      tags: tags.map(t => ({ label: t.tag_label, category: t.tag_category as SongNode['tags'][0]['category'] })),
    });
  }

  const graph = buildSongGraph(songs, connections);
  const results = findSimilarSongs(filePath, graph, limit);

  return results.map(r => {
    const cached = getMP3CacheByPath(r.filePath);
    return {
      filePath: r.filePath,
      title: cached?.title ?? '',
      artist: cached?.artist ?? '',
      score: r.score,
    };
  });
}

// ============================================================================
// Phase Flow
// ============================================================================

export async function onGetPhaseEdges(): Promise<PhaseEdgeInfo[]> {
  return dbGetPhaseEdges().map(dbPhaseEdgeToInfo);
}

export async function onAddPhaseEdge(
  fromPhase: string,
  toPhase: string,
  weight?: number,
): Promise<{ success: boolean; error?: string }> {
  if (dbWouldCreateCycle(fromPhase, toPhase)) {
    return { success: false, error: 'Adding this edge would create a cycle in the phase graph' };
  }
  dbAddPhaseEdge(fromPhase, toPhase, weight);
  return { success: true };
}

export async function onRemovePhaseEdge(id: number): Promise<void> {
  dbRemovePhaseEdge(id);
}

export async function onGetPhaseOrder(): Promise<string[]> {
  const edges = dbGetPhaseEdges();
  const domainEdges: PhaseEdgeDomain[] = edges.map(e => ({
    fromPhase: e.from_phase,
    toPhase: e.to_phase,
    weight: e.weight,
  }));
  return computePhaseOrder(domainEdges);
}

export async function onGetPhasesWithCounts(): Promise<{ phase: string; count: number }[]> {
  const phases = getAllPhases();
  const allTagCounts = getAllTags('phase' as TagCategory);
  const countMap = new Map<string, number>();
  for (const tc of allTagCounts) {
    countMap.set(tc.tag_label, tc.count);
  }
  return phases.map(phase => ({
    phase,
    count: countMap.get(phase) ?? 0,
  }));
}

export async function onSuggestPhaseFlow(): Promise<PhaseEdgeInfo[]> {
  const phases = getAllPhases();
  if (phases.length === 0) return [];
  const suggested = suggestDefaultFlow(phases);
  return suggested.map((e, i) => ({
    id: -(i + 1), // negative IDs indicate unsaved suggestions
    fromPhase: e.fromPhase,
    toPhase: e.toPhase,
    weight: e.weight,
  }));
}

// ============================================================================
// Playlist Generation
// ============================================================================

export async function onGeneratePlaylist(options?: PlaylistOptions): Promise<GeneratedPlaylistResult> {
  const { songs, connections } = buildGraphDataFromDB();
  const edges = dbGetPhaseEdges();
  const phaseEdges: PhaseEdgeDomain[] = edges.map(e => ({
    fromPhase: e.from_phase,
    toPhase: e.to_phase,
    weight: e.weight,
  }));

  const playlist: GeneratedPlaylist = generatePlaylist(songs, connections, phaseEdges, options);

  // Enrich entries with title/artist from cache
  const entries = playlist.entries.map(e => {
    const cached = getMP3CacheByPath(e.filePath);
    return {
      filePath: e.filePath,
      title: cached?.title ?? '',
      artist: cached?.artist ?? '',
      phase: e.phase,
      position: e.position,
      reason: e.reason,
    };
  });

  return {
    entries,
    phases: playlist.phases,
    stats: playlist.stats,
  };
}

export async function onSavePlaylist(
  name: string,
  entries: { filePath: string; position: number; phase?: string }[],
  description?: string,
): Promise<number> {
  const playlist = createPlaylist(name, description);
  setPlaylistItems(playlist.id, entries);
  return playlist.id;
}

export async function onGetPlaylists(): Promise<PlaylistInfo[]> {
  const playlists = dbGetPlaylists();
  return playlists.map(p => {
    const withItems = dbGetPlaylistWithItems(p.id);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      itemCount: withItems?.items.length ?? 0,
      createdAt: p.created_at,
    };
  });
}

export async function onGetPlaylistWithItems(id: number): Promise<PlaylistWithItems | null> {
  const result = dbGetPlaylistWithItems(id);
  if (!result) return null;
  return {
    id: result.playlist.id,
    name: result.playlist.name,
    description: result.playlist.description,
    items: result.items.map(item => {
      const cached = getMP3CacheByPath(item.file_path);
      return {
        filePath: item.file_path,
        position: item.position,
        phase: item.phase,
        title: cached?.title ?? '',
        artist: cached?.artist ?? '',
      };
    }),
  };
}

export async function onDeletePlaylist(id: number): Promise<void> {
  dbDeletePlaylist(id);
}

// ============================================================================
// Canvas State
// ============================================================================

export async function onLoadMoodboardState(): Promise<MoodboardState> {
  // Positions
  const positions = getAllNodePositions().map(p => ({
    nodeId: p.node_id,
    x: p.position_x,
    y: p.position_y,
  }));

  // Songs: gather from positions that are song nodes
  const songPositions = new Map<string, { x: number; y: number }>();
  const tagPositions = new Map<string, { label: string; category: string; x: number; y: number }>();

  for (const p of positions) {
    const fp = parseSongNodeId(p.nodeId);
    if (fp) {
      songPositions.set(fp, { x: p.x, y: p.y });
    } else if (p.nodeId.startsWith('tag:')) {
      const rest = p.nodeId.slice(4);
      const idx = rest.indexOf(':');
      if (idx !== -1) {
        tagPositions.set(p.nodeId, {
          label: rest.slice(idx + 1),
          category: rest.slice(0, idx),
          x: p.x,
          y: p.y,
        });
      }
    }
  }

  // Build song data with tags
  const songs: MoodboardState['songs'] = [];
  for (const [fp, pos] of songPositions) {
    const cached = getMP3CacheByPath(fp);
    const tags = getTagsForSong(fp).map(songTagToInfo);
    songs.push({
      filePath: fp,
      title: cached?.title ?? '',
      artist: cached?.artist ?? '',
      x: pos.x,
      y: pos.y,
      tags,
    });
  }

  // Connections from DB
  const allConn = getAllConnections();
  const connections = allConn.map(c => ({
    sourcePath: c.source_path,
    targetPath: c.target_path,
    type: c.connection_type,
    weight: c.weight,
  }));

  // Tags with positions
  const tags = Array.from(tagPositions.values());

  // Viewport + view mode
  const viewport = getViewport();
  const viewMode = getViewMode();

  // Phase edges + order
  const edges = dbGetPhaseEdges();
  const phaseEdges = edges.map(dbPhaseEdgeToInfo);
  const domainEdges: PhaseEdgeDomain[] = edges.map(e => ({
    fromPhase: e.from_phase,
    toPhase: e.to_phase,
    weight: e.weight,
  }));
  const phaseOrder = domainEdges.length > 0 ? computePhaseOrder(domainEdges) : [];

  return { songs, connections, positions, tags, viewport, viewMode, phaseEdges, phaseOrder };
}

export async function onSaveNodePositions(
  positions: { nodeId: string; x: number; y: number }[],
): Promise<void> {
  dbBulkUpdatePositions(positions);
}

export async function onSaveViewport(viewport: { x: number; y: number; zoom: number }): Promise<void> {
  dbSetViewport(viewport);
}

export async function onSaveViewMode(mode: string): Promise<void> {
  dbSetViewMode(mode as 'free' | 'phase' | 'genre' | 'mood');
}

export async function onGetSongMetadata(filePath: string): Promise<SongMetadata | null> {
  try {
    const meta = await mp3Manager.readMetadata(filePath);
    return {
      filePath: meta.filePath,
      title: meta.title ?? '',
      artist: meta.artist ?? '',
      album: meta.album ?? '',
      duration: meta.duration ?? 0,
      genre: meta.genre ?? [],
      artworkDataUrl: meta.artworkDataUrl ?? null,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Discovery
// ============================================================================

export async function onDiscoverHiddenConnections(): Promise<{
  connections: DiscoveredConnection[];
  count: number;
}> {
  const { songs, connections: existingEdges } = buildGraphDataFromDB();
  const discovered = discoverHiddenConnections(songs, existingEdges);

  const result: DiscoveredConnection[] = discovered.map(e => {
    const srcCached = getMP3CacheByPath(e.sourceFilePath);
    const tgtCached = getMP3CacheByPath(e.targetFilePath);

    // Find shared tags between the two songs
    const srcTags = getTagsForSong(e.sourceFilePath);
    const tgtTags = getTagsForSong(e.targetFilePath);
    const srcTagKeys = new Set(srcTags.map(t => `${t.tag_category}:${t.tag_label}`));
    const sharedTags = tgtTags
      .filter(t => srcTagKeys.has(`${t.tag_category}:${t.tag_label}`))
      .map(t => t.tag_label);

    return {
      sourcePath: e.sourceFilePath,
      sourceTitle: srcCached?.title ?? '',
      targetPath: e.targetFilePath,
      targetTitle: tgtCached?.title ?? '',
      type: e.type,
      sharedTags,
    };
  });

  return { connections: result, count: result.length };
}
