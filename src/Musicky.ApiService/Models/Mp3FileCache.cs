using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Musicky.ApiService.Models;

[Table("mp3_file_cache")]
public class Mp3FileCache
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("file_path")]
    public string FilePath { get; set; } = string.Empty;

    [Required]
    [Column("filename")]
    public string Filename { get; set; } = string.Empty;

    [Column("artist")]
    public string? Artist { get; set; }

    [Column("title")]
    public string? Title { get; set; }

    [Column("album")]
    public string? Album { get; set; }

    [Column("duration")]
    public int? Duration { get; set; }

    [Column("file_size")]
    public long? FileSize { get; set; }

    [Column("last_modified")]
    public DateTime? LastModified { get; set; }

    [Column("indexed_at")]
    public DateTime IndexedAt { get; set; } = DateTime.UtcNow;
}