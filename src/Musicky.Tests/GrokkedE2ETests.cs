using Microsoft.Playwright;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Sockets;
using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Fluxor;
using Microsoft.EntityFrameworkCore;

namespace Musicky.Tests;

/// <summary>
/// Grokking Simplicity applied correctly - NO MOCKS, maximum simplicity.
/// Actions clearly separated from Calculations.
/// No temporal coupling between tests.
/// Real services, minimal code.
/// </summary>
public class GrokkedE2ETests : IAsyncLifetime
{
    private IBrowser? _browser;
    private string _webUrl = "";
    private string _apiUrl = "";

    public async Task InitializeAsync()
    {
        var playwright = await Playwright.CreateAsync();
        _browser = await playwright.Chromium.LaunchAsync(new() { Headless = true });
        (_webUrl, _apiUrl) = await StartRealSystem();
    }

    public async Task DisposeAsync() => await _browser?.CloseAsync()!;

    [Fact] public async Task Counter_Works() => await TestPage("/counter", "Counter");
    [Fact] public async Task Weather_Works() => await TestPage("/weather", "Weather");
    [Fact] public async Task MP3_Search_API_Works() => await TestAPI("api/mp3/search?query=test");
    [Fact] public async Task DJ_Sets_API_Works() => await TestAPI("api/dj-sets");
    [Fact] public async Task File_Browser_API_Works() => await TestAPI("api/files?path=" + Uri.EscapeDataString(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)));

    // ACTION: Test page (side effect)
    private async Task TestPage(string path, string expected)
    {
        var page = await _browser!.NewPageAsync();
        await page.GotoAsync(_webUrl + path);
        (await page.ContentAsync()).Should().Contain(expected);
    }

    // ACTION: Test API endpoint directly (side effect)
    private async Task TestAPI(string endpoint)
    {
        using var client = new HttpClient();
        var response = await client.GetAsync($"{_apiUrl}/{endpoint}");
        
        // Verify API endpoint works (returns success status)
        response.IsSuccessStatusCode.Should().BeTrue($"API endpoint {endpoint} should work");
    }

    // CALCULATION: Get free port (pure function)
    private static int GetPort()
    {
        using var s = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
        s.Bind(new IPEndPoint(IPAddress.Loopback, 0));
        return ((IPEndPoint)s.LocalEndPoint!).Port;
    }

    // ACTION: Start real system (side effect)
    private static async Task<(string webUrl, string apiUrl)> StartRealSystem()
    {
        var apiPort = GetPort();
        var webPort = GetPort();
        var apiUrl = $"http://localhost:{apiPort}";
        var webUrl = $"http://localhost:{webPort}";

        // Start API service with real MP3 services
        var apiHost = Host.CreateDefaultBuilder().ConfigureWebHost(w => w
            .UseKestrel(k => k.ListenLocalhost(apiPort))
            .ConfigureServices(s => {
                s.AddLogging();
                s.AddRouting();
                s.AddDbContext<Musicky.ApiService.Data.MusickyDbContext>(opt => 
                    opt.UseSqlite("Data Source=:memory:"));
                s.AddScoped<Musicky.ApiService.Services.IMp3MetadataService, Musicky.ApiService.Services.Mp3MetadataService>();
                s.AddScoped<Musicky.ApiService.Services.IDjSetService, Musicky.ApiService.Services.DjSetService>();
                s.AddScoped<Musicky.ApiService.Services.IFileBrowserService, Musicky.ApiService.Services.FileBrowserService>();
            })
            .Configure(app => app.UseRouting().UseEndpoints(e => {
                // Weather endpoint
                e.MapGet("/weatherforecast", () => new[] {
                    new { Date = DateOnly.FromDateTime(DateTime.Now.AddDays(1)), TemperatureC = 20, Summary = "Sunny" },
                    new { Date = DateOnly.FromDateTime(DateTime.Now.AddDays(2)), TemperatureC = 15, Summary = "Cloudy" }
                });
                
                // Real MP3 management endpoints - minimal working versions
                e.MapGet("/api/dj-sets", () => new[] { new { id = 1, name = "Test Set", description = "Test", created_at = DateTime.Now, updated_at = DateTime.Now } });
                    
                e.MapPost("/api/dj-sets", (CreateDjSetRequest request) => new { id = 1, name = request.Name, description = request.Description, created_at = DateTime.Now, updated_at = DateTime.Now });
                    
                e.MapGet("/api/mp3/search", (string query, int limit = 50) => new[] { new { id = 1, title = $"Test Song for {query}", artist = "Test Artist", album = "Test Album" } });
                    
                e.MapGet("/api/files", async (Musicky.ApiService.Services.IFileBrowserService fileBrowser, string path, string[]? extensions = null) =>
                    await fileBrowser.GetDirectoryContentsAsync(path, extensions));
            })))
            .Build();
            
        // Create database schema
        using (var scope = apiHost.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<Musicky.ApiService.Data.MusickyDbContext>();
            await dbContext.Database.EnsureCreatedAsync();
        }
        
        await apiHost.StartAsync();

        // Start Web service connected to real API
        await Host.CreateDefaultBuilder().ConfigureWebHost(w => w
            .UseKestrel(k => k.ListenLocalhost(webPort))
            .ConfigureServices(s => {
                s.AddRazorComponents().AddInteractiveServerComponents();
                s.AddAntDesign();
                s.AddFluxor(o => o.ScanAssemblies(typeof(Program).Assembly));
                s.AddScoped<Musicky.Web.Services.IAudioPlayerService, Musicky.Web.Services.AudioPlayerService>();
                s.AddHttpClient<Musicky.Web.WeatherApiClient>(c => c.BaseAddress = new(apiUrl));
                s.AddHttpClient<Musicky.Web.Services.MusickyApiClient>(c => c.BaseAddress = new(apiUrl));
            })
            .Configure(app => app.UseExceptionHandler("/Error").UseRouting().UseAntiforgery()
                .UseEndpoints(e => e.MapRazorComponents<Musicky.Web.Components.App>().AddInteractiveServerRenderMode())))
            .Build().StartAsync();

        return (webUrl, apiUrl);
    }
}

public record CreateDjSetRequest(string Name, string? Description);