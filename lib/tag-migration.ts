import { MP3MetadataManager, type MusickTagData, MUSICK_TAG_PREFIX } from './mp3-metadata';
import type { TagDiff } from './tag-sync-engine';

const mp3Manager = new MP3MetadataManager();

/**
 * Generates migration diffs for moving #hashtag phases from the COMM (comment)
 * field to µ:phases TXXX frames. Also proposes cleaning the comment field.
 *
 * This does NOT modify any files — it only produces diffs for the review flow.
 */
export async function generateMigrationDiffs(filePaths: string[]): Promise<TagDiff[]> {
  const diffs: TagDiff[] = [];

  for (const filePath of filePaths) {
    try {
      const metadata = await mp3Manager.readMetadata(filePath);
      const comment = metadata.comment || '';
      const hashtags = comment.match(/#(\w+)/g);
      if (!hashtags || hashtags.length === 0) continue;

      const phases = hashtags.map(h => h.slice(1).toLowerCase());
      const existingMusickPhases = metadata.muspiTag?.phases || [];

      // Merge: existing µ:phases + comment hashtags (deduplicated)
      const mergedPhases = [...new Set([...existingMusickPhases, ...phases])].sort();

      // Only propose if there's actually something new
      const currentNorm = [...(existingMusickPhases || [])].sort().join(', ');
      const proposedNorm = mergedPhases.join(', ');

      if (currentNorm !== proposedNorm) {
        diffs.push({
          filePath,
          fieldName: `${MUSICK_TAG_PREFIX}phases`,
          currentValue: currentNorm,
          proposedValue: proposedNorm,
          direction: 'export',
        });
      }

      // Propose cleaning the comment field (remove hashtags, keep other text)
      const cleanedComment = comment.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
      if (cleanedComment !== comment) {
        diffs.push({
          filePath,
          fieldName: 'comment',
          currentValue: comment,
          proposedValue: cleanedComment || '(empty)',
          direction: 'export',
        });
      }
    } catch (err) {
      console.warn(`[TagMigration] Failed to process ${filePath}:`, err);
    }
  }

  return diffs;
}
