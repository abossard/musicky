using Microsoft.EntityFrameworkCore;
using Musicky.ApiService.Data;
using Musicky.ApiService.Models;

namespace Musicky.ApiService.Services;

public interface IDjSetService
{
    Task<IEnumerable<DjSet>> GetAllSetsAsync();
    Task<DjSet?> GetSetByIdAsync(int id);
    Task<DjSet> CreateSetAsync(string name, string? description = null);
    Task<bool> UpdateSetAsync(int id, string name, string? description = null);
    Task<bool> DeleteSetAsync(int id);
    Task<IEnumerable<DjSetItem>> GetSetItemsAsync(int setId);
    Task<DjSetItem> AddSongToSetAsync(int setId, string filePath, int? position = null);
    Task<bool> RemoveSongFromSetAsync(int itemId);
    Task<bool> ReorderSetItemsAsync(int setId, Dictionary<int, int> itemPositions);
}

public class DjSetService : IDjSetService
{
    private readonly MusickyDbContext _context;
    private readonly ILogger<DjSetService> _logger;

    public DjSetService(MusickyDbContext context, ILogger<DjSetService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<IEnumerable<DjSet>> GetAllSetsAsync()
    {
        return await _context.DjSets
            .Include(s => s.Items)
            .OrderByDescending(s => s.UpdatedAt)
            .ToListAsync();
    }

    public async Task<DjSet?> GetSetByIdAsync(int id)
    {
        return await _context.DjSets
            .Include(s => s.Items.OrderBy(i => i.Position))
            .FirstOrDefaultAsync(s => s.Id == id);
    }

    public async Task<DjSet> CreateSetAsync(string name, string? description = null)
    {
        var djSet = new DjSet
        {
            Name = name,
            Description = description,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.DjSets.Add(djSet);
        await _context.SaveChangesAsync();

        return djSet;
    }

    public async Task<bool> UpdateSetAsync(int id, string name, string? description = null)
    {
        var djSet = await _context.DjSets.FindAsync(id);
        if (djSet == null)
            return false;

        djSet.Name = name;
        djSet.Description = description;
        djSet.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteSetAsync(int id)
    {
        var djSet = await _context.DjSets.FindAsync(id);
        if (djSet == null)
            return false;

        _context.DjSets.Remove(djSet);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<DjSetItem>> GetSetItemsAsync(int setId)
    {
        return await _context.DjSetItems
            .Where(i => i.SetId == setId)
            .OrderBy(i => i.Position)
            .ToListAsync();
    }

    public async Task<DjSetItem> AddSongToSetAsync(int setId, string filePath, int? position = null)
    {
        // If no position specified, add to end
        if (position == null)
        {
            var maxPosition = await _context.DjSetItems
                .Where(i => i.SetId == setId)
                .MaxAsync(i => (int?)i.Position) ?? -1;
            position = maxPosition + 1;
        }
        else
        {
            // Shift existing items to make room
            var itemsToShift = await _context.DjSetItems
                .Where(i => i.SetId == setId && i.Position >= position)
                .ToListAsync();

            foreach (var item in itemsToShift)
            {
                item.Position++;
            }
        }

        var newItem = new DjSetItem
        {
            SetId = setId,
            FilePath = filePath,
            Position = position.Value,
            AddedAt = DateTime.UtcNow
        };

        _context.DjSetItems.Add(newItem);

        // Update set's updated_at timestamp
        var djSet = await _context.DjSets.FindAsync(setId);
        if (djSet != null)
        {
            djSet.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return newItem;
    }

    public async Task<bool> RemoveSongFromSetAsync(int itemId)
    {
        var item = await _context.DjSetItems.FindAsync(itemId);
        if (item == null)
            return false;

        var setId = item.SetId;
        var position = item.Position;

        _context.DjSetItems.Remove(item);

        // Shift remaining items down
        var itemsToShift = await _context.DjSetItems
            .Where(i => i.SetId == setId && i.Position > position)
            .ToListAsync();

        foreach (var shiftItem in itemsToShift)
        {
            shiftItem.Position--;
        }

        // Update set's updated_at timestamp
        var djSet = await _context.DjSets.FindAsync(setId);
        if (djSet != null)
        {
            djSet.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ReorderSetItemsAsync(int setId, Dictionary<int, int> itemPositions)
    {
        try
        {
            var items = await _context.DjSetItems
                .Where(i => i.SetId == setId)
                .ToListAsync();

            foreach (var item in items)
            {
                if (itemPositions.TryGetValue(item.Id, out int newPosition))
                {
                    item.Position = newPosition;
                }
            }

            // Update set's updated_at timestamp
            var djSet = await _context.DjSets.FindAsync(setId);
            if (djSet != null)
            {
                djSet.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reordering set items for set {SetId}", setId);
            return false;
        }
    }
}