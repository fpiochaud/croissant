// Les variables d'environnement DOIVENT être définies avant d'importer firebase-admin.
// Elles sont initialisées dans e2e/global-setup.ts qui s'exécute en premier.
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import {
  TEST_TEAM_ID,
  TEST_PERSONS,
  TEST_USERS,
  makeTeamDoc,
  TeamDocOverrides,
} from '../fixtures/data';

const PROJECT_ID = 'demo-croissant';
const FIRESTORE_BASE = `http://localhost:8080/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_BASE = `http://localhost:9099/emulator/v1/projects/${PROJECT_ID}/accounts`;

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ projectId: PROJECT_ID });
}

function db(): Firestore { return getFirestore(getAdminApp()); }
function auth(): Auth    { return getAuth(getAdminApp()); }

/** Efface toutes les données Firestore et Auth des émulateurs. */
export async function clearEmulators(): Promise<void> {
  await Promise.all([
    fetch(FIRESTORE_BASE, { method: 'DELETE' }),
    fetch(AUTH_BASE, { method: 'DELETE' }),
  ]);
  // Laisser le temps aux émulateurs de finaliser la suppression
  await new Promise(r => setTimeout(r, 100));
}

/** Peuple les émulateurs avec les données de test de base. */
export async function seedTestData(teamOverrides: TeamDocOverrides = {}): Promise<void> {
  await clearEmulators();

  // Batch Firestore : team doc + persons + user docs
  const batch = db().batch();
  batch.set(db().collection('teams').doc(TEST_TEAM_ID), makeTeamDoc(teamOverrides));
  for (const person of TEST_PERSONS) {
    const { id, ...data } = person;
    batch.set(db().collection('teams').doc(TEST_TEAM_ID).collection('persons').doc(id), data);
  }
  for (const user of TEST_USERS) {
    batch.set(db().collection('users').doc(user.uid), {
      email: user.email,
      role: user.role,
      notifPrefs: { eve: false, morning: false, swap: false },
    });
  }

  // Paralléliser : auth creates + commit Firestore en une seule passe
  await Promise.all([
    ...TEST_USERS.map(u => auth().createUser({ uid: u.uid, email: u.email, password: u.password })),
    batch.commit(),
  ]);
}

/** Remplace les personnes dans Firestore par une liste personnalisée. */
export async function seedPersons(
  persons: Array<{
    id: string;
    name: string;
    initials: string;
    color: string;
    status: string;
    rank: number;
    email?: string;
    replacedBy?: string | null;
    absentDate?: string | null;
    catchupDate?: string | null;
  }>,
): Promise<void> {
  const col = db().collection('teams').doc(TEST_TEAM_ID).collection('persons');
  const existing = await col.get();
  const deleteBatch = db().batch();
  existing.docs.forEach(d => deleteBatch.delete(d.ref));
  await deleteBatch.commit();

  const writeBatch = db().batch();
  for (const person of persons) {
    const { id, ...data } = person;
    writeBatch.set(col.doc(id), data);
  }
  await writeBatch.commit();
}

/** Met à jour le document équipe. */
export async function updateTeamDoc(updates: Record<string, unknown>): Promise<void> {
  await db().collection('teams').doc(TEST_TEAM_ID).update(updates);
}

/** Lit le document équipe depuis Firestore. */
export async function getTeamDoc(): Promise<Record<string, unknown>> {
  const snap = await db().collection('teams').doc(TEST_TEAM_ID).get();
  return snap.data() ?? {};
}

/** Lit les personnes triées par rang depuis Firestore. */
export async function getPersonsFromDb(): Promise<Array<Record<string, unknown>>> {
  const snap = await db()
    .collection('teams').doc(TEST_TEAM_ID).collection('persons')
    .orderBy('rank')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Lit les personnes ayant un email donné depuis Firestore. */
export async function getPersonsByEmail(email: string): Promise<Array<Record<string, unknown>>> {
  const snap = await db()
    .collection('teams').doc(TEST_TEAM_ID).collection('persons')
    .where('email', '==', email)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Crée un utilisateur Firebase Auth uniquement (sans document Firestore). */
export async function createAuthUser(user: { uid: string; email: string; password: string }): Promise<void> {
  await auth().createUser({ uid: user.uid, email: user.email, password: user.password });
}

/** Crée un document users/{uid} dans Firestore (simule une première connexion partiellement réussie). */
export async function createUserDoc(uid: string, email: string): Promise<void> {
  await db().collection('users').doc(uid).set({
    email,
    role: 'member',
    notifPrefs: { eve: true, morning: true, swap: true },
  });
}
