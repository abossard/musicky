using System.Text.Json;

namespace Musicky.Web.Services;

public class MusickyApiClient
{
    private readonly HttpClient _httpClient;
    private readonly JsonSerializerOptions _jsonOptions;

    public MusickyApiClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
    }

    // DJ Sets API
    public async Task<IEnumerable<DjSet>> GetDjSetsAsync()
    {
        var response = await _httpClient.GetStringAsync("/api/dj-sets");
        return JsonSerializer.Deserialize<IEnumerable<DjSet>>(response, _jsonOptions) ?? [];
    }

    public async Task<DjSet?> GetDjSetAsync(int id)
    {
        try
        {
            var response = await _httpClient.GetStringAsync($"/api/dj-sets/{id}");
            return JsonSerializer.Deserialize<DjSet>(response, _jsonOptions);
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    public async Task<DjSet> CreateDjSetAsync(string name, string? description = null)
    {
        var request = new { Name = name, Description = description };
        var json = JsonSerializer.Serialize(request, _jsonOptions);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
        
        var response = await _httpClient.PostAsync("/api/dj-sets", content);
        response.EnsureSuccessStatusCode();
        
        var responseJson = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<DjSet>(responseJson, _jsonOptions)!;
    }

    // MP3 Search API
    public async Task<IEnumerable<Mp3FileInfo>> SearchMp3Async(string query, int limit = 50)
    {
        var response = await _httpClient.GetStringAsync($"/api/mp3/search?query={Uri.EscapeDataString(query)}&limit={limit}");
        return JsonSerializer.Deserialize<IEnumerable<Mp3FileInfo>>(response, _jsonOptions) ?? [];
    }

    // File Browser API
    public async Task<IEnumerable<FileItem>> GetFilesAsync(string path, string[]? extensions = null)
    {
        var url = $"/api/files?path={Uri.EscapeDataString(path)}";
        if (extensions?.Length > 0)
        {
            url += "&" + string.Join("&", extensions.Select(ext => $"extensions={Uri.EscapeDataString(ext)}"));
        }
        
        var response = await _httpClient.GetStringAsync(url);
        return JsonSerializer.Deserialize<IEnumerable<FileItem>>(response, _jsonOptions) ?? [];
    }
}

// DTOs
public class DjSet
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<DjSetItem> Items { get; set; } = new();
}

public class DjSetItem
{
    public int Id { get; set; }
    public int SetId { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public int Position { get; set; }
    public DateTime AddedAt { get; set; }
}

public class Mp3FileInfo
{
    public int Id { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public string Filename { get; set; } = string.Empty;
    public string? Artist { get; set; }
    public string? Title { get; set; }
    public string? Album { get; set; }
    public int? Duration { get; set; }
    public long? FileSize { get; set; }
    public DateTime? LastModified { get; set; }
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