using Microsoft.EntityFrameworkCore;
using Musicky.ApiService.Data;
using Musicky.ApiService.Services;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();

// Add services to the container.
builder.Services.AddProblemDetails();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Add Entity Framework
builder.Services.AddDbContext<MusickyDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") ?? 
                     "Data Source=musicky.db"));

// Add custom services
builder.Services.AddScoped<IMp3MetadataService, Mp3MetadataService>();
builder.Services.AddScoped<IDjSetService, DjSetService>();
builder.Services.AddScoped<IFileBrowserService, FileBrowserService>();

// Add gRPC
builder.Services.AddGrpc();

var app = builder.Build();

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<MusickyDbContext>();
    context.Database.EnsureCreated();
}

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// API endpoints
app.MapGet("/api/dj-sets", async (IDjSetService djSetService) =>
{
    return await djSetService.GetAllSetsAsync();
});

app.MapPost("/api/dj-sets", async (IDjSetService djSetService, CreateDjSetRequest request) =>
{
    return await djSetService.CreateSetAsync(request.Name, request.Description);
});

app.MapGet("/api/dj-sets/{id:int}", async (IDjSetService djSetService, int id) =>
{
    var set = await djSetService.GetSetByIdAsync(id);
    return set is not null ? Results.Ok(set) : Results.NotFound();
});

app.MapGet("/api/mp3/search", async (IMp3MetadataService metadataService, string query, int limit = 50) =>
{
    return await metadataService.SearchCachedMetadataAsync(query, limit);
});

app.MapGet("/api/files", async (IFileBrowserService fileBrowser, string path, string[]? extensions = null) =>
{
    return await fileBrowser.GetDirectoryContentsAsync(path, extensions);
});

// Weather endpoint for demo purposes
app.MapGet("/weatherforecast", () =>
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

app.MapDefaultEndpoints();

app.Run();

public record CreateDjSetRequest(string Name, string? Description);

public record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
