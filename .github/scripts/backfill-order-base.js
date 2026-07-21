// backfill-order-base.js — Initialise orderBase = rank pour toutes les
// personnes qui n'ont pas encore ce champ. À lancer une seule fois après le
// déploiement du champ orderBase ; les valeurs sont ensuite ajustées
// manuellement dans la console Firestore.
// Usage: node backfill-order-base.js
// Requires env var: FIREBASE_SERVICE_ACCOUNT (JSON string du service account)

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function main() {
  const teamId = 'equipe-lundi';

  const snap = await db.collection('teams').doc(teamId).collection('persons').get();
  if (snap.empty) {
    console.log(`[${teamId}] Aucune personne trouvée.`);
    return;
  }

  const batch = db.batch();
  let count = 0;

  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (data.orderBase !== undefined) {
      console.log(`[${teamId}] ${data.name ?? docSnap.id} : orderBase déjà défini (${data.orderBase}), ignoré.`);
      return;
    }
    const rank = data.rank ?? 0;
    batch.update(docSnap.ref, { orderBase: rank });
    console.log(`[${teamId}] ${data.name ?? docSnap.id} : orderBase = ${rank}`);
    count++;
  });

  if (count === 0) {
    console.log(`[${teamId}] Rien à mettre à jour.`);
    return;
  }

  await batch.commit();
  console.log(`[${teamId}] ${count} personne(s) mise(s) à jour.`);
}

main()
  .then(() => { console.log('Terminé.'); process.exit(0); })
  .catch(err => { console.error('Erreur fatale :', err); process.exit(1); });
