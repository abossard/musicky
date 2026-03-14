using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.AspNetCore.Hosting;
using Musicky.Web.Services;
using Musicky.Web;
using System.Linq;

namespace Musicky.Tests;

public class BasicWebTest : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public BasicWebTest(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureServices(services =>
            {
                // Remove the dependency on external services for testing
                var weatherClientService = services.FirstOrDefault(s => s.ServiceType == typeof(WeatherApiClient));
                if (weatherClientService != null) services.Remove(weatherClientService);
                
                var musickyClientService = services.FirstOrDefault(s => s.ServiceType == typeof(MusickyApiClient));
                if (musickyClientService != null) services.Remove(musickyClientService);
                
                // Add mock implementations
                services.AddScoped<WeatherApiClient>(_ => new WeatherApiClient(new HttpClient { BaseAddress = new Uri("http://localhost") }));
                services.AddScoped<MusickyApiClient>(_ => new MusickyApiClient(new HttpClient { BaseAddress = new Uri("http://localhost") }));
            });
        });
    }

    [Fact]
    public async Task Get_Home_ReturnsSuccess()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/");

        // Assert  
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync();
        content.Should().Contain("html");
    }

    [Fact]
    public async Task Get_Counter_ReturnsSuccess()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/counter");

        // Assert
        response.EnsureSuccessStatusCode();
    }

    [Fact] 
    public async Task Get_Weather_ReturnsSuccess()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/weather");

        // Assert
        response.EnsureSuccessStatusCode();
    }
}