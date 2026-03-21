// send-swap-notifs.js — Envoie les notifications de remplacement en attente
// Déclenché par GitHub Actions toutes les 10 minutes
// Requires env var: FIREBASE_SERVICE_ACCOUNT (JSON string du service account)

const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db  = admin.firestore();
const fcm = admin.messaging();

async function getFilteredTokens(teamId) {
  const tokenSnap = await db.collection('teams').doc(teamId).collection('tokens').get();
  const allTokenDocs = tokenSnap.docs.map(d => d.data()).filter(d => d.token);

  const usersSnap = await db.collection('users').get();
  const prefsByEmail = {};
  usersSnap.docs.forEach(d => {
    const data = d.data();
    if (data.email) prefsByEmail[data.email] = data.notifPrefs ?? {};
  });

  return allTokenDocs
    .filter(d => !d.email || (prefsByEmail[d.email]?.swap === true))
    .map(d => d.token);
}

async function main() {
  const snap = await db.collection('pendingSwapNotifications').get();
  if (snap.empty) {
    console.log('Aucune notification en attente.');
    return;
  }

  for (const notifDoc of snap.docs) {
    const { teamId, title, body } = notifDoc.data();
    const tokens = await getFilteredTokens(teamId);
    if (!tokens.length) {
      console.log(`[${teamId}] Aucun token — notification ignorée.`);
      await notifDoc.ref.delete();
      continue;
    }

    const response = await fcm.sendEachForMulticast({
      tokens,
      notification: { title, body },
      webpush: {
        notification: { icon: '/favicon.ico', badge: '/favicon.ico' },
        fcmOptions: { link: '/' },
      },
    });

    console.log(`[${teamId}] ${response.successCount}/${tokens.length} notifications envoyées : "${body}"`);

    // Supprime les tokens invalides
    const toDelete = [];
    response.responses.forEach((r, i) => {
      if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
        toDelete.push(
          db.collection('teams').doc(teamId).collection('tokens').doc(tokens[i].slice(0, 40)).delete()
        );
      }
    });
    if (toDelete.length) await Promise.all(toDelete);

    // Supprime la notification traitée
    await notifDoc.ref.delete();
  }
}

main()
  .then(() => { console.log('Terminé.'); process.exit(0); })
  .catch(err => { console.error('Erreur :', err); process.exit(1); });
