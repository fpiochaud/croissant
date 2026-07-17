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
import { seedTestData, getPersonsFromDb, getTeamDoc } from '../helpers/seed';
import { loginAsAdmin } from '../helpers/auth';
import { getMostRecentPastDay, getPreviousRotationDate, getThisWeekEventDate } from '../fixtures/data';

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
    await page.waitForSelector('#rotation-list .person-card:nth-child(5)', { timeout: 15_000 });

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
    await page.waitForSelector('#rotation-list .person-card:nth-child(5)', { timeout: 15_000 });

    const names = await page.locator('#rotation-list .person-name').allTextContents();
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);
  });

  test('remettre le offset à 0 après un changement ne déclenche pas de rotation', async ({ page }) => {
    // Offset déjà à 1 en base (changé lors d'une session précédente).
    // lastRotationDate = date de l'événement avec offset=1 (mardi de cette semaine)
    // pour indiquer que la rotation a bien été faite pour cet événement.
    await seedTestData({
      lastRotationDate: getThisWeekEventDate(1),
      sessionOffset: 1,
    });

    await loginAsAdmin(page);

    await page.locator('[data-testid="nav-params"]').click();
    await page.waitForSelector('[data-testid="session-offset"]');
    await page.locator('[data-testid="session-offset"]').selectOption('0');

    await page.reload();
    await page.waitForSelector('#rotation-list .person-card:nth-child(5)', { timeout: 15_000 });

    const names = await page.locator('#rotation-list .person-name').allTextContents();
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);
  });
});

/**
 * Bug corrigé le 7 avril 2026 — La rotation se déclenchait le jour J de l'événement
 * quand sessionOffset > 0 (ex : lundi férié → croissants décalés au mardi).
 *
 * Cause : checkAndRotate() comparait toujours contre le lundi (offset=0).
 * Avec offset=1, le lundi passé (= hier) était postérieur à lastRotationDate
 * → la rotation se déclenchait le mardi matin, avant que l'événement ait eu lieu,
 * renvoyant la personne du jour en bas de liste prématurément.
 *
 * Le test ÉCHOUE avec le code d'origine.
 * Le test PASSE après correctif.
 */
test.describe('Bug — rotation ne se déclenche pas le jour J de l\'événement', () => {
  test('la rotation ne se déclenche pas quand aujourd\'hui est le jour de l\'événement', async ({ page }) => {
    // Calcule l'offset pour que aujourd'hui soit le jour de l'événement :
    // lundi → 0, mardi → 1, mercredi → 2, jeudi → 3, vendredi → 4, dimanche → 6.
    const dayOfWeek = new Date().getDay();
    const offsetForToday = dayOfWeek === 0 ? 6 : Math.max(0, dayOfWeek - 1);

    // lastRotationDate = 2 lundis en arrière : suffisamment ancien pour que
    // l'ancienne logique (getMostRecentPastCroissantDay(0) > lastRotationDate) déclenche
    // une rotation parasite, alors que la nouvelle logique doit s'y refuser.
    await seedTestData({
      lastRotationDate: getPreviousRotationDate(),
      sessionOffset: offsetForToday,
    });

    await loginAsAdmin(page);

    // Naviguer hors de la rotation et revenir pour laisser checkAndRotate()
    // (opération async) le temps de terminer avant de lire l'état final.
    await page.locator('[data-testid="nav-params"]').click();
    await page.waitForSelector('[data-testid="session-offset"]');
    await page.locator('[data-testid="nav-rotation"]').click();
    await page.waitForSelector('#rotation-list .person-card:nth-child(5)', { timeout: 10_000 });

    // L'ordre NE DOIT PAS avoir changé : l'événement n'a pas encore eu lieu aujourd'hui.
    const names = await page.locator('#rotation-list .person-name').allTextContents();
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);

    // Source de vérité : Firestore — ni les rangs ni la date de rotation ne doivent avoir bougé.
    const persons = await getPersonsFromDb();
    expect(persons.map(p => p['name'])).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);

    const teamDoc = await getTeamDoc();
    expect(teamDoc['lastRotationDate']).toBe(getPreviousRotationDate());
  });
});
