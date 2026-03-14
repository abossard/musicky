using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Musicky.ApiService.Models;

[Table("mp3_edit_history")]
public class Mp3EditHistory
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("file_path")]
    public string FilePath { get; set; } = string.Empty;

    [Column("old_comment")]
    public string? OldComment { get; set; }

    [Required]
    [Column("new_comment")]
    public string NewComment { get; set; } = string.Empty;

    [Column("applied_at")]
    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;

    [Column("reverted")]
    public bool Reverted { get; set; } = false;
}