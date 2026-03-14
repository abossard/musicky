using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Musicky.ApiService.Models;

public enum EditStatus
{
    Pending,
    Applied,
    Failed
}

[Table("mp3_pending_edits")]
public class Mp3PendingEdit
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("file_path")]
    public string FilePath { get; set; } = string.Empty;

    [Column("original_comment")]
    public string? OriginalComment { get; set; }

    [Required]
    [Column("new_comment")]
    public string NewComment { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("status")]
    public EditStatus Status { get; set; } = EditStatus.Pending;
}