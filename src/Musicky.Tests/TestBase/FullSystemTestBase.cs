using Musicky.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace Musicky.Tests.TestBase;

/// <summary>
/// Base class for full system end-to-end behavior tests.
/// Runs real Web and API services - NO MOCKS - for true black box testing.
/// </summary>
public abstract class FullSystemTestBase : IAsyncLifetime
{
    private FullSystemTestManager? _systemManager;
    private BlazorBrowserManager? _browserManager;

    protected FullSystemTestBase()
    {
    }

    public async Task InitializeAsync()
    {
        try
        {
            // Start full system (Web + API services)
            _systemManager = await FullSystemTestManager.CreateAsync(ConfigureTestServices);
            
            // Start browser for E2E testing
            var requirements = GetTestRequirements();
            _browserManager = await BlazorBrowserManager.CreateAsync(requirements);
            
            await OnTestInitializedAsync();
        }
        catch (Exception ex)
        {
            await CleanupAsync();
            throw new TestInfrastructureException("Failed to initialize full system test environment", ex);
        }
    }

    public async Task DisposeAsync()
    {
        await CleanupAsync();
    }

    private async Task CleanupAsync()
    {
        try
        {
            if (_browserManager != null)
            {
                await _browserManager.DisposeAsync();
                _browserManager = null;
            }

            if (_systemManager != null)
            {
                await _systemManager.DisposeAsync();
                _systemManager = null;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Error during test cleanup: {ex.Message}");
        }
    }

    /// <summary>
    /// Creates a new Playwright page connected to the real running system.
    /// </summary>
    protected async Task<BlazorPage> CreatePageAsync(TestComplexity complexity = TestComplexity.Interactive)
    {
        if (_systemManager == null || _browserManager == null)
            throw new InvalidOperationException("Test system not initialized");

        return await _browserManager.CreateBlazorPageAsync(_systemManager.WebBaseUrl, complexity);
    }

    /// <summary>
    /// Override to configure additional test services for the Web application.
    /// Default: no additional configuration (real services only).
    /// </summary>
    protected virtual void ConfigureTestServices(IServiceCollection services)
    {
        // Default: no additional configuration - use real services
    }

    /// <summary>
    /// Override to specify test requirements.
    /// </summary>
    protected virtual TestRequirements GetTestRequirements() => new()
    {
        RequiresStability = true,
        RequiresAudio = false,
        RequiresVisualDebugging = false
    };

    /// <summary>
    /// Override for additional test initialization.
    /// </summary>
    protected virtual Task OnTestInitializedAsync() => Task.CompletedTask;

    /// <summary>
    /// Access to the system manager for advanced scenarios.
    /// </summary>
    protected FullSystemTestManager SystemManager => _systemManager ?? 
        throw new InvalidOperationException("Test system not initialized");
}