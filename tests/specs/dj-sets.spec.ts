import { test, expect, uniqueName } from '../fixtures/app-fixture';

test.describe('DJ Set Management', () => {
  test.beforeEach(async ({ djSetsPage }) => {
    await djSetsPage.goto();
  });

  test.describe('Page & Empty State', () => {
    test('page loads with create button', async ({ djSetsPage }) => {
      await djSetsPage.expectPageVisible();
      await expect(djSetsPage.createSetButton).toBeVisible();
    });

    test('shows getting started message when no sets exist', async ({ djSetsPage }) => {
      await djSetsPage.expectGettingStarted();
    });
  });

  test.describe('Set Creation', () => {
    test('create modal has correct fields', async ({ djSetsPage }) => {
      await djSetsPage.createSetButton.click();
      await expect(djSetsPage.setNameInput).toBeVisible();
      await expect(djSetsPage.setDescriptionInput).toBeVisible();
      await expect(djSetsPage.saveSetButton).toBeVisible();
    });

    test('save button is disabled with empty name', async ({ djSetsPage }) => {
      await djSetsPage.createSetButton.click();
      await expect(djSetsPage.saveSetButton).toBeDisabled();

      await djSetsPage.setNameInput.fill('Test');
      await expect(djSetsPage.saveSetButton).toBeEnabled();

      await djSetsPage.setNameInput.clear();
      await expect(djSetsPage.saveSetButton).toBeDisabled();
    });

    test('save button is disabled with whitespace-only name', async ({ djSetsPage }) => {
      await djSetsPage.createSetButton.click();
      await djSetsPage.setNameInput.fill('   ');
      await expect(djSetsPage.saveSetButton).toBeDisabled();
    });

    test('can create set with name only', async ({ djSetsPage }) => {
      const name = uniqueName('Set');
      await djSetsPage.createSet(name);
      await djSetsPage.expectSetSelected(name);
    });

    test('can create set with name and description', async ({ djSetsPage, page }) => {
      const name = uniqueName('Described Set');
      const desc = 'A test description';
      await djSetsPage.createSet(name, desc);
      // Set is auto-selected after creation — description should be visible
      await expect(page.getByText(desc)).toBeVisible();
    });
  });

  test.describe('Set Selection', () => {
    test('can switch between sets', async ({ djSetsPage, page }) => {
      const name1 = uniqueName('Set A');
      const name2 = uniqueName('Set B');
      const desc1 = 'Description A';
      const desc2 = 'Description B';

      await djSetsPage.createSet(name1, desc1);
      // First set is auto-selected with desc visible
      await expect(page.getByText(desc1)).toBeVisible();

      await djSetsPage.createSet(name2, desc2);
      // Second set is auto-selected
      await expect(page.getByText(desc2)).toBeVisible();

      // Switch back to first set
      await djSetsPage.selectSet(name1);
      await expect(page.getByText(desc1)).toBeVisible();
    });

    test('selecting set shows song management interface', async ({ djSetsPage }) => {
      const name = uniqueName('Songs Set');
      await djSetsPage.createSet(name);
      // Set is auto-selected — song management should appear
      await expect(djSetsPage.page.getByText('Songs in Set')).toBeVisible();
    });
  });

  test.describe('Set Editing', () => {
    test('edit button only visible when set is selected', async ({ djSetsPage }) => {
      await expect(djSetsPage.editSetButton).not.toBeVisible();
      const name = uniqueName('Edit Set');
      await djSetsPage.createSet(name);
      // Auto-selected — edit button should now appear
      await expect(djSetsPage.editSetButton).toBeVisible();
    });

    test('can edit set name', async ({ djSetsPage, page }) => {
      const original = uniqueName('Original');
      const updated = uniqueName('Updated');
      await djSetsPage.createSet(original);
      await djSetsPage.editSet(updated);
      await expect(page.getByText(original)).not.toBeVisible();
    });

    test('can edit set description', async ({ djSetsPage, page }) => {
      const name = uniqueName('Desc Edit');
      await djSetsPage.createSet(name, 'old description');
      await djSetsPage.editSet(name, 'new description');
      await expect(page.getByText('new description')).toBeVisible();
    });
  });

  test.describe('Set Deletion', () => {
    test('delete button only visible when set is selected', async ({ djSetsPage }) => {
      await expect(djSetsPage.deleteSetButton).not.toBeVisible();
      const name = uniqueName('Delete Set');
      await djSetsPage.createSet(name);
      await expect(djSetsPage.deleteSetButton).toBeVisible();
    });

    test('can delete a set', async ({ djSetsPage, page }) => {
      const name = uniqueName('Doomed Set');
      await djSetsPage.createSet(name);
      await djSetsPage.deleteSet();
      await expect(djSetsPage.editSetButton).not.toBeVisible();
    });
  });

  test.describe('Empty Set State', () => {
    test('new set shows empty state with add button', async ({ djSetsPage }) => {
      const name = uniqueName('Empty Set');
      await djSetsPage.createSet(name);
      // Auto-selected — should show empty set card
      await expect(djSetsPage.page.getByText('Songs in Set')).toBeVisible();
    });
  });

  test.describe('Data Persistence', () => {
    test('sets persist across page refresh', async ({ djSetsPage, page }) => {
      const name = uniqueName('Persistent');
      await djSetsPage.createSet(name);
      await page.reload();
      await page.waitForLoadState('networkidle');
      // After reload, the set should be available in the dropdown
      await djSetsPage.selectSet(name);
      await expect(page.getByText('Songs in Set')).toBeVisible();
    });
  });
});
