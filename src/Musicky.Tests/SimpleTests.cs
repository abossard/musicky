using Microsoft.Playwright;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Musicky.Tests;

public class SimpleTests : IAsyncLifetime
{
    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private WebApplicationFactory<Program>? _factory;
    private string _baseUrl = "";

    public async Task InitializeAsync()
    {
        // Create Playwright
        _playwright = await Playwright.CreateAsync();
        _browser = await _playwright.Chromium.LaunchAsync(new() { Headless = true });

        // Create test application
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.ConfigureServices(services =>
                {
                    // Configure test-specific services if needed
                });
            });

        // Start the web application - don't specify URLs, let factory handle it
        var client = _factory.CreateClient();
        _baseUrl = client.BaseAddress?.ToString().TrimEnd('/') ?? "http://localhost:5000";
    }

    public async Task DisposeAsync()
    {
        if (_browser != null)
            await _browser.CloseAsync();
        _playwright?.Dispose();
        _factory?.Dispose();
    }

    [Fact]
    public async Task Home_Page_Should_Load()
    {
        // Arrange
        var page = await _browser!.NewPageAsync();

        try
        {
            // Act
            await page.GotoAsync(_baseUrl);
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            // Assert
            var title = await page.TitleAsync();
            title.Should().NotBeNullOrEmpty();

            // Check for basic page elements
            var content = await page.ContentAsync();
            content.Should().Contain("Musicky");
        }
        finally
        {
            await page.CloseAsync();
        }
    }

    [Fact]
    public async Task DJ_Sets_Page_Should_Be_Accessible()
    {
        // Arrange
        var page = await _browser!.NewPageAsync();

        try
        {
            // Act
            await page.GotoAsync($"{_baseUrl}/dj-sets");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            // Assert
            var title = await page.TitleAsync();
            title.Should().NotBeNullOrEmpty();

            // Check page loaded successfully (not 404)
            var content = await page.ContentAsync();
            content.Should().NotContain("404");
            content.Should().NotContain("Not Found");
        }
        finally
        {
            await page.CloseAsync();
        }
    }

    [Fact]
    public async Task MP3_Library_Page_Should_Be_Accessible()
    {
        // Arrange
        var page = await _browser!.NewPageAsync();

        try
        {
            // Act
            await page.GotoAsync($"{_baseUrl}/mp3-library");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            // Assert
            var title = await page.TitleAsync();
            title.Should().NotBeNullOrEmpty();

            // Check page loaded successfully
            var content = await page.ContentAsync();
            content.Should().NotContain("404");
            content.Should().NotContain("Not Found");
        }
        finally
        {
            await page.CloseAsync();
        }
    }

    [Fact]
    public async Task File_Browser_Page_Should_Be_Accessible()
    {
        // Arrange
        var page = await _browser!.NewPageAsync();

        try
        {
            // Act
            await page.GotoAsync($"{_baseUrl}/file-browser");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            // Assert
            var title = await page.TitleAsync();
            title.Should().NotBeNullOrEmpty();

            // Check page loaded successfully
            var content = await page.ContentAsync();
            content.Should().NotContain("404");
            content.Should().NotContain("Not Found");
        }
        finally
        {
            await page.CloseAsync();
        }
    }

    [Fact]
    public async Task Navigation_Links_Should_Be_Present()
    {
        // Arrange
        var page = await _browser!.NewPageAsync();

        try
        {
            // Act
            await page.GotoAsync(_baseUrl);
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);

            // Assert - Check navigation elements exist
            var content = await page.ContentAsync();
            content.Should().Contain("Home");
            content.Should().Contain("DJ Sets");
            content.Should().Contain("MP3 Library");
            content.Should().Contain("File Browser");
        }
        finally
        {
            await page.CloseAsync();
        }
    }
}