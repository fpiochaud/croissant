import type { Page } from '@playwright/test';
import { TEST_ADMIN } from '../fixtures/data';

/** Connecte un utilisateur via le formulaire de login et attend la liste de rotation. */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('.auth-input', { timeout: 10_000 });
  await page.locator('.auth-input[type="email"]').fill(email);
  await page.locator('.auth-input[type="password"]').fill(password);
  await page.locator('.auth-card .btn-primary').click();
  // Attendre que les personnes soient chargées depuis Firestore (pas juste le div vide).
  // On attend au moins 1 card pour les connexions "new user" (1 seul membre créé),
  // mais loginAsAdmin attend le 5ème card explicitement (voir ci-dessous).
  await page.waitForSelector('#rotation-list .person-card', { timeout: 15_000 });
}

/** Connecte l'administrateur de test et attend que les 5 personnes soient chargées. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
  // loginAs attend le 1er card — on attend ensuite le 5ème pour s'assurer que
  // tous les membres (Alice, Bob, Charlie, Diana, Admin) sont bien rendus.
  await page.waitForSelector('#rotation-list .person-card:nth-child(5)', { timeout: 10_000 });
}

/** Déconnecte l'utilisateur courant via le menu header et attend le formulaire de login. */
export async function logout(page: Page): Promise<void> {
  await page.locator('.header-settings').last().click();
  await page.locator('.account-dropdown-logout').click();
  await page.waitForSelector('.auth-input', { timeout: 10_000 });
}
