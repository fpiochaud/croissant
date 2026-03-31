/**
 * Bug #5 — Avec sessionOffset > 0, l'absentDate enregistrée par setPersonAbsent
 * ne correspond pas au slot affiché pour le remplaçant.
 *
 * Cause : setPersonAbsent utilisait getNextCroissantDay(offset) + idx*7 pour tous
 * les indices, alors que personsWithDates n'applique l'offset qu'au slot 0 :
 *   rawDates[i] = nextMonday + i*7 + (i === 0 ? offset : 0)
 *
 * Résultat : avec offset=1, pour un absent au rang 2 :
 *   absentDate (stockée) = nextMonday + 1 + 14 = "mardi 21 avr."
 *   rawDates[2] (affiché) = nextMonday + 14     = "lundi 20 avr."
 *   → décalage d'un jour entre la date d'absence affichée et le slot du remplaçant.
 *
 * Correctif : dans setPersonAbsent, n'appliquer l'offset qu'à idx === 0.
 *
 * Le test ÉCHOUE avec le code actuel.
 * Le test PASSE après correctif.
 */

import { test, expect } from '@playwright/test';
import { seedTestData, seedPersons } from '../helpers/seed';
import { loginAsAdmin } from '../helpers/auth';
import { personCard } from '../helpers/selectors';
import { getMostRecentPastDay, getSlotLabel, getAbsentDateLabel } from '../fixtures/data';

const OFFSET = 1;

test.describe('Affichage des dates avec sessionOffset > 0', () => {
  test.beforeEach(async () => {
    await seedTestData({ lastRotationDate: getMostRecentPastDay(0), sessionOffset: OFFSET });
  });

  test('la date d absence correspond au slot du remplaçant même avec un offset', async ({ page }) => {
    // Liste initiale : [Alice(0), Bob(1), AB(2), CD(3), Diana(4)]
    // On déclare AB absent et CD le remplace → CD passe en rang 2, AB en rang 3.
    // AB.absentDate doit correspondre à rawDates[2] = nextLundi + 2*7 (pas nextMardi).
    await seedPersons([
      { id: 'alice', name: 'Alice', initials: 'AL', color: 'c1', status: 'ok', rank: 0 },
      { id: 'bob',   name: 'Bob',   initials: 'BO', color: 'c2', status: 'ok', rank: 1 },
      { id: 'ab',    name: 'AB',    initials: 'AB', color: 'c3', status: 'ok', rank: 2 },
      { id: 'cd',    name: 'CD',    initials: 'CD', color: 'c4', status: 'ok', rank: 3 },
      { id: 'diana', name: 'Diana', initials: 'DI', color: 'c5', status: 'ok', rank: 4 },
    ]);

    await loginAsAdmin(page);

    // Déclarer AB absent avec CD comme remplaçant
    await page.locator('[data-testid="nav-remplacement"]').click();
    await page.locator('#absent-select').selectOption({ label: 'AB' });
    await page.waitForSelector('#swap-preview:not([style*="display:none"])');
    await page.locator('[data-testid="confirm-swap"]').click();

    await page.locator('[data-testid="nav-rotation"]').click();

    // CD est maintenant au rang 2 — son dateLabel = rawDates[2] = nextLundi + 14j
    const cdSlotLabel = getSlotLabel(2); // nextMonday + 14 jours (sans offset, car i > 0)
    const cdMeta = await personCard(page, 'CD').locator('.person-meta').textContent() ?? '';
    expect(cdMeta).toContain(cdSlotLabel);

    // AB doit afficher la même date (le lundi du slot 2, sans offset)
    // absentDate est au format court (sans jour de semaine) : "20 avr."
    // Avec le bug : AB affiche nextLundi + 1 + 14 = un jour plus tard que CD
    await expect(personCard(page, 'AB')).toContainText(getAbsentDateLabel(2));
  });
});
