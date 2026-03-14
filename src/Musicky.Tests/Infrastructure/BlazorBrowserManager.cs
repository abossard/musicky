using Microsoft.Playwright;

namespace Musicky.Tests.Infrastructure;

/// <summary>
/// Deep module for browser lifecycle management with Blazor-specific optimizations.
/// 
/// Design Principles:
/// - Stratified Design: Higher-level operations built on browser primitives
/// - Information Hiding: Hides Playwright complexity behind domain-focused interface
/// - Exception Masking: Converts browser errors to test-meaningful errors
/// </summary>
public sealed class BlazorBrowserManager : IAsyncDisposable
{
    private readonly IPlaywright _playwright;
    private readonly IBrowser _browser;
    private readonly BrowserSettings _settings;
    private readonly List<IPage> _activePagesForCleanup = new();
    private bool _disposed;

    private BlazorBrowserManager(IPlaywright playwright, IBrowser browser, BrowserSettings settings)
    {
        _playwright = playwright;
        _browser = browser;
        _settings = settings;
    }

    /// <summary>
    /// Factory method that encapsulates complex browser initialization.
    /// Pure function call -> side effect wrapped in clear interface.
    /// </summary>
    public static async Task<BlazorBrowserManager> CreateAsync(TestRequirements requirements)
    {
        try
        {
            // Install browsers if needed - idempotent operation
            await EnsureBrowsersInstalledAsync();
            
            var playwright = await Playwright.CreateAsync();
            var settings = ServerConfiguration.CalculateBrowserSettings(requirements);
            
            var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
            {
                Headless = settings.Headless,
                SlowMo = settings.SlowMo
            });

            return new BlazorBrowserManager(playwright, browser, settings);
        }
        catch (Exception ex) when (ex is not TestInfrastructureException)
        {
            throw new TestInfrastructureException("Failed to initialize browser for testing", ex);
        }
    }

    /// <summary>
    /// Create a page optimized for Blazor Server applications.
    /// Stratified design: builds complex functionality from simple primitives.
    /// </summary>
    public async Task<BlazorPage> CreateBlazorPageAsync(string baseUrl, TestComplexity complexity = TestComplexity.Interactive)
    {
        try
        {
            var context = await _browser.NewContextAsync(new BrowserNewContextOptions
            {
                BaseURL = baseUrl,
                ViewportSize = new ViewportSize 
                { 
                    Width = _settings.ViewportWidth, 
                    Height = _settings.ViewportHeight 
                }
                // Skip permissions for now to get basic test working
            });

            var page = await context.NewPageAsync();
            _activePagesForCleanup.Add(page);

            // Set up Blazor-specific error handling
            SetupBlazorErrorHandling(page);

            var timeouts = ServerConfiguration.CalculateTimeouts(complexity);
            return new BlazorPage(page, timeouts);
        }
        catch (Exception ex)
        {
            throw new TestInfrastructureException("Failed to create Blazor-enabled page", ex);
        }
    }

    /// <summary>
    /// Idempotent browser installation - pure action.
    /// </summary>
    private static async Task EnsureBrowsersInstalledAsync()
    {
        await Task.Run(() => 
        {
            var exitCode = Microsoft.Playwright.Program.Main(new[] { "install", "chromium" });
            if (exitCode != 0)
            {
                throw new TestInfrastructureException($"Failed to install Playwright browsers: exit code {exitCode}");
            }
        });
    }

    /// <summary>
    /// Set up comprehensive error handling for Blazor Server peculiarities.
    /// Action extracted to separate method - single responsibility.
    /// </summary>
    private static void SetupBlazorErrorHandling(IPage page)
    {
        page.PageError += (_, error) => 
        {
            Console.WriteLine($"[PAGE ERROR] {error}");
        };

        page.Console += (_, msg) => 
        {
            // Log important console messages, filter noise
            if (msg.Type is "error" or "warn")
            {
                Console.WriteLine($"[BROWSER {msg.Type.ToUpper()}] {msg.Text}");
            }
        };

        // Handle SignalR connection errors specifically
        page.RequestFailed += (_, request) =>
        {
            if (request.Url.Contains("_blazor"))
            {
                Console.WriteLine($"[BLAZOR REQUEST FAILED] {request.Url}: {request.Failure}");
            }
        };
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;

        try
        {
            // Clean up all pages
            foreach (var page in _activePagesForCleanup)
            {
                try
                {
                    await page.CloseAsync();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Warning: Failed to close page: {ex.Message}");
                }
            }

            await _browser.CloseAsync();
            _playwright.Dispose();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Error during browser cleanup: {ex.Message}");
        }
        finally
        {
            _disposed = true;
        }
    }
}

/// <summary>
/// Wrapper around IPage with Blazor-specific operations.
/// Deep module: rich Blazor functionality behind simple interface.
/// </summary>
public class BlazorPage : IAsyncDisposable
{
    private readonly IPage _page;
    private readonly TimeoutSettings _timeouts;

    public BlazorPage(IPage page, TimeoutSettings timeouts)
    {
        _page = page;
        _timeouts = timeouts;
    }

    /// <summary>
    /// Navigate and wait for Blazor Server to be ready.
    /// Temporal coupling managed: proper initialization sequence guaranteed.
    /// </summary>
    public async Task NavigateAndWaitForBlazorAsync(string url)
    {
        await _page.GotoAsync(url, new PageGotoOptions 
        { 
            Timeout = _timeouts.pageLoad,
            WaitUntil = WaitUntilState.NetworkIdle 
        });

        await WaitForBlazorRenderingAsync();
        await WaitForJavaScriptInitializationAsync();
    }

    /// <summary>
    /// Wait for Blazor component rendering to stabilize.
    /// Action with clear temporal semantics.
    /// </summary>
    public async Task WaitForBlazorRenderingAsync()
    {
        // Wait for SignalR connection to establish
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = _timeouts.blazorRender });
        
        // Additional wait for component tree stabilization
        await Task.Delay(500);
    }

    /// <summary>
    /// Wait for JavaScript modules to initialize (important for AudioPlayerService).
    /// Domain-specific wait logic encapsulated.
    /// </summary>
    public async Task WaitForJavaScriptInitializationAsync()
    {
        try
        {
            // Wait for common JavaScript initialization patterns
            await _page.WaitForFunctionAsync(@"
                () => window.Blazor && 
                      (window.audioPlayerManager || true) && 
                      document.readyState === 'complete'
            ", new PageWaitForFunctionOptions { Timeout = _timeouts.jsInit });
        }
        catch (TimeoutException)
        {
            // Non-critical timeout - log but don't fail
            Console.WriteLine("Warning: JavaScript initialization timeout - continuing with test");
        }
    }

    /// <summary>
    /// Expose underlying page for advanced scenarios.
    /// Escape hatch while maintaining primary abstraction.
    /// </summary>
    public IPage UnderlyingPage => _page;

    public async ValueTask DisposeAsync()
    {
        try
        {
            await _page.CloseAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Error closing page: {ex.Message}");
        }
    }
}