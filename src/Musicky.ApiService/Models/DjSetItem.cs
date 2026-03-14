using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Musicky.ApiService.Models;

[Table("dj_set_items")]
public class DjSetItem
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("set_id")]
    public int SetId { get; set; }

    [Required]
    [Column("file_path")]
    public string FilePath { get; set; } = string.Empty;

    [Column("position")]
    public int Position { get; set; }

    [Column("added_at")]
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(SetId))]
    public DjSet DjSet { get; set; } = null!;
}