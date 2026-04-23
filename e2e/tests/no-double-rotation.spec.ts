/**
 * Régression — Double rotation au rechargement de page (cache stale).
 *
 * Scénario reproduit (22 avril 2026) :
 *  - Yassine apporte les croissants le lundi 20 avril.
 *  - Le mardi 21 avril, la rotation se déclenche correctement (Juan passe premier).
 *  - Le mercredi 22 avril, un utilisateur avec un vieux cache recharge l'app.
 *  - Avant correctif : getDoc(teams) retournait le cache local sans lastRotationDate
 *    → la rotation s'est redéclenchée à tort, Juan est passé dernier.
 *  - Après correctif : getDocFromServer garantit de lire lastRotationDate depuis le
 *    serveur → la rotation ne se déclenche pas.
 */

import { test, expect } from '@playwright/test';
import { seedPersons, seedTestData, getTeamDoc } from '../helpers/seed';
import { loginAsAdmin } from '../helpers/auth';
import { getThisWeekEventDate } from '../fixtures/data';

test.describe('Pas de double rotation (cache stale)', () => {
  test('la rotation ne se redéclenche pas si lastRotationDate est déjà à jour', async ({ page }) => {
    // lastRotationDate = date de l'événement de cette semaine (offset=0 = lundi)
    // → simule une rotation déjà effectuée cette semaine.
    const alreadyRotatedDate = getThisWeekEventDate(0);
    await seedTestData({ lastRotationDate: alreadyRotatedDate, sessionOffset: 0 });
    await seedPersons([
      { id: 'alice',   name: 'Alice',   initials: 'AL', color: 'c1', status: 'ok', rank: 0 },
      { id: 'bob',     name: 'Bob',     initials: 'BO', color: 'c2', status: 'ok', rank: 1 },
      { id: 'charlie', name: 'Charlie', initials: 'CH', color: 'c3', status: 'ok', rank: 2 },
      { id: 'diana',   name: 'Diana',   initials: 'DI', color: 'c4', status: 'ok', rank: 3 },
      { id: 'admin',   name: 'Admin',   initials: 'AD', color: 'c5', status: 'ok', rank: 4, email: 'admin@test.com' },
    ]);

    await loginAsAdmin(page);

    // Laisser le temps à checkAndRotate() de terminer (getDocFromServer + comparaison).
    await page.waitForTimeout(3_000);

    // Alice doit rester en tête : aucune rotation ne doit s'être déclenchée.
    const names = await page.locator('#rotation-list .person-name').allTextContents();
    expect(names[0]).toBe('Alice');
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);

    // lastRotationDate en base ne doit pas avoir changé.
    const teamDoc = await getTeamDoc();
    expect(teamDoc['lastRotationDate']).toBe(alreadyRotatedDate);

    // Aucune entrée d'historique ne doit avoir été créée.
    await page.locator('[data-testid="nav-historique"]').click();
    await expect(page.locator('#history-list .history-empty')).toBeVisible();
  });
});
