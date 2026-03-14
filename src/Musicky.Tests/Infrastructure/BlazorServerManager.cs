using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Fluxor;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.FileProviders;
using System.Net;
using System.Net.Sockets;

namespace Musicky.Tests.Infrastructure;

/// <summary>
/// Deep module that hides the complexity of server lifecycle management.
/// Provides simple interface while handling complex server setup internally.
/// 
/// Design Principles Applied:
/// - Information Hiding: Hides Kestrel configuration complexity
/// - Exception Masking: Converts infrastructure failures to test-friendly errors
/// - Deep Module: Rich functionality behind simple interface
/// </summary>
public sealed class BlazorServerManager : IAsyncDisposable
{
    private readonly PlaywrightWebApplicationFactory _factory;
    private readonly IHost? _serverHost;
    private bool _disposed;

    private BlazorServerManager(PlaywrightWebApplicationFactory factory, IHost? serverHost, string baseUrl)
    {
        _factory = factory;
        _serverHost = serverHost;
        BaseUrl = baseUrl;
    }

    public string BaseUrl { get; }

    /// <summary>
    /// Simple static factory method that hides complex initialization.
    /// Exception masking: converts low-level server errors into meaningful test errors.
    /// </summary>
    public static async Task<BlazorServerManager> CreateAsync(Action<IServiceCollection>? configureServices = null)
    {
        try
        {
            var factory = new PlaywrightWebApplicationFactory(configureServices);
            var serverHost = await factory.StartServerAsync();
            var baseUrl = ExtractBaseUrl(serverHost);

            return new BlazorServerManager(factory, serverHost, baseUrl);
        }
        catch (Exception ex) when (ex is not TestInfrastructureException)
        {
            throw new TestInfrastructureException("Failed to start Blazor Server for testing", ex);
        }
    }

    /// <summary>
    /// Pure calculation extracted from complex server introspection.
    /// </summary>
    private static string ExtractBaseUrl(IHost host)
    {
        var server = host.Services.GetRequiredService<IServer>();
        var addresses = server.Features.Get<IServerAddressesFeature>();
        
        if (addresses?.Addresses.FirstOrDefault() is not string address)
        {
            throw new TestInfrastructureException("Failed to determine server address");
        }

        return address.TrimEnd('/');
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;

        try
        {
            _serverHost?.Dispose();
            await _factory.DisposeAsync();
        }
        catch (Exception ex)
        {
            // Exception masking: log but don't fail test cleanup
            Console.WriteLine($"Warning: Error during server cleanup: {ex.Message}");
        }
        finally
        {
            _disposed = true;
        }
    }
}

/// <summary>
/// Custom WebApplicationFactory that uses Kestrel for real HTTP endpoints.
/// Information hiding: encapsulates server configuration complexity.
/// </summary>
internal sealed class PlaywrightWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly Action<IServiceCollection>? _configureServices;
    private IHost? _kestrelHost;

    public PlaywrightWebApplicationFactory(Action<IServiceCollection>? configureServices = null)
    {
        _configureServices = configureServices;
    }

    /// <summary>
    /// Start real Kestrel server for Playwright access.
    /// Temporal coupling managed: proper initialization order guaranteed.
    /// </summary>
    public async Task<IHost> StartServerAsync()
    {
        var builder = CreateHostBuilder();
        
        builder.ConfigureWebHost(webBuilder =>
        {
            webBuilder.UseEnvironment("Testing");
            webBuilder.UseKestrel(options =>
            {
                // Use available port in test range
                var port = GetAvailablePort();
                options.ListenLocalhost(port);
            });
            
            if (_configureServices != null)
            {
                webBuilder.ConfigureServices(_configureServices);
            }
        });

        _kestrelHost = builder.Build();
        await _kestrelHost.StartAsync();
        
        return _kestrelHost;
    }

    /// <summary>
    /// Override to prevent TestServer creation - we use Kestrel instead.
    /// </summary>
    protected override IHost CreateHost(IHostBuilder builder)
    {
        // Return a minimal host for WebApplicationFactory compatibility
        // The real host is created in StartServerAsync
        return builder.Build();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && _kestrelHost != null)
        {
            _kestrelHost.StopAsync().GetAwaiter().GetResult();
            _kestrelHost.Dispose();
        }
        
        base.Dispose(disposing);
    }

    private new IHostBuilder CreateHostBuilder()
    {
        return Host.CreateDefaultBuilder()
            .ConfigureWebHostDefaults(webBuilder =>
            {
                // Use the Program class directly, not as Startup class
                webBuilder.UseContentRoot(Directory.GetCurrentDirectory());
                webBuilder.ConfigureServices((context, services) =>
                {
                    // Add the same services as the main Program.cs
                    services.AddRazorComponents()
                        .AddInteractiveServerComponents();

                    services.AddOutputCache();
                    services.AddAntDesign();
                    services.AddFluxor(o => o.ScanAssemblies(typeof(Program).Assembly));

                    // Add HTTP clients (mock for testing)
                    services.AddScoped(_ => new HttpClient { BaseAddress = new Uri("http://localhost") });
                    
                    // Add custom services
                    services.AddScoped<Musicky.Web.Services.IAudioPlayerService, Musicky.Web.Services.AudioPlayerService>();
                });
                
                webBuilder.Configure((context, app) =>
                {
                    // Configure the same pipeline as Program.cs
                    if (!context.HostingEnvironment.IsDevelopment())
                    {
                        app.UseExceptionHandler("/Error", createScopeForErrors: true);
                        app.UseHsts();
                    }

                    app.UseHttpsRedirection();
                    app.UseOutputCache();
                    app.UseStaticFiles();
                    app.UseRouting();
                    app.UseAntiforgery();

                    app.UseEndpoints(endpoints =>
                    {
                        endpoints.MapRazorComponents<Musicky.Web.Components.App>()
                            .AddInteractiveServerRenderMode();
                    });
                });
                
                webBuilder.ConfigureLogging(logging =>
                {
                    // Reduce noise in test output
                    logging.SetMinimumLevel(LogLevel.Warning);
                });
            });
    }

    private static int GetAvailablePort()
    {
        using var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        socket.Bind(new IPEndPoint(IPAddress.Loopback, 0));
        return ((IPEndPoint)socket.LocalEndPoint!).Port;
    }
}

/// <summary>
/// Domain-specific exception for test infrastructure failures.
/// Exception masking: provides meaningful error messages for test failures.
/// </summary>
public class TestInfrastructureException : Exception
{
    public TestInfrastructureException(string message) : base(message) { }
    public TestInfrastructureException(string message, Exception innerException) : base(message, innerException) { }
}