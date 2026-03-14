using Musicky.Tests.TestBase;
using Musicky.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace Musicky.Tests;

/// <summary>
/// Basic page loading tests with real services - NO MOCKS.
/// Full end-to-end behavior testing.
/// </summary>
public class BasicPageTests : FullSystemTestBase
{
    [Fact]
    public async Task Counter_Page_Should_Load_Successfully()
    {
        // Arrange
        await using var page = await CreatePageAsync(TestComplexity.Simple);

        // Act
        await page.NavigateAndWaitForBlazorAsync("/counter");

        // Assert
        var title = await page.UnderlyingPage.TitleAsync();
        title.Should().NotBeNullOrEmpty();
        
        // Check page content
        var content = await page.UnderlyingPage.ContentAsync();
        content.Should().Contain("Counter");
    }

    [Fact]
    public async Task Weather_Page_Should_Load_Successfully()
    {
        // Arrange
        await using var page = await CreatePageAsync(TestComplexity.Simple);

        // Act
        await page.NavigateAndWaitForBlazorAsync("/weather");

        // Assert
        var title = await page.UnderlyingPage.TitleAsync();
        title.Should().NotBeNullOrEmpty();
        
        // Check page content
        var content = await page.UnderlyingPage.ContentAsync();
        content.Should().Contain("Weather");
    }
    /// <summary>
    /// Override to disable audio requirements that cause JS issues.
    /// </summary>
    protected override TestRequirements GetTestRequirements() => new()
    {
        RequiresStability = true,
        RequiresAudio = false,
        RequiresVisualDebugging = false
    };

    /// <summary>
    /// Configure services for real end-to-end testing - NO MOCKS.
    /// </summary>
    protected override void ConfigureTestServices(IServiceCollection services)
    {
        // No mocks - use real services for true behavior testing
    }
}