/**
 * Tests de la page d'administration (liste des utilisateurs, réservée au rôle admin).
 */

import { test, expect } from '@playwright/test';
import { seedTestData } from '../helpers/seed';
import { loginAsAdmin, loginAs } from '../helpers/auth';
import { TEST_USERS } from '../fixtures/data';

const alice = TEST_USERS.find(u => u.email === 'alice@test.com')!;

test.describe('Page admin', () => {
  test.beforeEach(async () => {
    await seedTestData();
  });

  test('un membre non-admin ne voit pas l\'onglet admin', async ({ page }) => {
    await loginAs(page, alice.email, alice.password);
    await expect(page.locator('[data-testid="nav-admin"]')).toHaveCount(0);
  });

  test('un admin voit l\'onglet et la liste triée par rang, avec dernière connexion et version', async ({ page }) => {
    await loginAsAdmin(page);

    await page.locator('[data-testid="nav-admin"]').click();
    await page.waitForSelector('#admin-list .person-card');

    // On lit uniquement le premier nœud texte (le nom) pour ignorer le badge "Admin" du rôle,
    // qui entrerait sinon en collision avec le nom "Admin" du 5ème membre de test.
    const names = await page.locator('#admin-list .person-name').evaluateAll(nodes =>
      nodes.map(n => (n.childNodes[0]?.textContent ?? '').trim())
    );
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'Diana', 'Admin']);

    // Admin vient de se connecter : compte lié, avec dernière connexion + version affichées.
    const adminMeta = await page.locator('#admin-list .person-card').last().locator('.person-meta').textContent();
    expect(adminMeta).toMatch(/Dernière connexion/);
    expect(adminMeta).toMatch(/Version chargée/);

    // Bob/Charlie/Diana n'ont pas de compte Firebase Auth dans le seed de base.
    const bobMeta = await page.locator('#admin-list .person-card').nth(1).locator('.person-meta').textContent();
    expect(bobMeta).toMatch(/Aucun compte associé/);
  });
});
