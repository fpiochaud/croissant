/**
 * Bug — Création automatique du membre dans le team à la première connexion.
 *
 * Cause : addPersonFromEmail n'était appelé que dans le bloc if(!userSnap.exists()).
 * Si la première connexion échouait silencieusement (exception non catchée dans
 * onAuthStateChanged), users/{uid} était créé mais pas la personne dans le team.
 * Lors des connexions suivantes, le bloc else s'exécutait et addPersonFromEmail
 * n'était jamais rappelé → la personne n'était jamais créée.
 *
 * Fix : addPersonFromEmail est appelé à chaque connexion, indépendamment de
 * l'existence de users/{uid}, avec un try/catch pour ne pas bloquer l'auth.
 * La fonction est idempotente grâce au check doublon interne.
 *
 * Les tests ÉCHOUENT avec le code avant correctif.
 * Les tests PASSENT après correctif.
 */

import { test, expect } from '@playwright/test';
import { seedTestData } from '../helpers/seed';
import { loginAs } from '../helpers/auth';
import {
  createAuthUser,
  createUserDoc,
  getPersonsByEmail,
} from '../helpers/seed';
import { logout } from '../helpers/auth';

const NEW_USER = {
  uid:      'newuser-uid',
  email:    'leoncamet@outlook.com',
  password: 'password123',
};

test.describe('Création automatique du membre à la connexion', () => {

  test.beforeEach(async () => {
    await seedTestData();
    await createAuthUser(NEW_USER);
  });

  // ── Bug principal ──────────────────────────────────────────────────────────

  test('reconnexion quand users/{uid} existe mais pas la personne → personne créée', async ({ page }) => {
    // Simule un premier login partiellement réussi :
    // users/{uid} a été créé mais addPersonFromEmail a échoué.
    await createUserDoc(NEW_USER.uid, NEW_USER.email);

    // Aucune personne dans le team pour cet email
    const before = await getPersonsByEmail(NEW_USER.email);
    expect(before).toHaveLength(0);

    await loginAs(page, NEW_USER.email, NEW_USER.password);

    // La personne doit être créée lors de cette connexion
    const after = await getPersonsByEmail(NEW_USER.email);
    expect(after).toHaveLength(1);
    expect(after[0]['email']).toBe(NEW_USER.email);
  });

  // ── Cas nominal ───────────────────────────────────────────────────────────

  test('première connexion → personne créée automatiquement dans le team', async ({ page }) => {
    // Ni users/{uid} ni personne dans le team
    const before = await getPersonsByEmail(NEW_USER.email);
    expect(before).toHaveLength(0);

    await loginAs(page, NEW_USER.email, NEW_USER.password);

    const after = await getPersonsByEmail(NEW_USER.email);
    expect(after).toHaveLength(1);
    expect(after[0]['email']).toBe(NEW_USER.email);
  });

  test('le nom et les initiales sont dérivés de l email', async ({ page }) => {
    await loginAs(page, NEW_USER.email, NEW_USER.password);

    const persons = await getPersonsByEmail(NEW_USER.email);
    expect(persons).toHaveLength(1);
    // leoncamet@outlook.com → prefix sans séparateur → "Leoncamet" / "LE"
    expect(persons[0]['name']).toBe('Leoncamet');
    expect(persons[0]['initials']).toBe('LE');
  });

  // ── Idempotence ────────────────────────────────────────────────────────────

  test('connexions multiples → pas de doublon dans le team', async ({ page }) => {
    await loginAs(page, NEW_USER.email, NEW_USER.password);
    await logout(page);
    await loginAs(page, NEW_USER.email, NEW_USER.password);

    const persons = await getPersonsByEmail(NEW_USER.email);
    expect(persons).toHaveLength(1);
  });

});
