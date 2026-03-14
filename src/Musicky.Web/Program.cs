using Musicky.Web;
using Musicky.Web.Components;
using Musicky.Web.Services;
using Fluxor;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddOutputCache();

// Add Ant Design
builder.Services.AddAntDesign();

// Add Fluxor for state management
builder.Services.AddFluxor(o => o.ScanAssemblies(typeof(Program).Assembly));

// Add HTTP clients
builder.Services.AddHttpClient<WeatherApiClient>(client =>
    {
        // This URL uses "https+http://" to indicate HTTPS is preferred over HTTP.
        // Learn more about service discovery scheme resolution at https://aka.ms/dotnet/sdschemes.
        client.BaseAddress = new("https+http://apiservice");
    });

builder.Services.AddHttpClient<MusickyApiClient>(client =>
    {
        client.BaseAddress = new("https+http://apiservice");
    });

// Add custom services
builder.Services.AddScoped<IAudioPlayerService, AudioPlayerService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

// Configure HTTPS redirection with proper port detection
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
else
{
    // In development, only use HTTPS redirection if port is configured
    var httpsPort = app.Configuration["HTTPS_PORT"];
    if (!string.IsNullOrEmpty(httpsPort))
    {
        app.UseHttpsRedirection();
    }
}

app.UseAntiforgery();

app.UseOutputCache();

// Configure static files with explicit wwwroot check
if (Directory.Exists(Path.Combine(app.Environment.ContentRootPath, "wwwroot")))
{
    app.MapStaticAssets();
}
else
{
    // Log warning about missing wwwroot in development
    if (app.Environment.IsDevelopment())
    {
        app.Logger.LogWarning("wwwroot directory not found at {Path}. Static assets will not be served.",
            Path.Combine(app.Environment.ContentRootPath, "wwwroot"));
    }
}

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.MapDefaultEndpoints();

app.Run();

// Make Program accessible for testing
public partial class Program { }
