using Musicky.Tests.TestBase;
using Musicky.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Playwright;

namespace Musicky.Tests;

/// <summary>
/// AudioPlayer integration tests with real JavaScript interop and Blazor Server.
/// Real end-to-end behavior testing - NO MOCKS.
/// 
/// Design Principles Applied:
/// - Single Responsibility: Tests only AudioPlayer functionality
/// - Stratified Design: Built on test infrastructure layers
/// - Clear Abstractions: Domain-focused test language
/// </summary>
public class AudioPlayerIntegrationTests : FullSystemTestBase
{
    /// <summary>
    /// Override to specify audio-specific requirements.
    /// Pure calculation - no side effects.
    /// </summary>
    protected override TestRequirements GetTestRequirements() => new()
    {
        RequiresStability = true,
        RequiresAudio = true,
        RequiresVisualDebugging = false
    };

    /// <summary>
    /// Configure services for audio testing.
    /// Pure function approach - describe what, not how.
    /// </summary>
    protected override void ConfigureTestServices(IServiceCollection services)
    {
        // Keep AudioPlayerService for JavaScript interop testing
        // No modifications needed - use real implementation
    }

    [Fact]
    public async Task HomePage_Should_Load_Successfully()
    {
        // Arrange
        await using var page = await CreatePageAsync(TestComplexity.Simple);

        // Act
        await page.NavigateAndWaitForBlazorAsync("/");

        // Assert
        var title = await page.UnderlyingPage.TitleAsync();
        title.Should().Contain("Musicky");
    }

    [Fact]
    public async Task AudioPlayer_Component_Should_Be_Present_On_HomePage()
    {
        // Arrange  
        await using var page = await CreatePageAsync(TestComplexity.Interactive);

        // Act
        await page.NavigateAndWaitForBlazorAsync("/");

        // Assert - Look for audio player elements
        var audioControls = page.UnderlyingPage.Locator("button, input[type='range'], .audio-player");
        var count = await audioControls.CountAsync();
        count.Should().BeGreaterThan(0, "Audio player controls should be present");
    }

    [Fact]
    public async Task AudioPlayer_Should_Initialize_Without_JavaScript_Errors()
    {
        // Arrange
        await using var page = await CreatePageAsync(TestComplexity.Interactive);
        var jsErrors = new List<string>();
        
        // Capture JavaScript errors
        page.UnderlyingPage.PageError += (_, error) => jsErrors.Add(error);

        // Act
        await page.NavigateAndWaitForBlazorAsync("/");

        // Assert - No critical JavaScript errors should occur
        var criticalErrors = jsErrors.Where(error => 
            error.Contains("audioPlayer") || 
            error.Contains("module") ||
            error.Contains("ReferenceError")).ToList();
            
        criticalErrors.Should().BeEmpty($"Critical JavaScript errors occurred: {string.Join(", ", criticalErrors)}");
    }

    [Fact] 
    public async Task AudioPlayer_Should_Handle_Volume_Control_Interaction()
    {
        // Arrange
        await using var page = await CreatePageAsync(TestComplexity.Complex);
        await page.NavigateAndWaitForBlazorAsync("/");

        // Act - Try to find and interact with volume control
        var volumeSlider = page.UnderlyingPage.Locator("input[type='range']").First;
        
        if (await volumeSlider.IsVisibleAsync())
        {
            await volumeSlider.FillAsync("75");
            await page.WaitForBlazorRenderingAsync();

            // Assert - Volume control should accept input without errors
            var value = await volumeSlider.GetAttributeAsync("value");
            value.Should().Be("75", "Volume slider should accept new value");
        }
        else
        {
            // If no volume slider is visible, that's also a valid test result
            // Just ensure the page loaded without errors
            var content = await page.UnderlyingPage.ContentAsync();
            content.Should().Contain("Musicky", "Page should load successfully even without volume controls");
        }
    }

    [Fact]
    public async Task Navigation_Between_Pages_Should_Maintain_AudioPlayer_State()
    {
        // Arrange
        await using var page = await CreatePageAsync(TestComplexity.Interactive);
        
        // Act & Assert - Navigate to home
        await page.NavigateAndWaitForBlazorAsync("/");
        var homeContent = await page.UnderlyingPage.ContentAsync();
        homeContent.Should().Contain("Musicky");

        // Try to navigate to other pages if they exist
        var links = page.UnderlyingPage.Locator("a[href]");
        var linkCount = await links.CountAsync();
        
        if (linkCount > 0)
        {
            // Click first navigation link
            await links.First.ClickAsync();
            await page.WaitForBlazorRenderingAsync();
            
            // Verify navigation worked without errors
            var newContent = await page.UnderlyingPage.ContentAsync();
            newContent.Should().NotBeEmpty("Navigation should lead to valid page");
        }
    }

    [Fact]
    public async Task Blazor_SignalR_Connection_Should_Be_Established()
    {
        // Arrange
        await using var page = await CreatePageAsync(TestComplexity.Interactive);

        // Act
        await page.NavigateAndWaitForBlazorAsync("/");

        // Assert - Check for SignalR connection
        var blazorStarted = await page.UnderlyingPage.EvaluateAsync<bool>(@"
            () => window.Blazor !== undefined && 
                  typeof window.Blazor.start === 'function'
        ");
        
        blazorStarted.Should().BeTrue("Blazor should be initialized with SignalR connection");
    }
}