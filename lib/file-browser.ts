import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { homedir } from 'os';

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  lastModified?: Date;
}

export interface FileBrowserOptions {
  extensions?: string[];
  includeHidden?: boolean;
  maxDepth?: number;
}

export class FileBrowser {
  private readonly homeDir: string;
  
  constructor() {
    this.homeDir = homedir();
  }

  /**
   * Get the user's home directory
   */
  getHomeDirectory(): string {
    return this.homeDir;
  }

  /**
   * Check if a path is within the user's home directory (security check)
   */
  private isPathSafe(targetPath: string): boolean {
    const resolvedPath = join(targetPath);
    return resolvedPath.startsWith(this.homeDir);
  }

  /**
   * Check if a file should be hidden
   */
  private isHidden(fileName: string): boolean {
    return fileName.startsWith('.');
  }

  /**
   * Check if file matches extension filter
   */
  private matchesExtension(fileName: string, extensions: string[]): boolean {
    if (extensions.length === 0) return true;
    
    const fileExt = extname(fileName).toLowerCase().slice(1); // Remove the dot
    return extensions.some(ext => ext.toLowerCase() === fileExt);
  }

  /**
   * Read directory contents with filtering
   */
  async readDirectory(
    dirPath: string, 
    options: FileBrowserOptions = {}
  ): Promise<FileItem[]> {
    const {
      extensions = ['mp3'],
      includeHidden = false,
      maxDepth = 1
    } = options;

    // Security check
    if (!this.isPathSafe(dirPath)) {
      throw new Error('Access denied: Path is outside user home directory');
    }

    try {
      const entries = await readdir(dirPath);
      const items: FileItem[] = [];

      for (const entry of entries) {
        // Skip hidden files unless explicitly included
        if (!includeHidden && this.isHidden(entry)) {
          continue;
        }

        const fullPath = join(dirPath, entry);
        
        try {
          const stats = await stat(fullPath);
          
          if (stats.isDirectory()) {
            items.push({
              name: entry,
              path: fullPath,
              isDirectory: true,
              lastModified: stats.mtime
            });
          } else {
            // Check extension filter for files
            if (this.matchesExtension(entry, extensions)) {
              items.push({
                name: entry,
                path: fullPath,
                isDirectory: false,
                size: stats.size,
                extension: extname(entry).slice(1),
                lastModified: stats.mtime
              });
            }
          }
        } catch (error) {
          // Skip files we can't read (permission issues, etc.)
          console.warn(`Cannot read ${fullPath}:`, error);
          continue;
        }
      }

      // Sort: directories first, then files, both alphabetically
      return items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Cannot read directory ${dirPath}: ${message}`);
    }
  }

  /**
   * Read directory recursively
   */
  async readDirectoryRecursive(
    dirPath: string,
    options: FileBrowserOptions = {},
    currentDepth: number = 0
  ): Promise<FileItem[]> {
    const { maxDepth = 10 } = options;
    
    if (currentDepth >= maxDepth) {
      return [];
    }

    const items = await this.readDirectory(dirPath, options);
    const allItems: FileItem[] = [...items];

    // Recursively read subdirectories
    for (const item of items) {
      if (item.isDirectory) {
        try {
          const subItems = await this.readDirectoryRecursive(
            item.path, 
            options, 
            currentDepth + 1
          );
          allItems.push(...subItems);
        } catch (error) {
          // Skip directories we can't read
          console.warn(`Cannot read subdirectory ${item.path}:`, error);
        }
      }
    }

    return allItems;
  }

  /**
   * Get directory info (name, parent path, etc.)
   */
  getDirectoryInfo(dirPath: string) {
    return {
      name: basename(dirPath),
      path: dirPath,
      parent: join(dirPath, '..'),
      isHome: dirPath === this.homeDir
    };
  }

  /**
   * Format file size in human readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
