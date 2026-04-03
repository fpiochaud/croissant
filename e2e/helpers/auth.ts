import type { Page } from '@playwright/test';
import { TEST_ADMIN } from '../fixtures/data';

/** Connecte un utilisateur via le formulaire de login et attend la liste de rotation. */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('.auth-input', { timeout: 10_000 });
  await page.locator('.auth-input[type="email"]').fill(email);
  await page.locator('.auth-input[type="password"]').fill(password);
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('#rotation-list', { timeout: 15_000 });
}

/** Connecte l'administrateur de test. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, TEST_ADMIN.email, TEST_ADMIN.password);
}

/** Déconnecte l'utilisateur courant via le menu header et attend le formulaire de login. */
export async function logout(page: Page): Promise<void> {
  await page.locator('.header-settings').last().click();
  await page.locator('.account-dropdown-logout').click();
  await page.waitForSelector('.auth-input', { timeout: 10_000 });
}
