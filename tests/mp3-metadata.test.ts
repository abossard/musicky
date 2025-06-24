import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MP3MetadataManager } from '../lib/mp3-metadata';
import * as fs from 'fs/promises';
import * as NodeID3 from 'node-id3';

// Mock the dependencies
vi.mock('fs/promises');
vi.mock('node-id3');
vi.mock('../database/sqlite/queries/mp3-edits');
vi.mock('../database/sqlite/queries/mp3-history');

const mockFs = vi.mocked(fs);
const mockNodeID3 = vi.mocked(NodeID3);

describe('MP3MetadataManager', () => {
  let manager: MP3MetadataManager;

  beforeEach(() => {
    manager = new MP3MetadataManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('writeComment', () => {
    it('should successfully write comment to MP3 file', async () => {
      // Mock file system operations
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        size: 1024,
        isFile: () => true,
        mode: 0o644
      } as any);

      // Mock successful NodeID3 update
      mockNodeID3.update.mockReturnValue(true);

      const filePath = './test.mp3';
      const comment = 'Test comment';

      await expect(manager.writeComment(filePath, comment)).resolves.not.toThrow();

      expect(mockFs.access).toHaveBeenCalledWith(filePath);
      expect(mockFs.stat).toHaveBeenCalledWith(filePath);
      expect(mockNodeID3.update).toHaveBeenCalledWith(
        {
          comment: {
            language: 'eng',
            text: comment
          }
        },
        filePath
      );
    });

    it('should throw error when file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(manager.writeComment('./nonexistent.mp3', 'comment'))
        .rejects.toThrow('Failed to write MP3 comment');

      expect(mockNodeID3.update).not.toHaveBeenCalled();
    });

    it('should throw error when NodeID3.update fails', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        size: 1024,
        isFile: () => true,
        mode: 0o644
      } as any);

      // Mock failed NodeID3 update
      mockNodeID3.update.mockReturnValue(false);

      await expect(manager.writeComment('./test.mp3', 'comment'))
        .rejects.toThrow('Failed to write MP3 comment');
    });

    it('should handle empty comment', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        size: 1024,
        isFile: () => true,
        mode: 0o644
      } as any);
      mockNodeID3.update.mockReturnValue(true);

      await expect(manager.writeComment('./test.mp3', '')).resolves.not.toThrow();

      expect(mockNodeID3.update).toHaveBeenCalledWith(
        {
          comment: {
            language: 'eng',
            text: ''
          }
        },
        './test.mp3'
      );
    });

    it('should log detailed information during write process', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        size: 1024,
        isFile: () => true,
        mode: 0o644
      } as any);
      mockNodeID3.update.mockReturnValue(true);

      await manager.writeComment('./test.mp3', 'test comment');

      expect(consoleSpy).toHaveBeenCalledWith('[MP3Manager] Starting writeComment for: ./test.mp3');
      expect(consoleSpy).toHaveBeenCalledWith('[MP3Manager] Comment to write: "test comment"');
      expect(consoleSpy).toHaveBeenCalledWith('[MP3Manager] Successfully wrote comment to: ./test.mp3');

      consoleSpy.mockRestore();
    });
  });

  describe('validateMP3File', () => {
    it('should validate .mp3 files', () => {
      expect(MP3MetadataManager.validateMP3File('test.mp3')).toBe(true);
      expect(MP3MetadataManager.validateMP3File('./path/to/file.mp3')).toBe(true);
      expect(MP3MetadataManager.validateMP3File('/absolute/path/song.MP3')).toBe(true);
    });

    it('should reject non-MP3 files', () => {
      expect(MP3MetadataManager.validateMP3File('test.txt')).toBe(false);
      expect(MP3MetadataManager.validateMP3File('music.wav')).toBe(false);
      expect(MP3MetadataManager.validateMP3File('song.flac')).toBe(false);
      expect(MP3MetadataManager.validateMP3File('noextension')).toBe(false);
    });
  });
});
