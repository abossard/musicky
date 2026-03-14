# Musicky .NET Tests

This project contains comprehensive end-to-end behavioral tests for the Musicky .NET Aspire Blazor application, migrated from the original Playwright TypeScript tests.

## Test Structure

### **Behavior-Driven Tests**
All tests follow the original Playwright test patterns, testing complete user workflows from end-to-end:

- `DJSetManagementTests.cs` - DJ set creation, editing, deletion workflows
- `MP3LibraryIntegrationTests.cs` - MP3 library search and integration with DJ sets  
- `SongSearchManagementTests.cs` - Song search popup and selection behaviors
- `EndToEndWorkflowTests.cs` - Complete multi-feature workflows

### **Test Helpers & Fixtures**
- `Helpers/DJSetTestHelpers.cs` - Reusable test automation helpers
- `Fixtures/TestData.cs` - Test data and scenarios
- `TestBase.cs` - Base test class with Aspire app setup

## Running Tests

### Prerequisites
```bash
# Install Playwright browsers
dotnet run --project Musicky.Tests --args "install"
```

### Run All Tests
```bash
dotnet test
```

### Run Specific Test Categories
```bash
# DJ Set Management only
dotnet test --filter "DJSetManagementTests"

# Integration tests only  
dotnet test --filter "MP3LibraryIntegrationTests"

# End-to-End workflows only
dotnet test --filter "EndToEndWorkflowTests"
```

### Run with Verbose Output
```bash
dotnet test --logger "console;verbosity=detailed"
```

## Test Features

### **Complete Behavior Coverage**
✅ **DJ Set Management**
- Set creation with validation
- Set editing and deletion
- Empty state handling
- Data persistence

✅ **MP3 Library Integration**  
- Music search functionality
- DJ set mode toggle
- Multi-song selection
- Batch operations

✅ **Song Search & Management**
- Search popup workflows
- Result selection
- Error handling
- Input validation

✅ **End-to-End Workflows**
- Complete user journeys
- Cross-feature integration
- Data persistence
- Error recovery

### **Original Test Parity**
All tests mirror the behavior and structure of the original Playwright TypeScript tests:
- Same test scenarios and assertions
- Same helper method patterns
- Same test data and fixtures
- Same validation approaches

## Test Configuration

- **Browser**: Chromium (headless by default)
- **Parallelization**: Disabled for stability
- **Timeouts**: Configured for web app startup
- **Screenshots**: Available for debugging failures

## Architecture

The tests use:
- **Microsoft.Playwright** for browser automation
- **WebApplicationFactory** for Aspire app hosting
- **xUnit** for test framework
- **FluentAssertions** for readable assertions

Each test spins up the complete Aspire application stack (API + Web) and tests through the browser, ensuring true end-to-end validation of user workflows.