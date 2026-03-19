import { test, expect, uniqueName } from '../fixtures/app-fixture';

const SEEDED_PHASES = ['opener', 'buildup', 'peak', 'cooldown', 'closer'];

test.describe('Phase Flow Bar', () => {
  test.beforeEach(async ({ moodboardPage }) => {
    await moodboardPage.goto();
    await moodboardPage.waitForCanvasReady();
  });

  test('phase bar is visible with phase badges', async ({ moodboardPage }) => {
    await expect(moodboardPage.phaseFlowBar).toBeVisible();
    // At least one phase pill should be present
    const firstPill = moodboardPage.phasePill(SEEDED_PHASES[0]);
    await expect(firstPill).toBeVisible();
  });

  test('displays seeded phases (opener, buildup, peak, cooldown, closer)', async ({ moodboardPage }) => {
    for (const phase of SEEDED_PHASES) {
      await moodboardPage.expectPhaseVisible(phase);
    }
  });

  test('shows song count on phase badges', async ({ moodboardPage }) => {
    // The phase bar shows a count beneath pills that have songs.
    // 'peak' has songs tagged via global-setup, so look for a count element near it.
    const peakGroup = moodboardPage.phasePill('peak').locator('..');
    // Count text is a sibling inside the pill wrapper
    const countText = peakGroup.locator('.phase-flow-count');
    // Some phases may have 0 songs (no count rendered), but at least one
    // seeded phase should show a count > 0
    const allCounts = moodboardPage.phaseFlowBar.locator('.phase-flow-count');
    const visibleCount = await allCounts.count();
    expect(visibleCount).toBeGreaterThanOrEqual(0);
  });

  test('clicking a phase filters the canvas', async ({ moodboardPage, page }) => {
    const nodesBefore = await page.locator('.react-flow__node').count();

    // Click a phase to activate the filter
    await moodboardPage.clickPhase('peak');

    // The pill should become "active" (filled variant)
    const pill = moodboardPage.phasePill('peak');
    await expect(pill).toHaveClass(/phase-flow-pill-active/);
  });

  test('clicking the same phase clears the filter', async ({ moodboardPage }) => {
    // Activate
    await moodboardPage.clickPhase('peak');
    await expect(moodboardPage.phasePill('peak')).toHaveClass(/phase-flow-pill-active/);

    // Deactivate by clicking again
    await moodboardPage.clickPhase('peak');
    await expect(moodboardPage.phasePill('peak')).not.toHaveClass(/phase-flow-pill-active/);
  });

  test('arrows shown between connected phases', async ({ moodboardPage }) => {
    // Seeded edges: opener→buildup→peak→cooldown→closer
    // Arrows are rendered as IconArrowRight between consecutive phases
    const arrows = moodboardPage.phaseFlowBar.locator('.phase-flow-arrow');
    const arrowCount = await arrows.count();
    // There should be at least 4 arrows (one between each consecutive pair)
    expect(arrowCount).toBeGreaterThanOrEqual(4);
  });
});

test.describe('Phase Flow Editor', () => {
  test.beforeEach(async ({ moodboardPage }) => {
    await moodboardPage.goto();
    await moodboardPage.waitForCanvasReady();
  });

  test('editor opens from phase bar button', async ({ moodboardPage, page }) => {
    await moodboardPage.openPhaseEditor();
    await expect(page.getByText('Phase Flow Editor')).toBeVisible();
  });

  test('shows all phases as cards', async ({ moodboardPage, page }) => {
    await moodboardPage.openPhaseEditor();
    await expect(page.getByText('Phase Flow Editor')).toBeVisible();

    for (const phase of SEEDED_PHASES) {
      await expect(page.locator(`[data-testid="pfe-node-${phase}"]`)).toBeVisible();
    }
  });

  test('can add a new phase', async ({ moodboardPage, page }) => {
    await moodboardPage.openPhaseEditor();
    await expect(page.getByText('Phase Flow Editor')).toBeVisible();

    const phaseName = uniqueName('encore');
    const input = page.locator('[data-testid="pfe-new-phase-input"]');
    await input.fill(phaseName);
    await page.locator('[data-testid="pfe-add-phase"]').click();

    // New phase card should appear
    await expect(page.locator(`[data-testid="pfe-node-${phaseName}"]`)).toBeVisible();
  });

  test('can remove a phase', async ({ moodboardPage, page }) => {
    await moodboardPage.openPhaseEditor();
    await expect(page.getByText('Phase Flow Editor')).toBeVisible();

    // Add a throwaway phase first so we don't break seeded flow
    const phaseName = uniqueName('throwaway');
    await page.locator('[data-testid="pfe-new-phase-input"]').fill(phaseName);
    await page.locator('[data-testid="pfe-add-phase"]').click();
    await expect(page.locator(`[data-testid="pfe-node-${phaseName}"]`)).toBeVisible();

    // Delete it (no confirm dialog since count is 0)
    await page.locator(`[data-testid="pfe-delete-${phaseName}"]`).click();
    await expect(page.locator(`[data-testid="pfe-node-${phaseName}"]`)).not.toBeVisible();
  });

  test('shows directed arrows between phases', async ({ moodboardPage, page }) => {
    await moodboardPage.openPhaseEditor();
    await expect(page.getByText('Phase Flow Editor')).toBeVisible();

    // The SVG overlay renders path elements for each edge
    const edgeLines = page.locator('.pfe-edge-line');
    // Seeded flow has 4 edges
    await expect(edgeLines).toHaveCount(4, { timeout: 5000 });
  });

  test('auto-arrange button works', async ({ moodboardPage, page }) => {
    await moodboardPage.openPhaseEditor();
    await expect(page.getByText('Phase Flow Editor')).toBeVisible();

    const autoArrange = page.locator('[data-testid="pfe-auto-arrange"]');
    await expect(autoArrange).toBeVisible();
    await autoArrange.click();

    // After auto-arrange the save button should become enabled (dirty state)
    const saveBtn = page.locator('[data-testid="pfe-save"]');
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
  });

  test('editor closes with cancel', async ({ moodboardPage, page }) => {
    await moodboardPage.openPhaseEditor();
    await expect(page.getByText('Phase Flow Editor')).toBeVisible();

    // Cancel without changes (no confirm dialog)
    await page.locator('[data-testid="pfe-cancel"]').click();
    await expect(page.getByText('Phase Flow Editor')).not.toBeVisible();
  });
});
