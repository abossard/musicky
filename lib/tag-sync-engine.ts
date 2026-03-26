import { MP3MetadataManager, type MP3Metadata, type MusickTagData, type MusickRelatedSong, MUSICK_TAG_PREFIX, DEFAULT_VDJ_OPTIONS } from './mp3-metadata';
import { getNodes, getEdges, type MoodboardNodeRow, type MoodboardEdgeRow } from '../database/sqlite/queries/moodboard';
import { db } from '../database/sqlite/db';

/**
 * Represents a single field-level diff between dashboard state and file ID3 tags.
 */
export interface TagDiff {
  filePath: string;
  fieldName: string;         // e.g. 'µ:genres', 'µ:phases', 'µ:moods', 'µ:related', 'genre'
  currentValue: string;      // what's currently in the file
  proposedValue: string;     // what should be written
  direction: 'export' | 'import';
}

/**
 * Per-file diff summary with all field diffs grouped.
 */
export interface FileDiffSummary {
  filePath: string;
  title?: string;
  artist?: string;
  diffs: TagDiff[];
}

const mp3Manager = new MP3MetadataManager();

/**
 * Gather all tag-category labels attached to a song across all moodboards.
 * Returns categorized tags from moodboard edges (song→tag connections).
 */
export function getMoodboardTagsForSong(songPath: string): {
  genres: string[];
  phases: string[];
  moods: string[];
  topics: string[];
  custom: string[];
} {
  const result = { genres: [] as string[], phases: [] as string[], moods: [] as string[], topics: [] as string[], custom: [] as string[] };

  // Find all boards that contain this song
  const songNodes = db().prepare(
    'SELECT id, board_id FROM moodboard_nodes WHERE song_path = ?'
  ).all(songPath) as { id: string; board_id: number }[];

  if (songNodes.length === 0) return result;

  for (const songNode of songNodes) {
    // Get all edges from/to this song node
    const edges = db().prepare(
      'SELECT source_node_id, target_node_id FROM moodboard_edges WHERE board_id = ? AND (source_node_id = ? OR target_node_id = ?)'
    ).all(songNode.board_id, songNode.id, songNode.id) as { source_node_id: string; target_node_id: string }[];

    // Find the tag nodes connected to this song
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
      if (edge.source_node_id === songNode.id) connectedNodeIds.add(edge.target_node_id);
      else connectedNodeIds.add(edge.source_node_id);
    }

    if (connectedNodeIds.size === 0) continue;

    // Get tag nodes
    const placeholders = [...connectedNodeIds].map(() => '?').join(',');
    const tagNodes = db().prepare(
      `SELECT tag_label, tag_category FROM moodboard_nodes WHERE id IN (${placeholders}) AND node_type = 'tag'`
    ).all(...connectedNodeIds) as { tag_label: string | null; tag_category: string | null }[];

    for (const tag of tagNodes) {
      if (!tag.tag_label) continue;
      const label = tag.tag_label.toLowerCase();
      switch (tag.tag_category) {
        case 'genre': result.genres.push(label); break;
        case 'phase': result.phases.push(label); break;
        case 'mood': result.moods.push(label); break;
        case 'topic': result.topics.push(label); break;
        default: result.custom.push(label); break;
      }
    }
  }

  // Deduplicate
  result.genres = [...new Set(result.genres)].sort();
  result.phases = [...new Set(result.phases)].sort();
  result.moods = [...new Set(result.moods)].sort();
  result.topics = [...new Set(result.topics)].sort();
  result.custom = [...new Set(result.custom)].sort();

  return result;
}

/**
 * Get related songs from moodboard edges (song↔song connections).
 */
export function getMoodboardRelatedSongs(songPath: string): MusickRelatedSong[] {
  const related: MusickRelatedSong[] = [];

  const songNodes = db().prepare(
    'SELECT id, board_id FROM moodboard_nodes WHERE song_path = ?'
  ).all(songPath) as { id: string; board_id: number }[];

  for (const songNode of songNodes) {
    // Get edges connecting this song to other songs
    const edges = db().prepare(
      `SELECT e.source_node_id, e.target_node_id, e.edge_type, e.weight,
              n.song_path
       FROM moodboard_edges e
       JOIN moodboard_nodes n ON (
         CASE WHEN e.source_node_id = ? THEN e.target_node_id ELSE e.source_node_id END = n.id
       )
       WHERE e.board_id = ?
         AND (e.source_node_id = ? OR e.target_node_id = ?)
         AND n.node_type = 'song'`
    ).all(songNode.id, songNode.board_id, songNode.id, songNode.id) as {
      source_node_id: string; target_node_id: string; edge_type: string; weight: number; song_path: string;
    }[];

    for (const edge of edges) {
      if (!edge.song_path) continue;
      // Look up title/artist from cache
      const cached = db().prepare(
        'SELECT title, artist FROM mp3_file_cache WHERE file_path = ?'
      ).get(edge.song_path) as { title: string | null; artist: string | null } | undefined;

      related.push({
        title: cached?.title || edge.song_path.split('/').pop()?.replace(/\.mp3$/i, '') || 'Unknown',
        artist: cached?.artist || 'Unknown',
        type: edge.edge_type,
        weight: edge.weight,
      });
    }
  }

  // Deduplicate by title+artist+type
  const seen = new Set<string>();
  return related.filter(r => {
    const key = `${r.title}|${r.artist}|${r.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Compare a comma-separated list (sorted, trimmed) for equality.
 */
function normalizeList(arr?: string[]): string {
  if (!arr || arr.length === 0) return '';
  return [...arr].sort().join(', ');
}

/**
 * Pure calculation: compute tag diff between current and proposed tag values.
 * Returns an array of field-level diffs where values differ and proposed is non-empty.
 */
export function computeTagDiff(
  current: { genres: string[]; phases: string[]; moods: string[]; topics: string[]; tags: string[] },
  proposed: { genres: string[]; phases: string[]; moods: string[]; topics: string[]; tags: string[] },
): Array<{ field: string; currentValue: string; proposedValue: string }> {
  const diffs: Array<{ field: string; currentValue: string; proposedValue: string }> = [];

  const comparisons: { field: string; current: string[]; proposed: string[] }[] = [
    { field: `${MUSICK_TAG_PREFIX}genres`, current: current.genres, proposed: proposed.genres },
    { field: `${MUSICK_TAG_PREFIX}phases`, current: current.phases, proposed: proposed.phases },
    { field: `${MUSICK_TAG_PREFIX}moods`, current: current.moods, proposed: proposed.moods },
    { field: `${MUSICK_TAG_PREFIX}topics`, current: current.topics, proposed: proposed.topics },
    { field: `${MUSICK_TAG_PREFIX}tags`, current: current.tags, proposed: proposed.tags },
  ];

  for (const comp of comparisons) {
    const currentNorm = normalizeList(comp.current);
    const proposedNorm = normalizeList(comp.proposed);
    if (currentNorm !== proposedNorm && proposedNorm !== '') {
      diffs.push({
        field: comp.field,
        currentValue: currentNorm,
        proposedValue: proposedNorm,
      });
    }
  }

  return diffs;
}

/**
 * Generate export diffs for a single file: what needs to be written to the MP3.
 */
export async function generateExportDiff(filePath: string): Promise<TagDiff[]> {
  const metadata = await mp3Manager.readMetadata(filePath);
  const existingTags = metadata.muspiTag || {};

  // Get dashboard state for this song
  const moodboardTags = getMoodboardTagsForSong(filePath);
  const relatedSongs = getMoodboardRelatedSongs(filePath);

  // Also consider phases from comment hashtags (legacy)
  const commentPhases = extractPhasesFromComment(metadata.comment);
  const allPhases = [...new Set([...moodboardTags.phases, ...commentPhases])].sort();

  // CALCULATION: compute tag field diffs
  const tagDiffs = computeTagDiff(
    {
      genres: existingTags.genres || [],
      phases: existingTags.phases || [],
      moods: existingTags.moods || [],
      topics: existingTags.topics || [],
      tags: existingTags.tags || [],
    },
    {
      genres: moodboardTags.genres,
      phases: allPhases,
      moods: moodboardTags.moods,
      topics: moodboardTags.topics,
      tags: moodboardTags.custom,
    },
  );

  const diffs: TagDiff[] = tagDiffs.map(d => ({
    filePath,
    fieldName: d.field,
    currentValue: d.currentValue,
    proposedValue: d.proposedValue,
    direction: 'export' as const,
  }));

  // Compare related songs
  const currentRelated = JSON.stringify((existingTags.related || []).sort((a, b) => `${a.title}${a.artist}`.localeCompare(`${b.title}${b.artist}`)));
  const proposedRelated = JSON.stringify(relatedSongs.sort((a, b) => `${a.title}${a.artist}`.localeCompare(`${b.title}${b.artist}`)));
  if (currentRelated !== proposedRelated && relatedSongs.length > 0) {
    diffs.push({
      filePath,
      fieldName: `${MUSICK_TAG_PREFIX}related`,
      currentValue: currentRelated === '[]' ? '' : currentRelated,
      proposedValue: proposedRelated,
      direction: 'export',
    });
  }

  // Also compare standard genre field
  const currentGenre = normalizeList(metadata.genre);
  const proposedGenre = normalizeList(moodboardTags.genres);
  if (currentGenre !== proposedGenre && proposedGenre !== '') {
    diffs.push({
      filePath,
      fieldName: 'genre',
      currentValue: currentGenre,
      proposedValue: proposedGenre,
      direction: 'export',
    });
  }

  return diffs;
}

/**
 * Generate import diffs for a single file: what µ: tags exist in the file
 * that could be imported into the dashboard.
 */
export async function generateImportDiff(filePath: string): Promise<TagDiff[]> {
  const metadata = await mp3Manager.readMetadata(filePath);
  const fileTags = metadata.muspiTag;
  if (!fileTags) return [];

  const diffs: TagDiff[] = [];
  const moodboardTags = getMoodboardTagsForSong(filePath);

  const comparisons: { field: string; inFile: string[]; inDb: string[] }[] = [
    { field: `${MUSICK_TAG_PREFIX}genres`, inFile: fileTags.genres || [], inDb: moodboardTags.genres },
    { field: `${MUSICK_TAG_PREFIX}phases`, inFile: fileTags.phases || [], inDb: moodboardTags.phases },
    { field: `${MUSICK_TAG_PREFIX}moods`, inFile: fileTags.moods || [], inDb: moodboardTags.moods },
    { field: `${MUSICK_TAG_PREFIX}topics`, inFile: fileTags.topics || [], inDb: moodboardTags.topics },
    { field: `${MUSICK_TAG_PREFIX}tags`, inFile: fileTags.tags || [], inDb: moodboardTags.custom },
  ];

  for (const comp of comparisons) {
    const fileNorm = normalizeList(comp.inFile);
    const dbNorm = normalizeList(comp.inDb);
    if (fileNorm !== dbNorm && fileNorm !== '') {
      diffs.push({
        filePath,
        fieldName: comp.field,
        currentValue: dbNorm,
        proposedValue: fileNorm,
        direction: 'import',
      });
    }
  }

  // Related songs import
  if (fileTags.related && fileTags.related.length > 0) {
    const currentRelated = getMoodboardRelatedSongs(filePath);
    const fileRelatedStr = JSON.stringify(fileTags.related.sort((a, b) => `${a.title}${a.artist}`.localeCompare(`${b.title}${b.artist}`)));
    const dbRelatedStr = JSON.stringify(currentRelated.sort((a, b) => `${a.title}${a.artist}`.localeCompare(`${b.title}${b.artist}`)));
    if (fileRelatedStr !== dbRelatedStr) {
      diffs.push({
        filePath,
        fieldName: `${MUSICK_TAG_PREFIX}related`,
        currentValue: dbRelatedStr === '[]' ? '' : dbRelatedStr,
        proposedValue: fileRelatedStr,
        direction: 'import',
      });
    }
  }

  return diffs;
}

/**
 * Generate export diffs for multiple files.
 */
export async function generateBulkExportDiff(filePaths: string[]): Promise<FileDiffSummary[]> {
  const summaries: FileDiffSummary[] = [];
  for (const fp of filePaths) {
    try {
      const diffs = await generateExportDiff(fp);
      if (diffs.length > 0) {
        const meta = await mp3Manager.readMetadata(fp);
        summaries.push({
          filePath: fp,
          title: meta.title,
          artist: meta.artist,
          diffs,
        });
      }
    } catch (err) {
      console.warn(`[TagSync] Failed to generate export diff for ${fp}:`, err);
    }
  }
  return summaries;
}

/**
 * Generate import diffs for multiple files.
 */
export async function generateBulkImportDiff(filePaths: string[]): Promise<FileDiffSummary[]> {
  const summaries: FileDiffSummary[] = [];
  for (const fp of filePaths) {
    try {
      const diffs = await generateImportDiff(fp);
      if (diffs.length > 0) {
        const meta = await mp3Manager.readMetadata(fp);
        summaries.push({
          filePath: fp,
          title: meta.title,
          artist: meta.artist,
          diffs,
        });
      }
    } catch (err) {
      console.warn(`[TagSync] Failed to generate import diff for ${fp}:`, err);
    }
  }
  return summaries;
}

/**
 * Extract phase hashtags from the comment field (legacy format).
 */
function extractPhasesFromComment(comment?: string): string[] {
  if (!comment) return [];
  const matches = comment.match(/#(\w+)/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1).toLowerCase());
}

// ─── VDJ Export Diff ──────────────────────────────────────────────────────

/**
 * Build the structured comment string that writeVDJTags would produce.
 * Mirrors the logic in MP3MetadataManager.writeVDJTags() for 'structured' format.
 */
function buildVDJComment(data: {
  phases?: string[];
  energyLevel?: number;
  camelotKey?: string;
  moods?: string[];
  relatedSongs?: { artist: string; title: string }[];
  tags?: string[];
}): string {
  const parts: string[] = [];
  if (data.phases?.length)        parts.push(`[Phase:${data.phases.join(',')}]`);
  if (data.energyLevel != null)   parts.push(`[Energy:${data.energyLevel}]`);
  if (data.camelotKey)            parts.push(`[Key:${data.camelotKey}]`);
  if (data.moods?.length)         parts.push(`[Mood:${data.moods.join(',')}]`);
  if (data.relatedSongs?.length) {
    const rel = data.relatedSongs.map(s => `${s.artist} - ${s.title}`).join(', ');
    parts.push(`[Related:${rel}]`);
  }
  if (data.tags?.length)          parts.push(`[Tags:${data.tags.join(',')}]`);
  return parts.join(' ');
}

/**
 * Build the grouping string that writeVDJTags would produce.
 * Mirrors the TIT1 format: `E{energy} // {moods} // {phases} // {key}`
 */
function buildVDJGrouping(data: {
  energyLevel?: number;
  moods?: string[];
  phases?: string[];
  camelotKey?: string;
}): string {
  const groupParts: string[] = [];
  if (data.energyLevel != null) groupParts.push(`E${data.energyLevel}`);
  if (data.moods?.length)       groupParts.push(data.moods.join(','));
  if (data.phases?.length)      groupParts.push(data.phases.join(','));
  if (data.camelotKey)          groupParts.push(data.camelotKey);
  return groupParts.join(' // ');
}

/**
 * Generate VDJ-specific export diffs for a single file.
 * Compares what writeVDJTags() would write (TCON, COMM, TIT1)
 * against what's currently in the file.
 */
export async function generateVDJExportDiff(filePath: string): Promise<TagDiff[]> {
  const metadata = await mp3Manager.readMetadata(filePath);
  const moodboardTags = getMoodboardTagsForSong(filePath);
  const relatedSongs = getMoodboardRelatedSongs(filePath);
  const diffs: TagDiff[] = [];

  const opts = DEFAULT_VDJ_OPTIONS;

  // Prepare the data that writeVDJTags would receive
  const vdjData = {
    genres: moodboardTags.genres,
    phases: moodboardTags.phases,
    moods: moodboardTags.moods,
    tags: moodboardTags.custom,
    energyLevel: metadata.energyLevel,
    camelotKey: metadata.camelotKey,
    relatedSongs: relatedSongs.map(r => ({ artist: r.artist, title: r.title })),
  };

  // 1. Genre (TCON) — semicolon-separated
  if (opts.writeGenre && vdjData.genres.length > 0) {
    const proposedGenre = vdjData.genres.join('; ');
    const currentGenre = metadata.genre?.join('; ') || '';
    if (currentGenre !== proposedGenre) {
      diffs.push({
        filePath,
        fieldName: 'genre',
        currentValue: currentGenre,
        proposedValue: proposedGenre,
        direction: 'export',
      });
    }
  }

  // 2. Comment (COMM) — structured format (without existing-comment preservation in diff)
  if (opts.writeComment) {
    const proposedComment = buildVDJComment(vdjData);
    if (proposedComment) {
      const currentComment = metadata.comment || '';
      if (currentComment !== proposedComment) {
        diffs.push({
          filePath,
          fieldName: 'comment',
          currentValue: currentComment,
          proposedValue: proposedComment,
          direction: 'export',
        });
      }
    }
  }

  // 3. Grouping (TIT1) — quick-scan format
  if (opts.writeGrouping) {
    const proposedGrouping = buildVDJGrouping(vdjData);
    if (proposedGrouping) {
      const currentGrouping = metadata.grouping || '';
      if (currentGrouping !== proposedGrouping) {
        diffs.push({
          filePath,
          fieldName: 'grouping',
          currentValue: currentGrouping,
          proposedValue: proposedGrouping,
          direction: 'export',
        });
      }
    }
  }

  return diffs;
}

/**
 * Generate VDJ export diffs for all songs present on any moodboard.
 */
export async function generateBulkVDJExportDiff(): Promise<FileDiffSummary[]> {
  const songRows = db().prepare(
    "SELECT DISTINCT song_path FROM moodboard_nodes WHERE node_type = 'song' AND song_path IS NOT NULL"
  ).all() as { song_path: string }[];

  const summaries: FileDiffSummary[] = [];

  for (const row of songRows) {
    try {
      const diffs = await generateVDJExportDiff(row.song_path);
      if (diffs.length > 0) {
        const meta = await mp3Manager.readMetadata(row.song_path);
        summaries.push({
          filePath: row.song_path,
          title: meta.title,
          artist: meta.artist,
          diffs,
        });
      }
    } catch (err) {
      console.warn(`[TagSync] Failed to generate VDJ export diff for ${row.song_path}:`, err);
    }
  }

  return summaries;
}
