using Musicky.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace Musicky.Tests.TestBase;

/// <summary>
/// Simple, composable test base using stratified design principles.
/// 
/// Design Principles Applied:
/// - Composition over Inheritance: Uses manager instances rather than deep inheritance
/// - Single Responsibility: Only coordinates test lifecycle
/// - Information Hiding: Hides infrastructure complexity behind simple interface
/// - Temporal Coupling Control: Manages initialization order explicitly
/// </summary>
public abstract class BlazorTestBase : IAsyncLifetime
{
    private BlazorServerManager? _serverManager;
    private BlazorBrowserManager? _browserManager;

    protected string BaseUrl => _serverManager?.BaseUrl ?? 
        throw new InvalidOperationException("Server not initialized - call base.InitializeAsync() first");

    protected BlazorBrowserManager Browser => _browserManager ?? 
        throw new InvalidOperationException("Browser not initialized - call base.InitializeAsync() first");

    /// <summary>
    /// Template method that can be overridden for test-specific requirements.
    /// Default provides sensible defaults for most Blazor Server scenarios.
    /// </summary>
    protected virtual TestRequirements GetTestRequirements() => new()
    {
        RequiresStability = true,
        RequiresAudio = false,
        RequiresVisualDebugging = false
    };

    /// <summary>
    /// Template method for service configuration.
    /// Pure function approach - no side effects in override.
    /// </summary>
    protected virtual void ConfigureTestServices(IServiceCollection services)
    {
        // Default: no additional configuration
        // Subclasses can override for specific needs
    }

    /// <summary>
    /// Managed initialization with clear temporal ordering.
    /// Actions sequenced to avoid temporal coupling issues.
    /// </summary>
    public async Task InitializeAsync()
    {
        try
        {
            // Step 1: Start server (creates real HTTP endpoints)
            _serverManager = await BlazorServerManager.CreateAsync(ConfigureTestServices);
            
            // Step 2: Initialize browser (connects to real endpoints)
            var requirements = GetTestRequirements();
            _browserManager = await BlazorBrowserManager.CreateAsync(requirements);

            // Step 3: Allow subclasses to perform additional setup
            await OnTestInitializedAsync();
        }
        catch (Exception ex)
        {
            // Cleanup on failure to avoid resource leaks
            await CleanupAsync();
            throw new TestInfrastructureException("Failed to initialize test environment", ex);
        }
    }

    /// <summary>
    /// Hook for subclass-specific initialization.
    /// Called after infrastructure is ready.
    /// </summary>
    protected virtual Task OnTestInitializedAsync() => Task.CompletedTask;

    /// <summary>
    /// Create a page ready for Blazor testing.
    /// Simple interface hiding complex setup.
    /// </summary>
    protected async Task<BlazorPage> CreatePageAsync(TestComplexity complexity = TestComplexity.Interactive)
    {
        return await Browser.CreateBlazorPageAsync(BaseUrl, complexity);
    }

    /// <summary>
    /// Managed cleanup with exception masking.
    /// Ensures resources are cleaned up even if individual steps fail.
    /// </summary>
    public async Task DisposeAsync()
    {
        await CleanupAsync();
    }

    private async Task CleanupAsync()
    {
        var exceptions = new List<Exception>();

        // Cleanup browser first (dependent on server)
        if (_browserManager != null)
        {
            try
            {
                await _browserManager.DisposeAsync();
            }
            catch (Exception ex)
            {
                exceptions.Add(ex);
            }
        }

        // Cleanup server last
        if (_serverManager != null)
        {
            try
            {
                await _serverManager.DisposeAsync();
            }
            catch (Exception ex)
            {
                exceptions.Add(ex);
            }
        }

        // Report cleanup issues without failing the test
        if (exceptions.Count > 0)
        {
            var messages = string.Join("; ", exceptions.Select(e => e.Message));
            Console.WriteLine($"Warning: Cleanup errors occurred: {messages}");
        }
    }
}