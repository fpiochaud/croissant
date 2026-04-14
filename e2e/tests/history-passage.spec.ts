/**
 * Test du scénario utilisateur : enregistrement du passage dans l'historique
 * lors de la rotation hebdomadaire.
 *
 * Scénario :
 *  - 4 personnes : Alice, Franck, Robert, Fred
 *  - Alice est au rang 0 (prévue le lundi écoulé)
 *  - Au chargement post-événement, la rotation se déclenche :
 *      Alice → dernier rang, Franck → premier
 *      l'historique doit contenir "🥐 Alice a apporté les croissants"
 *      avec la date du lundi écoulé en méta.
 */

import { test, expect } from '@playwright/test';
import { seedPersons, seedTestData, updateTeamDoc } from '../helpers/seed';
import { loginAs } from '../helpers/auth';
import { TEST_ADMIN, getPreviousRotationDate } from '../fixtures/data';

test.describe('Historique - enregistrement du passage', () => {
  test('le passage du premier (Alice) est enregistré avec son nom et la date du lundi écoulé', async ({ page }) => {
    // Seed : 4 personnes dans l'ordre Alice → Franck → Robert → Fred.
    // Fred porte l'email admin pour éviter qu'addPersonFromEmail crée un 5e membre.
    await seedTestData({ lastRotationDate: getPreviousRotationDate() });
    await seedPersons([
      { id: 'alice',  name: 'Alice',  initials: 'AL', color: 'c1', status: 'ok', rank: 0 },
      { id: 'franck', name: 'Franck', initials: 'FR', color: 'c2', status: 'ok', rank: 1 },
      { id: 'robert', name: 'Robert', initials: 'RO', color: 'c3', status: 'ok', rank: 2 },
      { id: 'fred',   name: 'Fred',   initials: 'FD', color: 'c4', status: 'ok', rank: 3, email: TEST_ADMIN.email },
    ]);
    await updateTeamDoc({ sessionOffset: 0, lastRotationDate: getPreviousRotationDate() });

    await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
    await page.waitForSelector('#rotation-list .person-card:nth-child(4)', { timeout: 10_000 });

    // Naviguer immédiatement sur l'onglet historique pour qu'il soit visible
    // (et inspectable) pendant l'exécution, même si une assertion suivante échoue.
    await page.locator('[data-testid="nav-historique"]').click();
    await expect(page.locator('#tab-historique.active')).toBeVisible();

    // ── Étape 1 : la page historique contient l'événement de passage ───────
    // Le message "Aucun événement" ne doit pas être visible
    await expect(page.locator('#history-list .history-empty')).toHaveCount(0);

    // Une seule ligne d'historique (la rotation que l'on vient de déclencher)
    const rows = page.locator('#history-list .history-row');
    await expect(rows).toHaveCount(1);

    // La ligne doit être un "Passage" avec icône 🥐, le bon texte et la bonne date
    const firstRow = rows.first();
    await expect(firstRow).toHaveClass(/history-passage/);
    await expect(firstRow.locator('.history-icon')).toHaveText('🥐');
    await expect(firstRow.locator('.history-main')).toHaveText('Alice a apporté les croissants');

    // Calculer le libellé attendu en heure locale (même logique que checkAndRotate)
    // pour éviter tout décalage de fuseau via un round-trip ISO.
    const lastMonday = new Date();
    lastMonday.setHours(0, 0, 0, 0);
    const dow = lastMonday.getDay();
    const daysSinceMonday = dow === 0 ? 6 : dow - 1;
    lastMonday.setDate(lastMonday.getDate() - daysSinceMonday);
    const expectedLabel = lastMonday.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'short',
    });
    await expect(firstRow.locator('.history-date')).toHaveText(expectedLabel);

    // ── Étape 2 : retour sur la liste, l'ordre doit refléter la rotation ───
    await page.locator('[data-testid="nav-rotation"]').click();
    await expect.poll(
      () => page.locator('#rotation-list .person-name').allTextContents(),
      { timeout: 5_000 },
    ).toEqual(['Franck', 'Robert', 'Fred', 'Alice']);
  });
});
