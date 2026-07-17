// Définir les variables d'environnement des émulateurs avant tout import firebase-admin.
// Ces variables doivent être présentes dans le processus Playwright (tests + global setup).
process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080';
process.env['FIREBASE_AUTH_EMULATOR_HOST'] = 'localhost:9099';

export default async function globalSetup() {
  // Les émulateurs sont déjà démarrés par playwright webServer (attente via url).
  // On initialise ici firebase-admin pour que les env vars soient définies
  // avant que les tests appellent seedTestData().
}
