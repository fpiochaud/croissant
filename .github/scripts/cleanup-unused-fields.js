// cleanup-unused-fields.js — Purge des champs et collections devenus morts
// suite au nettoyage de code (notifPrefs.swap, rules.manual, promoted,
// sous-collection notifications, pendingSwapNotifications). À lancer une
// seule fois après le déploiement du nettoyage ; sans effet si déjà exécuté.
// Usage: node cleanup-unused-fields.js [--dry-run]
// Requires env var: FIREBASE_SERVICE_ACCOUNT (JSON string du service account)

const admin = require('firebase-admin');

const dryRun = process.argv.includes('--dry-run');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const { FieldValue } = admin.firestore;

async function deleteAllDocs(collectionRef, label) {
  const snap = await collectionRef.get();
  if (snap.empty) {
    console.log(`[${label}] Rien à supprimer.`);
    return;
  }
  console.log(`[${label}] ${snap.size} document(s) à supprimer${dryRun ? ' (dry-run)' : ''}.`);
  if (dryRun) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`[${label}] ${snap.size} document(s) supprimé(s).`);
}

async function main() {
  const teamId = 'equipe-lundi';

  // 1. Champ `promoted` sur les documents persons — écrit lors des
  // promotions de remplaçant, jamais lu par l'app.
  const personsSnap = await db.collection('teams').doc(teamId).collection('persons').get();
  const toClean = personsSnap.docs.filter(d => d.data().promoted !== undefined);
  console.log(`[persons] ${toClean.length} document(s) avec un champ 'promoted'${dryRun ? ' (dry-run)' : ''}.`);
  if (!dryRun && toClean.length) {
    const batch = db.batch();
    toClean.forEach(d => batch.update(d.ref, { promoted: FieldValue.delete() }));
    await batch.commit();
    console.log(`[persons] champ 'promoted' supprimé sur ${toClean.length} document(s).`);
  }

  // 2. Clé `swap` dans notifPrefs sur les documents users — plus de toggle
  // dans l'UI et jamais consommée par send-reminders.js.
  const usersSnap = await db.collection('users').get();
  const usersToClean = usersSnap.docs.filter(d => d.data().notifPrefs?.swap !== undefined);
  console.log(`[users] ${usersToClean.length} document(s) avec 'notifPrefs.swap'${dryRun ? ' (dry-run)' : ''}.`);
  if (!dryRun && usersToClean.length) {
    const batch = db.batch();
    usersToClean.forEach(d => batch.update(d.ref, { 'notifPrefs.swap': FieldValue.delete() }));
    await batch.commit();
    console.log(`[users] 'notifPrefs.swap' supprimé sur ${usersToClean.length} document(s).`);
  }

  // 3. Clé `manual` dans rules sur le document team — jamais exposée dans
  // l'UI (seuls auto/catch ont un toggle).
  const teamRef = db.collection('teams').doc(teamId);
  const teamSnap = await teamRef.get();
  if (teamSnap.data()?.rules?.manual !== undefined) {
    console.log(`[teams/${teamId}] 'rules.manual' présent${dryRun ? ' (dry-run)' : ''}.`);
    if (!dryRun) {
      await teamRef.update({ 'rules.manual': FieldValue.delete() });
      console.log(`[teams/${teamId}] 'rules.manual' supprimé.`);
    }
  } else {
    console.log(`[teams/${teamId}] 'rules.manual' absent, rien à faire.`);
  }

  // 4. Sous-collection teams/{teamId}/notifications — écouteur mort côté
  // app (rien n'écrit dedans, rien ne l'affiche).
  await deleteAllDocs(db.collection('teams').doc(teamId).collection('notifications'), `teams/${teamId}/notifications`);

  // 5. Collection pendingSwapNotifications — plus référencée nulle part
  // (règles Firestore retirées en même temps que ce script).
  await deleteAllDocs(db.collection('pendingSwapNotifications'), 'pendingSwapNotifications');

  // 6. `admins` et `subscriptions` : ancien modèle de données (avant migration
  // vers users/{uid}.role et teams/{teamId}/tokens), non référencé par le code
  // actuel. Listage seul — à supprimer manuellement après vérification.
  for (const name of ['admins', 'subscriptions']) {
    const snap = await db.collection(name).get();
    if (snap.empty) {
      console.log(`[${name}] Collection vide ou inexistante.`);
    } else {
      console.log(`[${name}] ⚠️  ${snap.size} document(s) trouvé(s), non référencés par le code actuel : ${snap.docs.map(d => d.id).join(', ')}`);
      console.log(`[${name}] Non supprimé automatiquement — à vérifier et supprimer manuellement si obsolète.`);
    }
  }
}

main()
  .then(() => { console.log('Terminé.'); process.exit(0); })
  .catch(err => { console.error('Erreur fatale :', err); process.exit(1); });
