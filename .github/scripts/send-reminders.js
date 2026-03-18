// send-reminders.js
// Usage: node send-reminders.js <eve|morning|swap>
// Requires env var: FIREBASE_SERVICE_ACCOUNT (JSON string du service account)

const admin = require('firebase-admin');

const type = process.argv[2];
if (!['eve', 'morning'].includes(type)) {
  console.error('Usage: node send-reminders.js <eve|morning>');
  process.exit(1);
}

// Initialise Firebase Admin avec le service account stocké en secret GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db  = admin.firestore();
const fcm = admin.messaging();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getNextPerson(teamId) {
  const [teamSnap, personsSnap] = await Promise.all([
    db.collection('teams').doc(teamId).get(),
    db.collection('teams').doc(teamId).collection('persons').orderBy('rank').get(),
  ]);
  const currentIndex = teamSnap.data()?.currentIndex ?? 0;
  const persons = personsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!persons.length) return null;
  return persons[currentIndex % persons.length];
}

async function getTokens(teamId) {
  const snap = await db.collection('teams').doc(teamId).collection('tokens').get();
  return snap.docs.map(d => d.data().token).filter(Boolean);
}

async function sendToTeam(teamId, title, body) {
  const tokens = await getTokens(teamId);
  if (!tokens.length) {
    console.log(`[${teamId}] Aucun token — notification ignorée.`);
    return;
  }

  const response = await fcm.sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: { icon: '/favicon.ico', badge: '/favicon.ico' },
      fcmOptions: { link: '/' },
    },
  });

  console.log(`[${teamId}] ${response.successCount}/${tokens.length} notifications envoyées.`);

  // Supprime les tokens invalides (appareil désinstallé, etc.)
  const toDelete = [];
  response.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
      toDelete.push(
        db.collection('teams').doc(teamId).collection('tokens').doc(tokens[i].slice(0, 40)).delete()
      );
    }
  });
  if (toDelete.length) {
    await Promise.all(toDelete);
    console.log(`[${teamId}] ${toDelete.length} token(s) invalide(s) supprimé(s).`);
  }
}

// ─── Messages selon le type ─────────────────────────────────────────────────

function buildMessage(type, personName) {
  if (type === 'eve') {
    return {
      title: '🥐 Rappel croissants',
      body: `C'est ${personName} qui apporte les croissants demain !`,
    };
  }
  return {
    title: '🥐 Croissants du lundi !',
    body: `C'est ${personName} qui apporte les croissants ce matin !`,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const teamsSnap = await db.collection('teams').get();
  if (teamsSnap.empty) {
    console.log('Aucune équipe trouvée.');
    return;
  }

  for (const teamDoc of teamsSnap.docs) {
    const notifPrefs = teamDoc.data().notifPrefs ?? {};
    if (!notifPrefs[type]) {
      console.log(`[${teamDoc.id}] Préférence "${type}" désactivée — ignoré.`);
      continue;
    }

    const person = await getNextPerson(teamDoc.id);
    if (!person) {
      console.log(`[${teamDoc.id}] Aucune personne dans la rotation.`);
      continue;
    }

    const { title, body } = buildMessage(type, person.name);
    console.log(`[${teamDoc.id}] Envoi : "${title}" — "${body}"`);
    await sendToTeam(teamDoc.id, title, body);
  }
}

main()
  .then(() => { console.log('Terminé.'); process.exit(0); })
  .catch(err => { console.error('Erreur :', err); process.exit(1); });
