import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object for /dj-sets — DJ Set management.
 */
export class DJSetsPage {
  // Selectors
  readonly setSelector: Locator;
  readonly createSetButton: Locator;
  readonly editSetButton: Locator;
  readonly deleteSetButton: Locator;
  readonly addSongMainButton: Locator;

  // Create modal
  readonly setNameInput: Locator;
  readonly setDescriptionInput: Locator;
  readonly saveSetButton: Locator;

  // Edit modal
  readonly editNameInput: Locator;
  readonly editDescriptionInput: Locator;
  readonly saveEditButton: Locator;

  // Song list
  readonly addFirstSongButton: Locator;
  readonly addSongButton: Locator;
  readonly removeSongButtons: Locator;
  readonly addAfterButtons: Locator;

  // Search popup
  readonly searchPopup: Locator;
  readonly searchInput: Locator;
  readonly searchResults: Locator;
  readonly searchResultItems: Locator;

  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setSelector = page.getByTestId('set-selector');
    this.createSetButton = page.getByTestId('create-set-button');
    this.editSetButton = page.getByTestId('edit-set-button');
    this.deleteSetButton = page.getByTestId('delete-set-button');
    this.addSongMainButton = page.getByTestId('add-song-main-button');

    this.setNameInput = page.getByTestId('set-name-input');
    this.setDescriptionInput = page.getByTestId('set-description-input');
    this.saveSetButton = page.getByTestId('save-set-button');

    this.editNameInput = page.getByTestId('edit-set-name-input');
    this.editDescriptionInput = page.getByTestId('edit-set-description-input');
    this.saveEditButton = page.getByTestId('save-edit-button');

    this.addFirstSongButton = page.getByTestId('add-first-song-button');
    this.addSongButton = page.getByTestId('add-song-button');
    this.removeSongButtons = page.getByTestId('remove-song-button');
    this.addAfterButtons = page.getByTestId('add-after-button');

    this.searchPopup = page.getByRole('dialog', { name: 'Search Songs' });
    this.searchInput = page.getByPlaceholder('Search for songs, artists, or albums...');
    this.searchResults = page.getByTestId('search-results');
    this.searchResultItems = page.getByTestId('search-result-item');
  }

  async goto() {
    await this.page.goto('/dj-sets');
    await this.page.waitForLoadState('networkidle');
    await expect(this.createSetButton).toBeVisible();
  }

  // --- Set CRUD ---

  async createSet(name: string, description?: string) {
    await this.createSetButton.click();
    // Mantine Modal animates in via portal — wait for the input
    await this.page.waitForTimeout(500);
    await expect(this.setNameInput).toBeVisible({ timeout: 10000 });
    await this.setNameInput.fill(name);
    if (description) {
      await this.setDescriptionInput.fill(description);
    }
    await this.saveSetButton.click();
    // Wait for modal to close and set to be selected
    await expect(this.setNameInput).not.toBeVisible({ timeout: 10000 });
  }

  async selectSet(name: string) {
    await this.setSelector.click();
    await this.page.getByRole('option', { name }).click();
    // Wait for the set details to load
    await this.page.waitForLoadState('networkidle');
  }

  async editSet(newName: string, newDescription?: string) {
    await this.editSetButton.click();
    await expect(this.editNameInput).toBeVisible({ timeout: 10000 });
    await this.editNameInput.clear();
    await this.editNameInput.fill(newName);
    if (newDescription !== undefined) {
      await this.editDescriptionInput.clear();
      await this.editDescriptionInput.fill(newDescription);
    }
    await this.saveEditButton.click();
    await expect(this.editNameInput).not.toBeVisible({ timeout: 10000 });
  }

  async deleteSet() {
    // Set up dialog handler before triggering it
    this.page.once('dialog', (dialog) => dialog.accept());
    await this.deleteSetButton.click();
    // Wait for the set to be deselected/removed
    await expect(this.editSetButton).not.toBeVisible({ timeout: 10000 });
  }

  // --- Song search & management ---

  async openSearchPopup() {
    await this.addSongMainButton.click();
    await expect(this.searchPopup).toBeVisible({ timeout: 10000 });
  }

  async searchForSong(query: string) {
    await this.searchInput.fill(query);
    // Wait for debounce + results or no-results message
    await this.page.waitForTimeout(500); // debounce delay
    await expect(
      this.searchResultItems.first()
        .or(this.page.getByText('No songs found'))
        .or(this.page.getByText('Type at least'))
    ).toBeVisible({ timeout: 10000 });
  }

  async selectSearchResult(index: number = 0) {
    await this.searchResultItems.nth(index).click();
    await expect(this.searchPopup).not.toBeVisible({ timeout: 10000 });
  }

  async addSongViaSearch(query: string, resultIndex: number = 0) {
    await this.openSearchPopup();
    await this.searchForSong(query);
    await this.selectSearchResult(resultIndex);
  }

  async removeSong(index: number) {
    await this.removeSongButtons.nth(index).click();
  }

  async insertSongAfter(position: number, query: string, resultIndex: number = 0) {
    await this.addAfterButtons.nth(position).click();
    await this.searchForSong(query);
    await this.selectSearchResult(resultIndex);
  }

  // --- Assertions ---

  async expectPageVisible() {
    await expect(this.page.getByRole('heading', { name: 'DJ Set Management' })).toBeVisible();
  }

  async expectSetSelected(_name: string) {
    // After creation, the set is auto-selected. Just verify the management UI shows.
    await expect(this.page.getByText('Songs in Set')).toBeVisible({ timeout: 10000 });
  }

  async expectEmptySet() {
    await expect(this.page.getByText('This set is empty')).toBeVisible();
  }

  async expectSongCount(count: number) {
    if (count === 0) {
      await this.expectEmptySet();
    } else {
      await expect(this.page.getByText(`${count} song`)).toBeVisible();
    }
  }

  async expectGettingStarted() {
    await expect(this.page.getByText('Create a new DJ set')).toBeVisible();
  }
}
