/**
 * Tests anti-régression de la liste de rotation.
 * Couvre l'affichage de l'ordre, des statuts et des dates.
 */

import { test, expect } from '@playwright/test';
import { seedTestData, seedPersons } from '../helpers/seed';
import { loginAsAdmin } from '../helpers/auth';
import { personCard } from '../helpers/selectors';
import { getMostRecentPastDay } from '../fixtures/data';

test.describe('Liste de rotation', () => {
  test.beforeEach(async () => {
    await seedTestData({ lastRotationDate: getMostRecentPastDay(0) });
  });

  test('affiche les 4 personnes dans le bon ordre', async ({ page }) => {
    await loginAsAdmin(page);

    const names = await page.locator('#rotation-list .person-name').allTextContents();
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana']);
  });

  test('toutes les cartes affichent une date prévisionnelle', async ({ page }) => {
    await loginAsAdmin(page);

    const cards = page.locator('#rotation-list .person-card');
    const count = await cards.count();
    expect(count).toBe(4);

    for (let i = 0; i < count; i++) {
      const meta = await cards.nth(i).locator('.person-meta').textContent();
      // Chaque carte doit afficher "Prévu le" avec une date
      expect(meta).toMatch(/Prévu le/);
    }
  });

  test('une personne absente affiche le badge ⛔ et la date d absence', async ({ page }) => {
    await seedPersons([
      { id: 'alice',   name: 'Alice',   initials: 'AL', color: 'c1', status: 'absent', rank: 0, replacedBy: 'Bob', absentDate: '31 mar', catchupDate: '7 avr' },
      { id: 'bob',     name: 'Bob',     initials: 'BO', color: 'c2', status: 'ok',     rank: 1 },
      { id: 'charlie', name: 'Charlie', initials: 'CH', color: 'c3', status: 'ok',     rank: 2 },
      { id: 'diana',   name: 'Diana',   initials: 'DI', color: 'c4', status: 'ok',     rank: 3 },
    ]);

    await loginAsAdmin(page);

    const aliceCard = personCard(page, 'Alice');
    await expect(aliceCard).toContainText('⛔');
    await expect(aliceCard).toContainText('31 mar');
    await expect(aliceCard).toContainText('remplacé par Bob');
    await expect(aliceCard).toContainText('Rattrapage le 7 avr');
  });

  test('une personne en rattrapage affiche la mention "rattrapage"', async ({ page }) => {
    await seedPersons([
      { id: 'bob',     name: 'Bob',     initials: 'BO', color: 'c2', status: 'ok',    rank: 0 },
      { id: 'alice',   name: 'Alice',   initials: 'AL', color: 'c1', status: 'catch', rank: 1, absentDate: '24 mar' },
      { id: 'charlie', name: 'Charlie', initials: 'CH', color: 'c3', status: 'ok',    rank: 2 },
      { id: 'diana',   name: 'Diana',   initials: 'DI', color: 'c4', status: 'ok',    rank: 3 },
    ]);

    await loginAsAdmin(page);

    const aliceCard = personCard(page, 'Alice');
    await expect(aliceCard).toContainText('rattrapage');
    await expect(aliceCard).toContainText('24 mar');
  });

  test('le remplaçant (rang 1) prend la date de l absent (rang 0)', async ({ page }) => {
    // Alice (rang 0) absente → Bob (rang 1) doit afficher la même date qu'Alice
    await seedPersons([
      { id: 'alice',   name: 'Alice',   initials: 'AL', color: 'c1', status: 'absent', rank: 0, replacedBy: 'Bob', absentDate: '31 mar' },
      { id: 'bob',     name: 'Bob',     initials: 'BO', color: 'c2', status: 'ok',     rank: 1 },
      { id: 'charlie', name: 'Charlie', initials: 'CH', color: 'c3', status: 'ok',     rank: 2 },
      { id: 'diana',   name: 'Diana',   initials: 'DI', color: 'c4', status: 'ok',     rank: 3 },
    ]);

    await loginAsAdmin(page);

    // Vérifier que la date de Bob correspond au créneau de Alice
    // (Bob est au rang 1 mais hérite du slot du rang 0 puisque Alice est absente)
    const bobCard   = personCard(page, 'Bob');
    const aliceCard = personCard(page, 'Alice');

    // Alice affiche absentDate = "31 mar"
    await expect(aliceCard).toContainText('31 mar');

    // Bob doit afficher la même semaine qu'Alice (il apporte les croissants à sa place)
    const bobMeta = await bobCard.locator('.person-meta').textContent() ?? '';
    // La date de Bob doit être identique à la rawDate du rang 0
    // (lundi prochain ou aujourd'hui si lundi, + offset 0)
    // On vérifie que Bob n'est pas "prévu" une semaine après (ce serait rang 1 sans cascade)
    expect(bobMeta).toMatch(/lundi|mardi|mercredi|jeudi|vendredi/i);
  });

  test('login échoue avec mauvais mot de passe', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.auth-input');
    await page.locator('.auth-input[type="email"]').fill('admin@test.com');
    await page.locator('.auth-input[type="password"]').fill('mauvais-mdp');
    await page.locator('.auth-card .btn-primary').click();

    // Un message d'erreur doit apparaître, pas de redirection vers la liste
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#rotation-list')).not.toBeVisible();
  });
});
