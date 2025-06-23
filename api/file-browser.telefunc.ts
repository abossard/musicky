import { FileBrowser, type FileItem, type FileBrowserOptions } from '../lib/file-browser';

const fileBrowser = new FileBrowser();

/**
 * Get the user's home directory
 */
export async function onGetHomeDirectory(): Promise<string> {
  return fileBrowser.getHomeDirectory();
}

/**
 * Read directory contents
 */
export async function onReadDirectory(
  path: string, 
  options: FileBrowserOptions = {}
): Promise<FileItem[]> {
  return await fileBrowser.readDirectory(path, options);
}

/**
 * Read directory contents recursively
 */
export async function onReadDirectoryRecursive(
  path: string,
  options: FileBrowserOptions = {}
): Promise<FileItem[]> {
  return await fileBrowser.readDirectoryRecursive(path, options);
}

/**
 * Get directory information
 */
export async function onGetDirectoryInfo(path: string) {
  return fileBrowser.getDirectoryInfo(path);
}

/**
 * Get common music directories from user's home
 */
export async function onGetMusicDirectories(): Promise<FileItem[]> {
  const homeDir = fileBrowser.getHomeDirectory();
  const musicPaths = [
    `${homeDir}/Music`,
    `${homeDir}/Downloads`,
    `${homeDir}/Documents/Music`,
    `${homeDir}/Desktop`
  ];

  const musicDirs: FileItem[] = [];

  for (const path of musicPaths) {
    try {
      const items = await fileBrowser.readDirectory(path, { 
        extensions: [], // Include all directories
        includeHidden: false 
      });
      
      // Only include directories that exist and are readable
      musicDirs.push({
        name: path.split('/').pop() || 'Unknown',
        path: path,
        isDirectory: true,
        lastModified: new Date()
      });
    } catch (error) {
      // Skip directories that don't exist or can't be read
      continue;
    }
  }

  return musicDirs;
}
