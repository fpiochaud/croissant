/**
 * Tests anti-régression du workflow de remplacement.
 * Ces tests couvrent le cas nominal (un seul absent) pour détecter
 * toute régression dans le flow de base.
 */

import { test, expect } from '@playwright/test';
import { seedTestData } from '../helpers/seed';
import { loginAsAdmin } from '../helpers/auth';
import { getMostRecentPastDay } from '../fixtures/data';

test.describe('Workflow remplacement', () => {
  test.beforeEach(async () => {
    await seedTestData({ lastRotationDate: getMostRecentPastDay(0) });
  });

  test('déclarer Alice absente → Bob est proposé automatiquement', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('[data-testid="nav-remplacement"]').click();

    // Sélectionner Alice comme absente
    await page.locator('#absent-select').selectOption({ label: 'Alice' });
    await page.waitForSelector('#swap-preview:not([style*="display:none"])');

    // Bob doit être proposé (suivant d'Alice dans la liste)
    await expect(page.locator('#swap-flow')).toContainText('Alice → Bob');
  });

  test('confirmer le remplacement Alice → Bob met Bob en tête de liste', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('[data-testid="nav-remplacement"]').click();

    await page.locator('#absent-select').selectOption({ label: 'Alice' });
    await page.waitForSelector('#swap-preview:not([style*="display:none"])');
    await page.locator('[data-testid="confirm-swap"]').click();

    // Retourner sur la liste
    await page.locator('[data-testid="nav-rotation"]').click();

    const names = await page.locator('#rotation-list .person-name').allTextContents();
    // Bob doit être premier
    expect(names[0]).toBe('Bob');
  });

  test('confirmer le remplacement Alice → Bob : Alice est marquée absente', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('[data-testid="nav-remplacement"]').click();

    await page.locator('#absent-select').selectOption({ label: 'Alice' });
    await page.waitForSelector('#swap-preview:not([style*="display:none"])');
    await page.locator('[data-testid="confirm-swap"]').click();

    await page.locator('[data-testid="nav-rotation"]').click();

    // La carte d'Alice doit afficher "Absent"
    const aliceCard = page.locator('#rotation-list .person-card').filter({ hasText: 'Alice' });
    await expect(aliceCard).toContainText('Absent');
    await expect(aliceCard).toContainText('remplacé par Bob');
  });

  test('le remplacement est enregistré dans l historique', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('[data-testid="nav-remplacement"]').click();

    await page.locator('#absent-select').selectOption({ label: 'Alice' });
    await page.waitForSelector('#swap-preview:not([style*="display:none"])');
    await page.locator('[data-testid="confirm-swap"]').click();

    // Aller dans l'historique
    await page.locator('[data-testid="nav-historique"]').click();
    await page.waitForTimeout(500); // laisser Firestore sync

    const histSection = page.locator('#tab-historique');
    await expect(histSection).toContainText('Alice');
    await expect(histSection).toContainText('Bob');
  });

  test('remplacement manuel : choisir Diana à la place de Bob', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('[data-testid="nav-remplacement"]').click();

    await page.locator('#absent-select').selectOption({ label: 'Alice' });
    await page.waitForSelector('#swap-preview:not([style*="display:none"])');

    // Passer en mode manuel
    await page.getByText('Choisir manuellement').click();
    await page.locator('[data-testid="manual-replacement-select"]').selectOption({ label: 'Diana' });
    await page.locator('[data-testid="confirm-manual-swap"]').click();

    await page.locator('[data-testid="nav-rotation"]').click();

    // Diana doit être en tête
    const names = await page.locator('#rotation-list .person-name').allTextContents();
    expect(names[0]).toBe('Diana');

    // Alice doit afficher "remplacé par Diana"
    const aliceCard = page.locator('#rotation-list .person-card').filter({ hasText: 'Alice' });
    await expect(aliceCard).toContainText('remplacé par Diana');
  });

  test('si toutes les personnes sauf une sont absentes, aucun remplaçant disponible', async ({ page }) => {
    await loginAsAdmin(page);
    await page.locator('[data-testid="nav-remplacement"]').click();

    // Marquer Bob, Charlie et Diana absents avant de tester Alice
    for (const name of ['Bob', 'Charlie', 'Diana']) {
      await page.locator('#absent-select').selectOption({ label: name });
      await page.waitForSelector('#swap-preview:not([style*="display:none"])');
      await page.locator('[data-testid="confirm-swap"]').click();
      await page.waitForTimeout(300);
    }

    // Alice : plus aucun remplaçant disponible
    await page.locator('#absent-select').selectOption({ label: 'Alice' });
    await page.waitForSelector('#swap-preview:not([style*="display:none"])');

    await expect(page.locator('#swap-note')).toContainText('Aucun remplaçant disponible');
  });
});
