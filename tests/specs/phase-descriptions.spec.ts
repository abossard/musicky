import { test, expect, uniqueName } from '../fixtures/app-fixture';

// Default phases as defined in database/sqlite/queries/library-settings.ts
const DEFAULT_PHASES = ['starter', 'buildup', 'peak', 'release', 'feature'];

/** Wait for the phases list to finish loading on the settings page. */
async function waitForPhasesLoaded(page: import('@playwright/test').Page) {
  await expect(page.locator('.settings-loading')).not.toBeVisible({ timeout: 15000 });
  await expect(page.locator('.phase-item').first()).toBeVisible({ timeout: 10000 });
}

/** Expand a phase by name in the settings page and return its locator. */
async function expandPhase(page: import('@playwright/test').Page, phaseName: string) {
  const item = page.locator('.phase-item').filter({ hasText: phaseName });
  await expect(item).toBeVisible({ timeout: 10000 });
  await item.locator('button[title="Expand"]').click();
  await expect(item.locator('textarea')).toBeVisible({ timeout: 5000 });
  return item;
}

// Run serially — tests share the same database and mutate phases
test.describe.configure({ mode: 'serial' });

test.describe('Phase Descriptions (Rich Phase Model)', () => {
  test.describe('Settings — backward compatibility', () => {
    test.beforeEach(async ({ settingsPage }) => {
      await settingsPage.goto();
    });

    test('phases load and are visible', async ({ page }) => {
      await waitForPhasesLoaded(page);
      // Verify at least the default phases are present (they may co-exist with leftover test phases)
      for (const phase of DEFAULT_PHASES) {
        await expect(page.locator('.phase-item').filter({ hasText: phase }).first()).toBeVisible({ timeout: 10000 });
      }
    });

    test('phases have expand/collapse arrow', async ({ page }) => {
      await waitForPhasesLoaded(page);
      const expandButtons = page.locator('button[title="Expand"]');
      await expect(expandButtons.first()).toBeVisible({ timeout: 10000 });
      const count = await expandButtons.count();
      expect(count).toBeGreaterThanOrEqual(DEFAULT_PHASES.length);
    });
  });

  test.describe('Settings — editing phase details', () => {
    test.beforeEach(async ({ settingsPage }) => {
      await settingsPage.goto();
    });

    test('can expand a phase and add a description', async ({ page }) => {
      await waitForPhasesLoaded(page);
      const phaseItem = await expandPhase(page, 'starter');

      const descTextarea = phaseItem.locator('textarea');
      const desc = 'Sets the vibe, warm up the crowd';
      await descTextarea.fill(desc);
      await expect(descTextarea).toHaveValue(desc);

      // Wait for autosave to persist
      await page.waitForTimeout(1000);

      // Reload and verify persistence
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await waitForPhasesLoaded(page);

      const phaseItemAfter = await expandPhase(page, 'starter');
      await expect(phaseItemAfter.locator('textarea')).toHaveValue(desc, { timeout: 10000 });
    });

    test('can set BPM range on a phase', async ({ page }) => {
      await waitForPhasesLoaded(page);
      const peakItem = await expandPhase(page, 'peak');

      const bpmMinInput = peakItem.getByLabel('BPM min');
      const bpmMaxInput = peakItem.getByLabel('BPM max');

      await bpmMinInput.fill('128');
      await bpmMaxInput.fill('140');

      await expect(bpmMinInput).toHaveValue('128');
      await expect(bpmMaxInput).toHaveValue('140');
    });

    test('can set energy range on a phase', async ({ page }) => {
      await waitForPhasesLoaded(page);
      const buildupItem = await expandPhase(page, 'buildup');

      const energyMin = buildupItem.getByLabel('Energy min (1–10)');
      const energyMax = buildupItem.getByLabel('Energy max (1–10)');

      await energyMin.fill('5');
      await energyMax.fill('8');

      await expect(energyMin).toHaveValue('5');
      await expect(energyMax).toHaveValue('8');
    });

    test('adding a new phase with description', async ({ settingsPage, page }) => {
      await waitForPhasesLoaded(page);
      const phaseName = uniqueName('interlude');
      await settingsPage.addPhase(phaseName);
      await settingsPage.expectPhaseVisible(phaseName);

      const newItem = await expandPhase(page, phaseName);
      const descTextarea = newItem.locator('textarea');
      const desc = 'A mellow transition moment';
      await descTextarea.fill(desc);
      await expect(descTextarea).toHaveValue(desc);
    });
  });

  test.describe('PhaseFlowEditor — rich phase details', () => {
    test('phase cards show description when set', async ({ settingsPage, moodboardPage, page }) => {
      // Set a description on "buildup" via settings (buildup is in both phase_edges and default phases)
      await settingsPage.goto();
      await waitForPhasesLoaded(page);
      const item = await expandPhase(page, 'buildup');
      const desc = 'Warm up the dance floor';
      await item.locator('textarea').fill(desc);
      await page.waitForTimeout(1000);

      // Navigate to moodboard and open the PhaseFlowEditor
      await moodboardPage.goto();
      await moodboardPage.waitForCanvasReady();
      await moodboardPage.openPhaseEditor();
      await expect(page.getByRole('heading', { name: 'Phase Flow Editor' })).toBeVisible({ timeout: 10000 });

      const card = page.locator('[data-testid="pfe-node-buildup"]');
      await expect(card).toBeVisible({ timeout: 10000 });
      await expect(card.getByText(desc)).toBeVisible({ timeout: 10000 });
    });

    test('phase cards show BPM and energy ranges when set', async ({ settingsPage, moodboardPage, page }) => {
      // Set BPM and energy on "peak" via settings
      await settingsPage.goto();
      await waitForPhasesLoaded(page);
      const peakItem = await expandPhase(page, 'peak');
      await peakItem.getByLabel('BPM min').fill('130');
      await peakItem.getByLabel('BPM max').fill('145');
      await peakItem.getByLabel('Energy min (1–10)').fill('8');
      await peakItem.getByLabel('Energy max (1–10)').fill('10');
      await page.waitForTimeout(1000);

      // Navigate to moodboard and open the PhaseFlowEditor
      await moodboardPage.goto();
      await moodboardPage.waitForCanvasReady();
      await moodboardPage.openPhaseEditor();
      await expect(page.getByRole('heading', { name: 'Phase Flow Editor' })).toBeVisible({ timeout: 10000 });

      const peakCard = page.locator('[data-testid="pfe-node-peak"]');
      await expect(peakCard).toBeVisible({ timeout: 10000 });
      await expect(peakCard.getByText(/130–145 BPM/)).toBeVisible({ timeout: 10000 });
      await expect(peakCard.getByText(/E8–10/)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('PhaseFlowBar — tooltip with rich details', () => {
    test('hovering a phase pill shows tooltip', async ({ moodboardPage, page }) => {
      await moodboardPage.goto();
      await moodboardPage.waitForCanvasReady();

      // Phase edges are seeded as opener→buildup→peak→cooldown→closer
      const pill = moodboardPage.phasePill('buildup');
      await expect(pill).toBeVisible({ timeout: 10000 });
      await pill.hover();

      const tooltip = page.getByRole('tooltip');
      await expect(tooltip).toBeVisible({ timeout: 5000 });
    });

    test('tooltip shows description and ranges when set', async ({ settingsPage, moodboardPage, page }) => {
      // Set description and BPM on "peak" via settings
      await settingsPage.goto();
      await waitForPhasesLoaded(page);
      const peakItem = await expandPhase(page, 'peak');
      await peakItem.locator('textarea').fill('Maximum energy moment');
      await peakItem.getByLabel('BPM min').fill('130');
      await peakItem.getByLabel('BPM max').fill('145');
      await page.waitForTimeout(1000);

      // Navigate to moodboard
      await moodboardPage.goto();
      await moodboardPage.waitForCanvasReady();

      // Hover over "peak" pill (seeded in phase_edges)
      const peakPill = moodboardPage.phasePill('peak');
      await expect(peakPill).toBeVisible({ timeout: 10000 });
      await peakPill.hover();

      const tooltip = page.getByRole('tooltip');
      await expect(tooltip).toBeVisible({ timeout: 5000 });
      await expect(tooltip.getByText('Maximum energy moment')).toBeVisible({ timeout: 5000 });
      await expect(tooltip.getByText(/BPM.*130–145/)).toBeVisible({ timeout: 5000 });
    });
  });
});
