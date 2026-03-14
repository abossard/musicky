namespace Musicky.Tests.Fixtures;

public static class TestSets
{
    public static readonly TestSetData[] All = new[]
    {
        new TestSetData("Test Set 1", "First test set for automated testing"),
        new TestSetData("Test Set 2", "Second test set for automated testing"),
        new TestSetData("Empty Test Set", "Test set with no songs")
    };
}

public static class TestSongs
{
    public static readonly TestSongData[] All = new[]
    {
        new TestSongData("Test Song A", "Test Artist 1", "Test Album 1", "/test/path/song-a.mp3"),
        new TestSongData("Test Song B", "Test Artist 2", "Test Album 2", "/test/path/song-b.mp3"),
        new TestSongData("Test Song C", "Test Artist 1", "Test Album 1", "/test/path/song-c.mp3")
    };
}

public static class SearchQueries
{
    public static readonly string[] Valid = new[]
    {
        "Test Song",
        "Test Artist", 
        "Album",
        "song",
        "a"
    };
    
    public static readonly string NoResults = "xyz123";
}

public static class InvalidInputs
{
    public static readonly string[] All = new[]
    {
        "",
        " ",
        "   ",
        new string('a', 1000), // Very long string
        "<script>alert(\"test\")</script>", // XSS attempt
        "DROP TABLE dj_sets;" // SQL injection attempt
    };
}

public record TestSetData(string Name, string Description);
public record TestSongData(string Title, string Artist, string Album, string Path);