using Microsoft.EntityFrameworkCore;
using Musicky.ApiService.Models;

namespace Musicky.ApiService.Data;

public class MusickyDbContext : DbContext
{
    public MusickyDbContext(DbContextOptions<MusickyDbContext> options) : base(options)
    {
    }

    public DbSet<DjSet> DjSets { get; set; }
    public DbSet<DjSetItem> DjSetItems { get; set; }
    public DbSet<Mp3FileCache> Mp3FileCache { get; set; }
    public DbSet<Mp3PendingEdit> Mp3PendingEdits { get; set; }
    public DbSet<Mp3EditHistory> Mp3EditHistory { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure DjSet
        modelBuilder.Entity<DjSet>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.HasMany(e => e.Items)
                  .WithOne(e => e.DjSet)
                  .HasForeignKey(e => e.SetId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure DjSetItem
        modelBuilder.Entity<DjSetItem>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FilePath).IsRequired();
            entity.HasIndex(e => e.SetId);
            entity.HasIndex(e => new { e.SetId, e.Position });
        });

        // Configure Mp3FileCache
        modelBuilder.Entity<Mp3FileCache>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FilePath).IsRequired();
            entity.HasIndex(e => e.FilePath).IsUnique();
            entity.HasIndex(e => new { e.Artist, e.Title, e.Filename });
        });

        // Configure Mp3PendingEdit
        modelBuilder.Entity<Mp3PendingEdit>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FilePath).IsRequired();
            entity.Property(e => e.NewComment).IsRequired();
            entity.Property(e => e.Status)
                  .HasConversion<string>();
        });

        // Configure Mp3EditHistory
        modelBuilder.Entity<Mp3EditHistory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FilePath).IsRequired();
            entity.Property(e => e.NewComment).IsRequired();
        });
    }
}