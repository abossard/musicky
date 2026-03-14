using Microsoft.Playwright;

namespace Musicky.Tests.Helpers;

public class DJSetTestHelpers
{
    private readonly IPage _page;

    public DJSetTestHelpers(IPage page)
    {
        _page = page;
    }

    // Navigation helpers
    public async Task NavigateToDJSets()
    {
        await _page.GotoAsync("/dj-sets");
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
        await Expect(_page.GetByText("DJ Set Management")).ToBeVisibleAsync();
        await Expect(_page.GetByTestId("create-set-button")).ToBeVisibleAsync();
    }

    public async Task NavigateToMP3Library()
    {
        await _page.GotoAsync("/mp3-library");
        await Expect(_page.GetByText("MP3 Library")).ToBeVisibleAsync();
    }

    // DJ Set management helpers
    public async Task CreateDJSet(string name, string? description = null)
    {
        await _page.GetByTestId("create-set-button").ClickAsync();
        
        // Wait for modal to appear
        await Expect(_page.GetByTestId("set-name-input")).ToBeVisibleAsync();
        
        await _page.GetByTestId("set-name-input").FillAsync(name);
        
        if (description != null)
        {
            await _page.GetByTestId("set-description-input").FillAsync(description);
        }
        
        await _page.GetByTestId("save-set-button").ClickAsync();
        
        // Wait for modal to close
        await Expect(_page.GetByTestId("set-name-input")).Not.ToBeVisibleAsync();
    }

    public async Task SelectDJSet(string setName)
    {
        await _page.GetByTestId("set-selector").ClickAsync();
        await _page.GetByRole(AriaRole.Option, new() { Name = setName }).ClickAsync();
    }

    public async Task EditDJSet(string newName, string? newDescription = null)
    {
        await _page.GetByTestId("edit-set-button").ClickAsync();
        await _page.GetByTestId("edit-set-name-input").ClearAsync();
        await _page.GetByTestId("edit-set-name-input").FillAsync(newName);
        
        if (newDescription != null)
        {
            await _page.GetByTestId("edit-set-description-input").ClearAsync();
            await _page.GetByTestId("edit-set-description-input").FillAsync(newDescription);
        }
        
        await _page.GetByTestId("save-edit-button").ClickAsync();
        
        // Wait for modal to close
        await Expect(_page.GetByTestId("edit-set-name-input")).Not.ToBeVisibleAsync();
    }

    public async Task DeleteDJSet()
    {
        await _page.GetByTestId("delete-set-button").ClickAsync();
        
        // Handle confirmation dialog
        _page.Dialog += async (_, dialog) => await dialog.AcceptAsync();
    }

    // Song search helpers
    public async Task OpenSearchPopup()
    {
        await _page.GetByTestId("add-song-main-button").ClickAsync();
        await Expect(_page.GetByTestId("search-popup")).ToBeVisibleAsync();
    }

    public async Task SearchForSong(string query)
    {
        await _page.GetByTestId("search-input").FillAsync(query);
        
        // Wait for search results (debounce)
        await _page.WaitForTimeoutAsync(500);
    }

    public async Task SelectSearchResult(int index = 0)
    {
        var results = _page.GetByTestId("search-result-item");
        await results.Nth(index).ClickAsync();
        
        // Wait for popup to close
        await Expect(_page.GetByTestId("search-popup")).Not.ToBeVisibleAsync();
    }

    public async Task CloseSearchPopup()
    {
        await _page.Keyboard.PressAsync("Escape");
        await Expect(_page.GetByTestId("search-popup")).Not.ToBeVisibleAsync();
    }

    // Song management helpers
    public async Task AddSongToSet(string query, int resultIndex = 0)
    {
        await OpenSearchPopup();
        await SearchForSong(query);
        await SelectSearchResult(resultIndex);
    }

    public async Task RemoveSongFromSet(int songIndex = 0)
    {
        var removeButtons = _page.GetByTestId("remove-song-button");
        await removeButtons.Nth(songIndex).ClickAsync();
    }

    public async Task AddSongAfterPosition(int position, string query, int resultIndex = 0)
    {
        var addAfterButtons = _page.GetByTestId("add-after-button");
        await addAfterButtons.Nth(position).ClickAsync();
        await SearchForSong(query);
        await SelectSearchResult(resultIndex);
    }

    // MP3 Library integration helpers
    public async Task EnableDJSetMode()
    {
        await _page.GetByTestId("dj-set-mode-toggle").ClickAsync();
        await Expect(_page.GetByTestId("active-set-selector")).ToBeVisibleAsync();
    }

    public async Task DisableDJSetMode()
    {
        await _page.GetByTestId("dj-set-mode-toggle").ClickAsync();
        await Expect(_page.GetByTestId("active-set-selector")).Not.ToBeVisibleAsync();
    }

    public async Task SelectActiveSet(string setName)
    {
        await _page.GetByTestId("active-set-selector").ClickAsync();
        await _page.GetByRole(AriaRole.Option, new() { Name = setName }).ClickAsync();
    }

    public async Task SelectSongsInLibrary(int count)
    {
        var checkboxes = _page.Locator("input[type=\"checkbox\"]");
        for (int i = 0; i < count; i++)
        {
            await checkboxes.Nth(i).CheckAsync();
        }
    }

    public async Task AddSelectedSongsToSet()
    {
        await _page.GetByTestId("add-to-set-button").ClickAsync();
    }

    public async Task ClearSelection()
    {
        await _page.GetByTestId("clear-selection-button").ClickAsync();
    }

    // Assertion helpers
    public async Task ExpectSetInDropdown(string setName)
    {
        // For dropdown, check that the set is selected (appears in value)
        await Expect(_page.GetByTestId("set-selector")).ToHaveValueAsync(setName);
    }

    public async Task ExpectSetSelected(string setName)
    {
        await Expect(_page.GetByTestId("set-selector")).ToHaveValueAsync(setName);
    }

    public async Task ExpectSongInSet(string songTitle)
    {
        await Expect(_page.GetByText(songTitle)).ToBeVisibleAsync();
    }

    public async Task ExpectEmptySet()
    {
        await Expect(_page.GetByText("This set is empty")).ToBeVisibleAsync();
    }

    public async Task ExpectSearchResults(string query)
    {
        await Expect(_page.GetByTestId("search-result-item")).ToHaveCountAsync(1, new() { Timeout = 2000 });
    }

    public async Task ExpectNoSearchResults()
    {
        await Expect(_page.GetByText("No songs found")).ToBeVisibleAsync();
    }

    public async Task ExpectSongCount(int count)
    {
        if (count == 0)
        {
            await ExpectEmptySet();
        }
        else
        {
            await Expect(_page.GetByText($"{count} song")).ToBeVisibleAsync();
        }
    }

    // Utility helpers
    public async Task WaitForPageLoad()
    {
        await _page.WaitForLoadStateAsync(LoadState.NetworkIdle);
    }

    public async Task RefreshPage()
    {
        await _page.ReloadAsync();
        await WaitForPageLoad();
    }

    public async Task TakeScreenshot(string name)
    {
        await _page.ScreenshotAsync(new() { Path = $"tests/screenshots/{name}.png" });
    }
}