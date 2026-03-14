var builder = DistributedApplication.CreateBuilder(args);

// Add SQLite database
var database = builder.AddConnectionString("DefaultConnection", "Data Source=musicky.db");

// Add API service with database
var apiService = builder.AddProject<Projects.Musicky_ApiService>("apiservice")
    .WithReference(database)
    .WithArgs("--environment", "Development");

// Add web frontend with API service reference
var webfrontend = builder.AddProject<Projects.Musicky_Web>("webfrontend")
    .WithExternalHttpEndpoints()
    .WithReference(apiService)
    .WaitFor(apiService);

builder.Build().Run();
