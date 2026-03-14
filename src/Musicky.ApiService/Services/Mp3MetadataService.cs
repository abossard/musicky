using TagLib;
using Musicky.ApiService.Models;
using Musicky.ApiService.Data;
using Microsoft.EntityFrameworkCore;

namespace Musicky.ApiService.Services;

public interface IMp3MetadataService
{
    Task<Mp3FileCache?> GetMetadataAsync(string filePath);
    Task<Mp3FileCache> CacheMetadataAsync(string filePath);
    Task<IEnumerable<Mp3FileCache>> SearchCachedMetadataAsync(string query, int limit = 50);
    Task<bool> UpdateMetadataAsync(string filePath, string newComment);
    Task<bool> ApplyPendingEditsAsync();
    Task<IEnumerable<Mp3PendingEdit>> GetPendingEditsAsync();
    Task AddPendingEditAsync(string filePath, string originalComment, string newComment);
}

public class Mp3MetadataService : IMp3MetadataService
{
    private readonly MusickyDbContext _context;
    private readonly ILogger<Mp3MetadataService> _logger;

    public Mp3MetadataService(MusickyDbContext context, ILogger<Mp3MetadataService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<Mp3FileCache?> GetMetadataAsync(string filePath)
    {
        try
        {
            // First check cache
            var cached = await _context.Mp3FileCache
                .FirstOrDefaultAsync(x => x.FilePath == filePath);

            if (cached != null)
            {
                var fileInfo = new FileInfo(filePath);
                if (fileInfo.Exists && fileInfo.LastWriteTime <= cached.LastModified)
                {
                    return cached;
                }
            }

            // Cache miss or file updated, read from file
            return await CacheMetadataAsync(filePath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting metadata for {FilePath}", filePath);
            return null;
        }
    }

    public async Task<Mp3FileCache> CacheMetadataAsync(string filePath)
    {
        try
        {
            var fileInfo = new FileInfo(filePath);
            if (!fileInfo.Exists)
            {
                throw new FileNotFoundException($"File not found: {filePath}");
            }

            using var file = TagLib.File.Create(filePath);
            var tag = file.Tag;

            var metadata = new Mp3FileCache
            {
                FilePath = filePath,
                Filename = Path.GetFileName(filePath),
                Artist = tag.FirstPerformer,
                Title = tag.Title,
                Album = tag.Album,
                Duration = file.Properties.Duration.TotalSeconds > 0 ? (int)file.Properties.Duration.TotalSeconds : null,
                FileSize = fileInfo.Length,
                LastModified = fileInfo.LastWriteTime,
                IndexedAt = DateTime.UtcNow
            };

            // Update or insert
            var existing = await _context.Mp3FileCache
                .FirstOrDefaultAsync(x => x.FilePath == filePath);

            if (existing != null)
            {
                existing.Filename = metadata.Filename;
                existing.Artist = metadata.Artist;
                existing.Title = metadata.Title;
                existing.Album = metadata.Album;
                existing.Duration = metadata.Duration;
                existing.FileSize = metadata.FileSize;
                existing.LastModified = metadata.LastModified;
                existing.IndexedAt = metadata.IndexedAt;
            }
            else
            {
                _context.Mp3FileCache.Add(metadata);
                existing = metadata;
            }

            await _context.SaveChangesAsync();
            return existing;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error caching metadata for {FilePath}", filePath);
            throw;
        }
    }

    public async Task<IEnumerable<Mp3FileCache>> SearchCachedMetadataAsync(string query, int limit = 50)
    {
        var searchTerm = $"%{query}%";
        
        return await _context.Mp3FileCache
            .Where(x => EF.Functions.Like(x.Artist, searchTerm) ||
                       EF.Functions.Like(x.Title, searchTerm) ||
                       EF.Functions.Like(x.Filename, searchTerm))
            .OrderBy(x => EF.Functions.Like(x.Title, searchTerm) ? 1 :
                         EF.Functions.Like(x.Artist, searchTerm) ? 2 : 3)
            .ThenBy(x => x.Artist)
            .ThenBy(x => x.Title)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<bool> UpdateMetadataAsync(string filePath, string newComment)
    {
        try
        {
            using var file = TagLib.File.Create(filePath);
            var originalComment = file.Tag.Comment;
            
            file.Tag.Comment = newComment;
            file.Save();

            // Record in history
            var history = new Mp3EditHistory
            {
                FilePath = filePath,
                OldComment = originalComment,
                NewComment = newComment,
                AppliedAt = DateTime.UtcNow
            };

            _context.Mp3EditHistory.Add(history);
            await _context.SaveChangesAsync();

            // Update cache
            await CacheMetadataAsync(filePath);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating metadata for {FilePath}", filePath);
            return false;
        }
    }

    public async Task<bool> ApplyPendingEditsAsync()
    {
        var pendingEdits = await _context.Mp3PendingEdits
            .Where(x => x.Status == EditStatus.Pending)
            .ToListAsync();

        int successCount = 0;
        
        foreach (var edit in pendingEdits)
        {
            try
            {
                if (await UpdateMetadataAsync(edit.FilePath, edit.NewComment))
                {
                    edit.Status = EditStatus.Applied;
                    successCount++;
                }
                else
                {
                    edit.Status = EditStatus.Failed;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to apply edit {EditId}", edit.Id);
                edit.Status = EditStatus.Failed;
            }
        }

        await _context.SaveChangesAsync();
        return successCount == pendingEdits.Count;
    }

    public async Task<IEnumerable<Mp3PendingEdit>> GetPendingEditsAsync()
    {
        return await _context.Mp3PendingEdits
            .Where(x => x.Status == EditStatus.Pending)
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();
    }

    public async Task AddPendingEditAsync(string filePath, string originalComment, string newComment)
    {
        var edit = new Mp3PendingEdit
        {
            FilePath = filePath,
            OriginalComment = originalComment,
            NewComment = newComment,
            CreatedAt = DateTime.UtcNow,
            Status = EditStatus.Pending
        };

        _context.Mp3PendingEdits.Add(edit);
        await _context.SaveChangesAsync();
    }
}