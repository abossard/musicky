using Microsoft.Playwright;

namespace Musicky.Tests;

public class PlaywrightSetup : IAsyncLifetime
{
    public static IPlaywright? PlaywrightInstance { get; private set; }

    public async Task InitializeAsync()
    {
        // Install Playwright browsers
        var exitCode = Microsoft.Playwright.Program.Main(new[] { "install", "chromium" });
        if (exitCode != 0)
        {
            throw new InvalidOperationException($"Playwright browser installation failed with exit code {exitCode}");
        }

        // Create Playwright instance
        PlaywrightInstance = await Playwright.CreateAsync();
    }

    public Task DisposeAsync()
    {
        PlaywrightInstance?.Dispose();
        return Task.CompletedTask;
    }
}