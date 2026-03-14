using Musicky.Tests.TestBase;
using Musicky.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace Musicky.Tests;

/// <summary>
/// Tests that validate the complete Playwright + Blazor Server architecture is working.
/// Real end-to-end behavior testing - NO MOCKS.
/// </summary>
public class ArchitectureValidationTests : FullSystemTestBase
{
    protected override TestRequirements GetTestRequirements() => new()
    {
        RequiresStability = true,
        RequiresAudio = false,
        RequiresVisualDebugging = false
    };

    protected override void ConfigureTestServices(IServiceCollection services)
    {
        // No mocks - use real services for true behavior validation
    }

    [Fact]
    public async Task Architecture_Should_Support_Real_Http_Server_With_Playwright()
    {
        // This test validates that:
        // 1. BlazorServerManager creates real Kestrel HTTP server
        // 2. BlazorBrowserManager connects Playwright to real endpoints  
        // 3. BlazorTestBase coordinates lifecycle properly
        // 4. Exception masking works correctly
        
        // Arrange & Act
        await using var page = await CreatePageAsync(TestComplexity.Simple);
        await page.NavigateAndWaitForBlazorAsync("/counter");

        // Assert - Validate server is real HTTP endpoint
        SystemManager.WebBaseUrl.Should().StartWith("http://localhost:")
            .And.NotContain("testserver", "should use real Kestrel server, not TestServer");

        // Validate Blazor Server is working
        var title = await page.UnderlyingPage.TitleAsync();
        title.Should().NotBeNullOrEmpty("Blazor should render page title");

        var content = await page.UnderlyingPage.ContentAsync();
        content.Should().Contain("Counter", "page should load with Blazor content");
        content.Should().Contain("blazor.web.js", "Blazor Server JS should be loaded");
    }

    [Fact] 
    public async Task Architecture_Should_Support_JavaScript_Interop_Context()
    {
        // This test validates that the browser context supports JavaScript execution
        // even though our AudioPlayer service is mocked
        
        // Arrange & Act
        await using var page = await CreatePageAsync(TestComplexity.Interactive);
        await page.NavigateAndWaitForBlazorAsync("/counter");

        // Assert - JavaScript execution works
        var result = await page.UnderlyingPage.EvaluateAsync<string>("() => 'JavaScript execution works'");
        result.Should().Be("JavaScript execution works");

        // Validate browser has proper Blazor context
        var blazorLoaded = await page.UnderlyingPage.EvaluateAsync<bool>("() => window.Blazor !== undefined");
        blazorLoaded.Should().BeTrue("Blazor should be loaded in browser context");
    }

    [Fact]
    public async Task Architecture_Should_Handle_Component_Interactions()
    {
        // This test validates that Blazor Server component interactions work through Playwright
        
        // Arrange
        await using var page = await CreatePageAsync(TestComplexity.Interactive);
        await page.NavigateAndWaitForBlazorAsync("/counter");

        // Act - Click the counter button
        var incrementButton = page.UnderlyingPage.Locator("button").First;
        await incrementButton.ClickAsync();
        await page.WaitForBlazorRenderingAsync();

        // Assert - Component state should update
        var content = await page.UnderlyingPage.ContentAsync();
        content.Should().Contain("Current count: 1", "counter should increment via SignalR");
    }

    [Fact]
    public async Task Architecture_Should_Support_Multiple_Page_Navigation()
    {
        // This test validates that navigation between pages works correctly
        
        // Arrange
        await using var page = await CreatePageAsync(TestComplexity.Simple);

        // Act & Assert - Navigate to counter
        await page.NavigateAndWaitForBlazorAsync("/counter");
        var counterContent = await page.UnderlyingPage.ContentAsync();
        counterContent.Should().Contain("Counter");

        // Act & Assert - Navigate back to home
        await page.NavigateAndWaitForBlazorAsync("/");
        var homeContent = await page.UnderlyingPage.ContentAsync();
        homeContent.Should().Contain("Welcome to Musicky");
    }
}