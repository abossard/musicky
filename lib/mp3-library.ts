import { FileBrowser, type FileItem } from './file-browser.js';
import { MP3MetadataManager, type MP3Metadata } from './mp3-metadata.js';
import path from 'path';

export interface MP3LibraryScan {
  files: MP3Metadata[];
  tags: string[];
}

export interface MP3EditHistory {
  id: number;
  filePath: string;
  oldComment: string | null;
  newComment: string;
  appliedAt: string;
  reverted: boolean;
}

export class MP3Library {
  private browser = new FileBrowser();
  private mp3Manager = new MP3MetadataManager();

  /**
   * Recursively scan a directory for MP3 files and extract metadata.
   * Also collect unique hashtags used in comments.
   */
  async scan(baseFolder: string): Promise<MP3LibraryScan> {
    const items = await this.browser.readDirectoryRecursive(baseFolder, {
      extensions: ['mp3'],
      includeHidden: false,
      maxDepth: 50
    });

    const mp3Files = items.filter(i => !i.isDirectory && path.extname(i.name).toLowerCase() === '.mp3');
    const files: MP3Metadata[] = [];
    const tagSet = new Set<string>();

    for (const f of mp3Files) {
      try {
        const meta = await this.mp3Manager.readMetadata(f.path);
        files.push(meta);
        const tags = this.extractTags(meta.comment || '');
        tags.forEach(t => tagSet.add(t));
      } catch {
        // ignore unreadable files
      }
    }

    return { files, tags: Array.from(tagSet).sort() };
  }

  /**
   * Extract hashtags from a comment string
   */
  extractTags(comment: string): string[] {
    const regex = /#(\w+)/g;
    const tags: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(comment))) {
      tags.push(match[1]);
    }
    return tags;
  }

  /**
   * Filter files by required or excluded tags
   */
  filterByTags(files: MP3Metadata[], include: string[] = [], exclude: string[] = []): MP3Metadata[] {
    return files.filter(f => {
      const tags = new Set(this.extractTags(f.comment || ''));
      for (const t of include) {
        if (!tags.has(t)) return false;
      }
      for (const t of exclude) {
        if (tags.has(t)) return false;
      }
      return true;
    });
  }
}
