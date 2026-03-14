using System.Security;

namespace Musicky.ApiService.Services;

public interface IFileBrowserService
{
    Task<IEnumerable<FileItem>> GetDirectoryContentsAsync(string path, string[]? extensions = null);
    Task<bool> IsValidPathAsync(string path);
    Task<FileItem?> GetFileInfoAsync(string filePath);
    string GetUserHomeDirectory();
}

public class FileItem
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public bool IsDirectory { get; set; }
    public long Size { get; set; }
    public DateTime LastModified { get; set; }
    public string Extension { get; set; } = string.Empty;
}

public class FileBrowserService : IFileBrowserService
{
    private readonly ILogger<FileBrowserService> _logger;
    private readonly string _homeDirectory;

    public FileBrowserService(ILogger<FileBrowserService> logger)
    {
        _logger = logger;
        _homeDirectory = GetUserHomeDirectory();
    }

    public string GetUserHomeDirectory()
    {
        return Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    }

    public Task<bool> IsValidPathAsync(string path)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path))
                return Task.FromResult(false);

            var fullPath = Path.GetFullPath(path);
            
            // Security check: ensure path is within user's home directory
            if (!fullPath.StartsWith(_homeDirectory, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Attempted access outside home directory: {Path}", path);
                return Task.FromResult(false);
            }

            return Task.FromResult(Directory.Exists(fullPath) || File.Exists(fullPath));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating path: {Path}", path);
            return Task.FromResult(false);
        }
    }

    public async Task<IEnumerable<FileItem>> GetDirectoryContentsAsync(string path, string[]? extensions = null)
    {
        try
        {
            if (!await IsValidPathAsync(path))
            {
                return Enumerable.Empty<FileItem>();
            }

            var fullPath = Path.GetFullPath(path);
            if (!Directory.Exists(fullPath))
            {
                return Enumerable.Empty<FileItem>();
            }

            var items = new List<FileItem>();

            // Add directories
            var directories = Directory.GetDirectories(fullPath);
            foreach (var dir in directories)
            {
                try
                {
                    var dirInfo = new DirectoryInfo(dir);
                    if (dirInfo.Attributes.HasFlag(FileAttributes.Hidden))
                        continue;

                    items.Add(new FileItem
                    {
                        Name = dirInfo.Name,
                        Path = dirInfo.FullName,
                        IsDirectory = true,
                        LastModified = dirInfo.LastWriteTime
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Skipping directory due to access error: {Directory}", dir);
                }
            }

            // Add files
            var files = Directory.GetFiles(fullPath);
            foreach (var file in files)
            {
                try
                {
                    var fileInfo = new FileInfo(file);
                    if (fileInfo.Attributes.HasFlag(FileAttributes.Hidden))
                        continue;

                    var extension = fileInfo.Extension.ToLowerInvariant();
                    
                    // Filter by extensions if specified
                    if (extensions != null && extensions.Length > 0)
                    {
                        if (!extensions.Any(ext => extension.Equals($".{ext.TrimStart('.')}", StringComparison.OrdinalIgnoreCase)))
                        {
                            continue;
                        }
                    }

                    items.Add(new FileItem
                    {
                        Name = fileInfo.Name,
                        Path = fileInfo.FullName,
                        IsDirectory = false,
                        Size = fileInfo.Length,
                        LastModified = fileInfo.LastWriteTime,
                        Extension = extension
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(ex, "Skipping file due to access error: {File}", file);
                }
            }

            return items.OrderBy(x => x.IsDirectory ? 0 : 1)
                       .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting directory contents: {Path}", path);
            return Enumerable.Empty<FileItem>();
        }
    }

    public async Task<FileItem?> GetFileInfoAsync(string filePath)
    {
        try
        {
            if (!await IsValidPathAsync(filePath))
                return null;

            var fullPath = Path.GetFullPath(filePath);
            
            if (File.Exists(fullPath))
            {
                var fileInfo = new FileInfo(fullPath);
                return new FileItem
                {
                    Name = fileInfo.Name,
                    Path = fileInfo.FullName,
                    IsDirectory = false,
                    Size = fileInfo.Length,
                    LastModified = fileInfo.LastWriteTime,
                    Extension = fileInfo.Extension.ToLowerInvariant()
                };
            }
            else if (Directory.Exists(fullPath))
            {
                var dirInfo = new DirectoryInfo(fullPath);
                return new FileItem
                {
                    Name = dirInfo.Name,
                    Path = dirInfo.FullName,
                    IsDirectory = true,
                    LastModified = dirInfo.LastWriteTime
                };
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting file info: {FilePath}", filePath);
            return null;
        }
    }
}