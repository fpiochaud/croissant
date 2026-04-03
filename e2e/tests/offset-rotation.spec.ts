/**
 * Bug #1 — Changer le sessionOffset déclenche une rotation parasite au rechargement.
 *
 * Cause : checkAndRotate() compare lastRotationDate (calculé avec offset=0)
 * avec getMostRecentPastCroissantDay(newOffset). Si newOffset > 0, la date
 * de référence avance d'autant de jours, ce qui rend lastRotationDate < référence
 * et déclenche une rotation non désirée.
 *
 * Le test ÉCHOUE avec le code actuel (bug présent).
 * Le test PASSE après le correctif.
 */

import { test, expect } from '@playwright/test';
import { seedTestData, getPersonsFromDb } from '../helpers/seed';
import { loginAsAdmin } from '../helpers/auth';
import { getMostRecentPastDay } from '../fixtures/data';

test.describe('Bug offset — rotation parasite', () => {
  test.beforeEach(async () => {
    // Rotation déjà effectuée cette semaine (offset=0)
    await seedTestData({ lastRotationDate: getMostRecentPastDay(0), sessionOffset: 0 });
  });

  test('changer le offset à +1 ne déclenche pas de rotation au rechargement', async ({ page }) => {
    await loginAsAdmin(page);

    // Ordre initial
    const initialNames = await page.locator('#rotation-list .person-name').allTextContents();
    expect(initialNames).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);

    // Aller dans Réglages et changer l'offset à +1 (Mardi)
    await page.locator('[data-testid="nav-params"]').click();
    await page.waitForSelector('[data-testid="session-offset"]');
    await page.locator('[data-testid="session-offset"]').selectOption('1');

    // Simuler un rechargement (comme si l'utilisateur revenait plus tard)
    await page.reload();
    await page.waitForSelector('#rotation-list');

    // L'ordre NE DOIT PAS avoir changé — aucune rotation ne doit s'être déclenchée
    const namesAfterReload = await page.locator('#rotation-list .person-name').allTextContents();
    expect(namesAfterReload).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);

    // Vérifier aussi côté Firestore que les rangs sont inchangés
    const persons = await getPersonsFromDb();
    const names = persons.map(p => p['name']);
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);
  });

  test('changer le offset à +2 ne déclenche pas de rotation au rechargement', async ({ page }) => {
    await loginAsAdmin(page);

    await page.locator('[data-testid="nav-params"]').click();
    await page.waitForSelector('[data-testid="session-offset"]');
    await page.locator('[data-testid="session-offset"]').selectOption('2');

    await page.reload();
    await page.waitForSelector('#rotation-list');

    const names = await page.locator('#rotation-list .person-name').allTextContents();
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);
  });

  test('remettre le offset à 0 après un changement ne déclenche pas de rotation', async ({ page }) => {
    // Offset déjà à 1 en base (changé lors d'une session précédente)
    await seedTestData({
      lastRotationDate: getMostRecentPastDay(0),
      sessionOffset: 1,
    });

    await loginAsAdmin(page);

    await page.locator('[data-testid="nav-params"]').click();
    await page.waitForSelector('[data-testid="session-offset"]');
    await page.locator('[data-testid="session-offset"]').selectOption('0');

    await page.reload();
    await page.waitForSelector('#rotation-list');

    const names = await page.locator('#rotation-list .person-name').allTextContents();
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);
  });
});
