# File Browser Library Documentation

## Overview

A comprehensive file browser library built for Mantine v8 that allows users to browse their local file system with support for filtering, searching, and file selection.

## Features

### 🗂️ Core Functionality
- **Local Folder Navigation**: Browse starting from user's home directory
- **Recursive File Reading**: Scan directories recursively with depth control
- **Hidden File Handling**: Option to show/hide hidden files (starting with .)
- **Security**: Restricts access to user's home directory only

### 🎵 Music-Focused Features
- **Extension Filtering**: Default support for mp3, with multi-extension filtering
- **Quick Music Navigation**: Direct navigation to common music folders
- **File Size Display**: Human-readable file size formatting
- **Audio File Types**: Built-in support for mp3, wav, flac, aac, m4a, ogg, wma

### 🔍 User Interface
- **Search Functionality**: Real-time file and folder search
- **Multiple Selection**: Support for single or multiple file selection
- **Responsive Design**: Works on desktop and mobile devices
- **Breadcrumb Navigation**: Easy path navigation
- **File Type Icons**: Visual distinction between files and folders

## Architecture

### Backend (Node.js)
```
lib/file-browser.ts              - Core file system operations
components/FileBrowser.telefunc.ts - API endpoints for frontend
```

### Frontend (React + Mantine)
```
components/FileBrowser.tsx   - Main React component
pages/file-browser/          - Demo page implementation
```

## API Reference

### FileBrowser Class

#### Constructor
```typescript
const fileBrowser = new FileBrowser();
```

#### Methods

##### `getHomeDirectory(): string`
Returns the user's home directory path.

##### `readDirectory(dirPath: string, options?: FileBrowserOptions): Promise<FileItem[]>`
Read directory contents with filtering options.

**Options:**
- `extensions: string[]` - File extensions to include (default: ['mp3'])
- `includeHidden: boolean` - Include hidden files (default: false)
- `maxDepth: number` - Maximum recursion depth (default: 1)

##### `readDirectoryRecursive(dirPath: string, options?: FileBrowserOptions): Promise<FileItem[]>`
Recursively read directory contents.

##### `static formatFileSize(bytes: number): string`
Format file size in human-readable format (B, KB, MB, GB, TB).

### Telefunc API Endpoints

#### `getHomeDirectory(): Promise<string>`
Get user's home directory.

#### `readDirectory(path: string, options?: FileBrowserOptions): Promise<FileItem[]>`
Read directory contents.

#### `readDirectoryRecursive(path: string, options?: FileBrowserOptions): Promise<FileItem[]>`
Read directory contents recursively.

#### `getMusicDirectories(): Promise<FileItem[]>`
Get common music directories (Music, Downloads, Documents/Music, Desktop).

### FileItem Interface

```typescript
interface FileItem {
  name: string;           // File/folder name
  path: string;           // Full file path
  isDirectory: boolean;   // Whether it's a directory
  size?: number;          // File size in bytes
  extension?: string;     // File extension (without dot)
  lastModified?: Date;    // Last modification date
}
```

## Component Usage

### Basic File Browser

```tsx
import { FileBrowser } from '../components/FileBrowser';

function MyMusicApp() {
  const handleFileSelect = (file) => {
    console.log('Selected:', file.path);
    // Play the music file or process it
  };

  return (
    <FileBrowser
      onFileSelect={handleFileSelect}
      extensions={['mp3', 'wav', 'flac']}
      height={500}
    />
  );
}
```

### Multiple File Selection

```tsx
<FileBrowser
  allowMultipleSelection={true}
  onMultipleFileSelect={(files) => {
    console.log('Selected files:', files.map(f => f.path));
    // Add files to playlist
  }}
  extensions={['mp3', 'flac', 'wav', 'aac']}
  showSearch={true}
  showFilters={true}
  height={600}
/>
```

### Recursive Mode

```tsx
<FileBrowser
  recursive={true}
  extensions={['mp3']}
  onFileSelect={handleFileSelect}
  height={700}
  showSearch={true}
/>
```

## Props Reference

### FileBrowser Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onFileSelect` | `(file: FileItem) => void` | - | Called when a file is selected |
| `onMultipleFileSelect` | `(files: FileItem[]) => void` | - | Called when multiple files are selected |
| `extensions` | `string[]` | `['mp3']` | Allowed file extensions |
| `allowMultipleSelection` | `boolean` | `false` | Enable multiple file selection |
| `height` | `number \| string` | `600` | Component height |
| `showSearch` | `boolean` | `true` | Show search input |
| `showFilters` | `boolean` | `true` | Show filter controls |
| `recursive` | `boolean` | `false` | Enable recursive directory scanning |

## Security Considerations

### Path Restrictions
- All file access is restricted to the user's home directory
- Path traversal attacks are prevented
- Invalid paths throw security errors

### File System Permissions
- Gracefully handles permission errors
- Skips unreadable files/directories
- No elevation of privileges

### Error Handling
- Comprehensive error handling for all file operations
- User-friendly error messages
- Fallback behaviors for common issues

## Performance Considerations

### Large Directories
- Implements efficient directory scanning
- Limits recursion depth to prevent stack overflow
- Streams directory contents for large folders

### Memory Usage
- Doesn't load file contents into memory
- Only reads file metadata
- Efficient filtering and searching

### Network Optimization
- Uses Telefunc for efficient client-server communication
- Minimal data transfer
- Caching of directory listings

## Extension Ideas

### Additional Features
- File preview functionality
- Drag and drop support
- Custom file type icons
- Keyboard navigation
- Sorting options (name, size, date)
- Favorites/bookmarks system

### Integration Examples
- Music player integration
- Playlist management
- File metadata extraction
- Album art display
- Audio waveform preview

## Troubleshooting

### Common Issues

**"Access denied" errors:**
- Ensure the path is within the user's home directory
- Check file system permissions

**Empty directory listings:**
- Verify extension filters are correct
- Check if hidden files need to be included
- Ensure directory exists and is readable

**Performance issues:**
- Limit recursion depth for large directory trees
- Use extension filtering to reduce file count
- Consider pagination for very large directories

**Component not updating:**
- Check that proper keys are used for list items
- Verify state management in parent components
- Ensure proper cleanup of event handlers

This file browser library provides a solid foundation for building music applications with local file system integration while maintaining security and performance best practices.
