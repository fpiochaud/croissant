// delete-users.js — Supprime de Firebase Auth les utilisateurs en attente
// Déclenché par GitHub Actions toutes les heures
// Requires env var: FIREBASE_SERVICE_ACCOUNT (JSON string du service account)

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db   = admin.firestore();
const auth = admin.auth();

async function main() {
  const snap = await db.collection('pendingDeletions').get();

  if (snap.empty) {
    console.log('Aucune suppression en attente.');
    return;
  }

  for (const docSnap of snap.docs) {
    const { email, personName } = docSnap.data();

    if (!email) {
      console.warn(`[${docSnap.id}] Pas d'email — ignoré.`);
      await docSnap.ref.delete();
      continue;
    }

    try {
      const user = await auth.getUserByEmail(email);
      await auth.deleteUser(user.uid);
      console.log(`✅ ${personName ?? email} supprimé de Firebase Auth.`);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.log(`ℹ️  ${email} introuvable dans Auth (déjà supprimé).`);
      } else {
        console.error(`❌ Erreur pour ${email} :`, err.message);
        continue; // Ne pas supprimer le doc si l'erreur est inattendue
      }
    }

    await docSnap.ref.delete();
    console.log(`🗑  Entrée pendingDeletions supprimée pour ${email}.`);
  }
}

main()
  .then(() => { console.log('Terminé.'); process.exit(0); })
  .catch(err => { console.error('Erreur fatale :', err); process.exit(1); });
