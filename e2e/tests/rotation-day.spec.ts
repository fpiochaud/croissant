/**
 * Bug #4 — checkAndRotate() convertit tous les absents en "catch" lors de la rotation,
 * pas seulement le premier (rang 0).
 *
 * Cause : la boucle forEach dans checkAndRotate applique `status: 'catch'` à toutes
 * les personnes absentes de la liste mise à jour, quel que soit leur rang.
 * Seul le premier (qui vient de "passer") doit être concerné.
 *
 * Comportement attendu :
 *  - Absent au rang 0 (premier, c'est son tour) → passe en rattrapage (catch) après rotation ✓
 *  - Absent au rang >= 1 → garde son badge ⛔, n'est pas converti en catch ✗ (bug actuel)
 *
 * Les tests ÉCHOUENT avec le code actuel.
 * Les tests PASSENT après correctif.
 */

import { test, expect } from '@playwright/test';
import { seedTestData, seedPersons } from '../helpers/seed';
import { loginAsAdmin } from '../helpers/auth';
import { personCard } from '../helpers/selectors';
import { getPreviousRotationDate, getAbsentDateLabel } from '../fixtures/data';

test.describe('Comportement le jour de la rotation', () => {
  test.beforeEach(async () => {
    // lastRotationDate = lundi d'avant → rotation se déclenche au chargement
    await seedTestData({ lastRotationDate: getPreviousRotationDate() });
  });

  test('un absent au rang 2 garde son badge ⛔ après la rotation', async ({ page }) => {
    // Charlie (rang 2) est absent → ce n'est pas encore son tour
    await seedPersons([
      { id: 'alice',   name: 'Alice',   initials: 'AL', color: 'c1', status: 'ok',     rank: 0 },
      { id: 'bob',     name: 'Bob',     initials: 'BO', color: 'c2', status: 'ok',     rank: 1 },
      { id: 'charlie', name: 'Charlie', initials: 'CH', color: 'c3', status: 'absent', rank: 2, replacedBy: 'Bob', absentDate: getAbsentDateLabel(0), catchupDate: getAbsentDateLabel(1) },
      { id: 'diana',   name: 'Diana',   initials: 'DI', color: 'c4', status: 'ok',     rank: 3 },
    ]);

    await loginAsAdmin(page);
    await page.locator('[data-testid="nav-rotation"]').click();

    // Charlie doit toujours afficher ⛔
    await expect(personCard(page, 'Charlie')).toContainText('⛔');
  });


});
