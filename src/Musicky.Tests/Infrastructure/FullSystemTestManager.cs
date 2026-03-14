using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using System.Net.Sockets;
using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Routing;
using Fluxor;

namespace Musicky.Tests.Infrastructure;

/// <summary>
/// Manages full system testing with both Web and API services running.
/// Real end-to-end behavior testing - NO MOCKS.
/// </summary>
public sealed class FullSystemTestManager : IAsyncDisposable
{
    private IHost? _apiHost;
    private IHost? _webHost;
    private bool _disposed;

    private FullSystemTestManager(IHost apiHost, IHost webHost, string webBaseUrl, string apiBaseUrl)
    {
        _apiHost = apiHost;
        _webHost = webHost;
        WebBaseUrl = webBaseUrl;
        ApiBaseUrl = apiBaseUrl;
    }

    public string WebBaseUrl { get; }
    public string ApiBaseUrl { get; }

    /// <summary>
    /// Creates and starts both API and Web services for full system testing.
    /// </summary>
    public static async Task<FullSystemTestManager> CreateAsync(Action<IServiceCollection>? configureWebServices = null)
    {
        try
        {
            // Start API service first
            var apiPort = GetAvailablePort();
            var apiHost = await StartApiServiceAsync(apiPort);
            var apiBaseUrl = $"http://localhost:{apiPort}";

            // Start Web service with API service URL
            var webPort = GetAvailablePort();
            var webHost = await StartWebServiceAsync(webPort, apiBaseUrl, configureWebServices);
            var webBaseUrl = $"http://localhost:{webPort}";

            return new FullSystemTestManager(apiHost, webHost, webBaseUrl, apiBaseUrl);
        }
        catch (Exception ex)
        {
            throw new TestInfrastructureException("Failed to start full system for testing", ex);
        }
    }

    private static async Task<IHost> StartApiServiceAsync(int port)
    {
        var builder = Host.CreateDefaultBuilder()
            .ConfigureWebHostDefaults(webBuilder =>
            {
                webBuilder.UseStartup<ApiServiceStartup>();
                webBuilder.UseKestrel(options =>
                {
                    options.ListenLocalhost(port);
                });
                webBuilder.UseEnvironment("Testing");
            });

        var host = builder.Build();
        await host.StartAsync();
        return host;
    }

    private static async Task<IHost> StartWebServiceAsync(int port, string apiBaseUrl, Action<IServiceCollection>? configureServices)
    {
        var builder = Host.CreateDefaultBuilder()
            .ConfigureWebHostDefaults(webBuilder =>
            {
                webBuilder.UseStartup<WebServiceStartup>();
                webBuilder.UseKestrel(options =>
                {
                    options.ListenLocalhost(port);
                });
                webBuilder.UseEnvironment("Testing");
                webBuilder.ConfigureServices(services =>
                {
                    // Configure Web services to connect to running API service
                    var weatherClientDescriptor = services.FirstOrDefault(d => d.ServiceType == typeof(Musicky.Web.WeatherApiClient));
                    if (weatherClientDescriptor != null)
                    {
                        services.Remove(weatherClientDescriptor);
                    }

                    services.AddHttpClient<Musicky.Web.WeatherApiClient>(client =>
                    {
                        client.BaseAddress = new Uri(apiBaseUrl);
                    });

                    // Apply any additional test configurations
                    configureServices?.Invoke(services);
                });
            });

        var host = builder.Build();
        await host.StartAsync();
        return host;
    }

    private static int GetAvailablePort()
    {
        using var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        socket.Bind(new IPEndPoint(IPAddress.Loopback, 0));
        return ((IPEndPoint)socket.LocalEndPoint!).Port;
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;

        try
        {
            if (_webHost != null)
            {
                await _webHost.StopAsync();
                _webHost.Dispose();
            }

            if (_apiHost != null)
            {
                await _apiHost.StopAsync();
                _apiHost.Dispose();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Warning: Error during system cleanup: {ex.Message}");
        }
        finally
        {
            _disposed = true;
        }
    }
}

/// <summary>
/// Startup class for API service in tests.
/// </summary>
public class ApiServiceStartup
{
    public void ConfigureServices(IServiceCollection services)
    {
        // Configure API services exactly like the real API service
        services.AddControllers();
        services.AddOpenApi();
        
        // Add Entity Framework with in-memory database for testing
        services.AddDbContext<Musicky.ApiService.Data.MusickyDbContext>(options =>
            options.UseSqlite("Data Source=:memory:"));

        // Add API services
        services.AddScoped<Musicky.ApiService.Services.IMp3MetadataService, Musicky.ApiService.Services.Mp3MetadataService>();
        services.AddScoped<Musicky.ApiService.Services.IDjSetService, Musicky.ApiService.Services.DjSetService>();
        services.AddScoped<Musicky.ApiService.Services.IFileBrowserService, Musicky.ApiService.Services.FileBrowserService>();
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        app.UseRouting();
        
        // Configure the same endpoints as the real API service
        app.UseEndpoints(endpoints =>
        {
            // Weather endpoint for demo purposes
            endpoints.MapGet("/weatherforecast", () =>
            {
                var summaries = new[] { "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching" };
                var forecasts = Enumerable.Range(1, 5).Select(index =>
                    new WeatherForecast
                    (
                        DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
                        Random.Shared.Next(-20, 55),
                        summaries[Random.Shared.Next(summaries.Length)]
                    ))
                    .ToArray();
                return forecasts;
            });

            // Other API endpoints...
            endpoints.MapGet("/api/dj-sets", async (Musicky.ApiService.Services.IDjSetService djSetService) =>
            {
                return await djSetService.GetAllSetsAsync();
            });
        });
    }
}

/// <summary>
/// Startup class for Web service in tests.
/// </summary>
public class WebServiceStartup
{
    public void ConfigureServices(IServiceCollection services)
    {
        // Configure Web services exactly like the real Web service
        services.AddRazorComponents()
            .AddInteractiveServerComponents();

        services.AddOutputCache();
        services.AddAntDesign();
        services.AddFluxor(o => o.ScanAssemblies(typeof(Program).Assembly));

        // Add custom services
        services.AddScoped<Musicky.Web.Services.IAudioPlayerService, Musicky.Web.Services.AudioPlayerService>();
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        app.UseExceptionHandler("/Error", createScopeForErrors: true);
        app.UseOutputCache();
        
        app.UseRouting();
        app.UseAntiforgery();

        app.UseEndpoints(endpoints =>
        {
            // Configure static files if wwwroot exists
            if (Directory.Exists(Path.Combine(env.ContentRootPath, "wwwroot")))
            {
                endpoints.MapStaticAssets();
            }

            endpoints.MapRazorComponents<Musicky.Web.Components.App>()
                .AddInteractiveServerRenderMode();
        });
    }
}

public record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}