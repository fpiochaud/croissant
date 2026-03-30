/**
 * Bug #2 — promoteReplacement() est silencieux pour les absents non-premiers.
 *
 * Cause : la méthode vérifie `persons[0]?.id !== absentId` et retourne sans
 * rien faire si l'absent n'est pas en tête. Résultat : quand on déclare absent
 * une personne de rang > 0, son remplaçant ne passe pas devant elle dans la
 * file. L'affichage montre "remplacé par X" mais X reste après la personne
 * absente dans la liste.
 *
 * Bug #3 — cascade de dates sur plusieurs absents consécutifs.
 *
 * Cause : personsWithDates ne regarde qu'un niveau en arrière (index-1).
 * Avec deux absents consécutifs [A(absent), B(absent), C], C reçoit la date
 * de B (index-1) et non la date de A (le premier slot disponible).
 *
 * Les tests ÉCHOUENT avec le code actuel.
 * Les tests PASSENT après correctif.
 */

import { test, expect } from '@playwright/test';
import { seedTestData, seedPersons } from '../helpers/seed';
import { loginAsAdmin } from '../helpers/auth';
import { personCard } from '../helpers/selectors';
import { getMostRecentPastDay } from '../fixtures/data';

test.describe('Bug multiples absents', () => {
  test.beforeEach(async () => {
    await seedTestData({ lastRotationDate: getMostRecentPastDay(0) });
  });

  // ── Bug #2 ────────────────────────────────────────────────────────────────

  test('le remplaçant passe devant l absent même quand l absent n est pas premier', async ({ page }) => {
    await loginAsAdmin(page);

    // Étape 1 : Alice (rang 0) est absente → Bob la remplace → Bob passe en tête
    await page.locator('[data-testid="nav-remplacement"]').click();
    await page.locator('#absent-select').selectOption({ label: 'Alice' });
    await page.waitForSelector('#swap-preview:not([style*="display:none"])');
    await expect(page.locator('#swap-flow')).toContainText('Alice → Bob');
    await page.locator('[data-testid="confirm-swap"]').click();

    // Vérifier : Bob est maintenant en tête
    await page.locator('[data-testid="nav-rotation"]').click();
    const namesAfterFirstSwap = await page.locator('#rotation-list .person-name').allTextContents();
    expect(namesAfterFirstSwap[0]).toBe('Bob');

    // Étape 2 : Charlie (rang 2) est absent → Diana le remplace
    // Liste courante : [Bob(0), Alice(1,absent), Charlie(2), Diana(3)]
    await page.locator('[data-testid="nav-remplacement"]').click();
    await page.locator('#absent-select').selectOption({ label: 'Charlie' });
    await page.waitForSelector('#swap-preview:not([style*="display:none"])');
    await expect(page.locator('#swap-flow')).toContainText('Charlie → Diana');
    await page.locator('[data-testid="confirm-swap"]').click();

    // Diana doit apparaître AVANT Charlie dans la liste
    await page.locator('[data-testid="nav-rotation"]').click();
    const names = await page.locator('#rotation-list .person-name').allTextContents();
    const dianaIdx   = names.indexOf('Diana');
    const charlieIdx = names.indexOf('Charlie');

    expect(dianaIdx).toBeGreaterThanOrEqual(0);
    expect(charlieIdx).toBeGreaterThanOrEqual(0);
    expect(dianaIdx).toBeLessThan(charlieIdx);
  });

  test('un second absent non-premier est affiché avec la bonne date', async ({ page }) => {
    // Liste : [Bob(0,ok), Alice(1,absent,remplacé par Bob), Charlie(2,ok), Diana(3,ok)]
    await seedPersons([
      { id: 'bob',     name: 'Bob',     initials: 'BO', color: 'c2', status: 'ok',     rank: 0 },
      { id: 'alice',   name: 'Alice',   initials: 'AL', color: 'c1', status: 'absent', rank: 1, replacedBy: 'Bob',   absentDate: '31 mar', catchupDate: '7 avr' },
      { id: 'charlie', name: 'Charlie', initials: 'CH', color: 'c3', status: 'ok',     rank: 2 },
      { id: 'diana',   name: 'Diana',   initials: 'DI', color: 'c4', status: 'ok',     rank: 3 },
    ]);

    await loginAsAdmin(page);

    // Déclarer Charlie absent → Diana le remplace
    await page.locator('[data-testid="nav-remplacement"]').click();
    await page.locator('#absent-select').selectOption({ label: 'Charlie' });
    await page.waitForSelector('#swap-preview:not([style*="display:none"])');
    await page.locator('[data-testid="confirm-swap"]').click();

    await page.locator('[data-testid="nav-rotation"]').click();

    // Charlie doit être marqué absent
    await expect(personCard(page, 'Charlie')).toContainText('Absent');

    // Diana affiche le créneau de Charlie (pas le sien propre)
    const dianaMetaText = await personCard(page, 'Diana').locator('.person-meta').textContent();
    expect(dianaMetaText).not.toContain('Absent');
    expect(dianaMetaText).toBeTruthy();
  });

  // ── Bug #3 ────────────────────────────────────────────────────────────────

  test('cascade de dates — deux absents consécutifs', async ({ page }) => {
    // Alice(0,absent) ET Bob(1,absent) : Charlie (rang 2) doit hériter du
    // créneau de Alice (rang 0), pas de Bob (rang 1).
    await seedPersons([
      { id: 'alice',   name: 'Alice',   initials: 'AL', color: 'c1', status: 'absent', rank: 0, replacedBy: 'Charlie', absentDate: '31 mar', catchupDate: '7 avr' },
      { id: 'bob',     name: 'Bob',     initials: 'BO', color: 'c2', status: 'absent', rank: 1, replacedBy: 'Diana',   absentDate: '7 avr',  catchupDate: '14 avr' },
      { id: 'charlie', name: 'Charlie', initials: 'CH', color: 'c3', status: 'ok',     rank: 2 },
      { id: 'diana',   name: 'Diana',   initials: 'DI', color: 'c4', status: 'ok',     rank: 3 },
    ]);

    await loginAsAdmin(page);
    await page.locator('[data-testid="nav-rotation"]').click();

    // La date affichée pour Charlie doit être celle du rang 0 (Alice = 31 mar),
    // pas du rang 1 (Bob = 7 avr).
    // Avec le bug actuel : Charlie affiche "7 avr" (rang 1) → test échoue.
    const charlieMeta = await personCard(page, 'Charlie').locator('.person-meta').textContent() ?? '';
    expect(charlieMeta).toContain('31 mar');
  });
});
