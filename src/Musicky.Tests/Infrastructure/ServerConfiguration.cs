namespace Musicky.Tests.Infrastructure;

/// <summary>
/// Pure calculation functions for server configuration.
/// No side effects - just data transformations.
/// </summary>
public static class ServerConfiguration
{
    /// <summary>
    /// Calculate timeout values based on operation type.
    /// Pure function: same input -> same output
    /// </summary>
    public static TimeoutSettings CalculateTimeouts(TestComplexity complexity)
    {
        return complexity switch
        {
            TestComplexity.Simple => new(pageLoad: 3000, blazorRender: 1000, jsInit: 2000),
            TestComplexity.Interactive => new(pageLoad: 5000, blazorRender: 2000, jsInit: 3000),
            TestComplexity.Complex => new(pageLoad: 10000, blazorRender: 5000, jsInit: 5000),
            _ => new(pageLoad: 5000, blazorRender: 2000, jsInit: 3000)
        };
    }

    /// <summary>
    /// Calculate browser options based on test requirements.
    /// Pure function for browser configuration.
    /// </summary>
    public static BrowserSettings CalculateBrowserSettings(TestRequirements requirements)
    {
        return new BrowserSettings
        {
            Headless = !requirements.RequiresVisualDebugging,
            SlowMo = requirements.RequiresStability ? 100 : 0,
            ViewportWidth = requirements.RequiresMobile ? 375 : 1280,
            ViewportHeight = requirements.RequiresMobile ? 667 : 720,
            Permissions = CalculatePermissions(requirements)
        };
    }

    /// <summary>
    /// Calculate required browser permissions.
    /// Pure function - no side effects.
    /// </summary>
    private static string[] CalculatePermissions(TestRequirements requirements)
    {
        var permissions = new List<string>();
        
        if (requirements.RequiresAudio)
            permissions.Add("autoplay-policy");
        
        if (requirements.RequiresFileAccess)
            permissions.Add("clipboard-read");
            
        return permissions.ToArray();
    }
}

public enum TestComplexity
{
    Simple,
    Interactive, 
    Complex
}

public record TimeoutSettings(int pageLoad, int blazorRender, int jsInit);

public record BrowserSettings
{
    public bool Headless { get; init; }
    public int SlowMo { get; init; }
    public int ViewportWidth { get; init; }
    public int ViewportHeight { get; init; }
    public string[] Permissions { get; init; } = Array.Empty<string>();
}

public record TestRequirements
{
    public bool RequiresVisualDebugging { get; init; }
    public bool RequiresStability { get; init; }
    public bool RequiresMobile { get; init; }
    public bool RequiresAudio { get; init; }
    public bool RequiresFileAccess { get; init; }
}