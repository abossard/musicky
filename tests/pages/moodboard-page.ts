import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page object for /moodboard — unified moodboard interface with
 * library, canvas, playlist, audio player, and drawer panels.
 */
export class MoodboardPage {
  readonly page: Page;

  // Canvas (React Flow)
  readonly canvas: Locator;
  readonly songNodes: Locator;
  readonly tagNodes: Locator;
  readonly edges: Locator;
  readonly fitViewButton: Locator;
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly minimap: Locator;

  // Toolbar (overlay inside the canvas area)
  readonly toolbar: Locator;
  readonly toggleLibraryButton: Locator;
  readonly togglePlaylistButton: Locator;
  readonly settingsButton: Locator;
  readonly reviewButton: Locator;

  // Library Panel
  readonly libraryPanel: Locator;
  readonly librarySearch: Locator;
  readonly libraryPhaseFilter: Locator;
  readonly libraryGenreFilter: Locator;
  readonly libraryMoodFilter: Locator;
  readonly librarySongItems: Locator;
  readonly librarySongList: Locator;
  readonly librarySongCount: Locator;

  // Phase Flow Bar
  readonly phaseFlowBar: Locator;
  readonly phaseEditToggle: Locator;
  readonly phaseAutoArrange: Locator;
  readonly phaseOpenEditor: Locator;
  readonly phaseAddButton: Locator;
  readonly phaseNameInput: Locator;

  // Playlist Panel
  readonly playlistPanel: Locator;
  readonly playlistGenerateButton: Locator;
  readonly playlistSaveButton: Locator;
  readonly playlistPlayAllButton: Locator;
  readonly playlistItems: Locator;
  readonly playlistStats: Locator;
  readonly playlistHeader: Locator;

  // Audio Player Bar
  readonly audioPlayerBar: Locator;
  readonly playPauseButton: Locator;
  readonly previousButton: Locator;
  readonly nextButton: Locator;
  readonly trackTitle: Locator;

  // Song Detail Drawer
  readonly songDetailDrawer: Locator;
  readonly songDetailTitle: Locator;
  readonly songDetailArtwork: Locator;

  // Settings Drawer
  readonly settingsDrawer: Locator;
  readonly settingsScanButton: Locator;

  // Review Drawer
  readonly reviewDrawer: Locator;
  readonly reviewApproveAllButton: Locator;
  readonly reviewRejectAllButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Canvas (React Flow)
    this.canvas = page.locator('.react-flow');
    this.songNodes = page.locator('.react-flow__node-song');
    this.tagNodes = page.locator('.react-flow__node-tag');
    this.edges = page.locator('.react-flow__edge');
    this.fitViewButton = page.locator('.react-flow__controls-fitview');
    this.zoomInButton = page.locator('.react-flow__controls-zoomin');
    this.zoomOutButton = page.locator('.react-flow__controls-zoomout');
    this.minimap = page.locator('.react-flow__minimap');

    // Toolbar (Group with class moodboard-toolbar)
    this.toolbar = page.locator('.moodboard-toolbar');
    this.toggleLibraryButton = page.locator('[data-testid="toolbar-toggle-library"]');
    this.togglePlaylistButton = page.locator('[data-testid="toolbar-toggle-playlist"]');
    this.settingsButton = page.locator('[data-testid="toolbar-settings"]');
    this.reviewButton = page.locator('[data-testid="toolbar-review"]');

    // Library Panel
    this.libraryPanel = page.locator('.library-panel');
    this.librarySearch = page.locator('[data-testid="library-search"]');
    this.libraryPhaseFilter = this.libraryPanel.locator('.library-panel-filters .mantine-Select-root').nth(0);
    this.libraryGenreFilter = this.libraryPanel.locator('.library-panel-filters .mantine-Select-root').nth(1);
    this.libraryMoodFilter = this.libraryPanel.locator('.library-panel-filters .mantine-Select-root').nth(2);
    this.librarySongItems = page.locator('[data-testid="library-song-item"]');
    this.librarySongList = page.locator('[data-testid="library-song-list"]');
    this.librarySongCount = this.libraryPanel.locator('.library-panel-footer');

    // Phase Flow Bar
    this.phaseFlowBar = page.locator('.phase-flow-bar');
    this.phaseEditToggle = page.locator('[data-testid="phase-edit-toggle"]');
    this.phaseAutoArrange = page.locator('[data-testid="phase-auto-arrange"]');
    this.phaseOpenEditor = page.locator('[data-testid="phase-open-editor"]');
    this.phaseAddButton = page.locator('[data-testid="phase-add-btn"]');
    this.phaseNameInput = page.locator('[data-testid="phase-name-input"]');

    // Playlist Panel
    this.playlistPanel = page.locator('.playlist-panel');
    this.playlistGenerateButton = page.locator('[data-testid="playlist-generate"]');
    this.playlistSaveButton = page.locator('[data-testid="playlist-save"]');
    this.playlistPlayAllButton = page.locator('[data-testid="playlist-play-all"]');
    this.playlistItems = page.locator('.playlist-song');
    this.playlistStats = page.locator('.playlist-footer');
    this.playlistHeader = page.locator('.playlist-header');

    // Audio Player Bar
    this.audioPlayerBar = page.locator('.audio-player-bar');
    this.playPauseButton = page.locator('[data-testid="audio-play-pause"]');
    this.previousButton = page.getByRole('button', { name: 'Previous track' });
    this.nextButton = page.getByRole('button', { name: 'Next track' });
    this.trackTitle = page.locator('.audio-player-bar__track-info-title');

    // Song Detail Drawer (Mantine Drawer with title "Song Detail")
    this.songDetailDrawer = page.getByRole('dialog', { name: 'Song Detail' });
    this.songDetailTitle = this.songDetailDrawer.locator('.sdp-root').locator('text=Unknown').first();
    this.songDetailArtwork = this.songDetailDrawer.locator('.sdp-artwork');

    // Settings Drawer (Mantine Drawer with title "Settings")
    this.settingsDrawer = page.getByRole('dialog', { name: 'Settings' });
    this.settingsScanButton = page.locator('[data-testid="settings-scan-library"]');

    // Review Drawer (Mantine Drawer with title "Review Changes")
    this.reviewDrawer = page.getByRole('dialog', { name: 'Review Changes' });
    this.reviewApproveAllButton = page.locator('[data-testid="review-approve-all"]');
    this.reviewRejectAllButton = page.locator('[data-testid="review-reject-all"]');
  }

  // --- Navigation ---

  async goto() {
    await this.page.goto('/moodboard');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForCanvasReady(timeout = 15000) {
    await expect(this.canvas).toBeVisible({ timeout });
  }

  // --- Library ---

  async searchSongs(query: string) {
    await this.librarySearch.fill(query);
    // Wait for debounce (300ms) + server response
    await this.page.waitForTimeout(500);
  }

  async clearSearch() {
    await this.librarySearch.clear();
    await this.page.waitForTimeout(500);
  }

  async filterByPhase(phase: string) {
    await this.libraryPhaseFilter.locator('input').click();
    await this.page.getByRole('option', { name: new RegExp(phase, 'i') }).click();
  }

  async filterByGenre(genre: string) {
    await this.libraryGenreFilter.locator('input').click();
    await this.page.getByRole('option', { name: new RegExp(genre, 'i') }).click();
  }

  async filterByMood(mood: string) {
    await this.libraryMoodFilter.locator('input').click();
    await this.page.getByRole('option', { name: new RegExp(mood, 'i') }).click();
  }

  async selectSong(index: number) {
    await this.librarySongItems.nth(index).click();
  }

  async getSongCount(): Promise<number> {
    const text = await this.librarySongCount.textContent();
    const match = text?.match(/(\d+)\s+songs/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // --- Phase Flow ---

  phasePill(name: string): Locator {
    return this.page.locator(`[data-testid="phase-pill-${name}"]`);
  }

  async clickPhase(name: string) {
    await this.phasePill(name).click();
  }

  async openPhaseEditor() {
    await this.phaseOpenEditor.click();
  }

  async togglePhaseEditMode() {
    await this.phaseEditToggle.click();
  }

  // --- Playlist ---

  async generatePlaylist() {
    await this.playlistGenerateButton.click();
  }

  async savePlaylist(name: string) {
    await this.playlistSaveButton.click();
    await this.page.getByPlaceholder('My DJ Set').fill(name);
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  async togglePlaylistPanel() {
    await this.togglePlaylistButton.click();
  }

  // --- Drawers ---

  async openSettings() {
    await this.settingsButton.click();
  }

  async openReview() {
    await this.reviewButton.click();
  }

  async closeSongDetail() {
    const closeBtn = this.songDetailDrawer.getByRole('button').first();
    await closeBtn.click();
  }

  async closeSettings() {
    const closeBtn = this.settingsDrawer.getByRole('button').first();
    await closeBtn.click();
  }

  async closeReview() {
    const closeBtn = this.reviewDrawer.getByRole('button').first();
    await closeBtn.click();
  }

  // --- Audio ---

  async isPlaying(): Promise<boolean> {
    const label = await this.playPauseButton.getAttribute('aria-label');
    return label === 'Pause';
  }

  // --- Layout ---

  async selectLayout(name: 'Grid layout' | 'Cluster layout') {
    const btn = this.page.getByRole('button', { name });
    await btn.click();
  }

  // --- Assertions ---

  async expectLibraryVisible() {
    await expect(this.libraryPanel).toBeVisible();
  }

  async expectLibraryHidden() {
    await expect(this.libraryPanel).not.toBeVisible();
  }

  async expectPlaylistVisible() {
    await expect(this.playlistPanel).toBeVisible();
  }

  async expectSettingsDrawerVisible() {
    await expect(this.settingsDrawer).toBeVisible();
  }

  async expectReviewDrawerVisible() {
    await expect(this.reviewDrawer).toBeVisible();
  }

  async expectSongDetailVisible() {
    await expect(this.songDetailDrawer).toBeVisible();
  }

  async expectPhaseVisible(name: string) {
    await expect(this.phasePill(name)).toBeVisible();
  }

  async expectNodeCount(expectedCount: number) {
    const count = await this.page.locator('.react-flow__node').count();
    expect(count).toBe(expectedCount);
  }

  async expectEdgesVisible() {
    const count = await this.edges.count();
    expect(count).toBeGreaterThan(0);
  }
}
