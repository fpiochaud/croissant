// send-reminders.js
// Usage: node send-reminders.js <eve|morning|swap>
// Requires env var: FIREBASE_SERVICE_ACCOUNT (JSON string du service account)

const admin = require('firebase-admin');

const type  = process.argv[2];
const force = process.argv.includes('--force');
if (!['eve', 'morning'].includes(type)) {
  console.error('Usage: node send-reminders.js <eve|morning> [--force]');
  process.exit(1);
}

// Initialise Firebase Admin avec le service account stocké en secret GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db  = admin.firestore();
const fcm = admin.messaging();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getNextPerson(teamId) {
  const personsSnap = await db.collection('teams').doc(teamId).collection('persons').orderBy('rank').get();
  const persons = personsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (!persons.length) return null;
  // Le premier de la liste (rank=0) est toujours le prochain
  return persons[0];
}

async function getFilteredTokens(teamId, type) {
  const tokenSnap = await db.collection('teams').doc(teamId).collection('tokens').get();
  const allTokenDocs = tokenSnap.docs.map(d => d.data()).filter(d => d.token);

  // Récupère les utilisateurs et leurs préférences
  const usersSnap = await db.collection('users').get();
  const prefsByEmail = {};
  usersSnap.docs.forEach(d => {
    const data = d.data();
    if (data.email) prefsByEmail[data.email] = data.notifPrefs ?? {};
  });

  // Filtre par préférence
  const eligible = allTokenDocs.filter(d => !d.email || (prefsByEmail[d.email]?.[type] === true));

  // Log détaillé pour diagnostic
  eligible.forEach(d => console.log(`  token: ...${d.token?.slice(-10)}  email: ${d.email ?? '(null)'}  updatedAt: ${d.updatedAt?.toDate?.()}`));

  // Déduplique par email : 1 seul token par utilisateur (le plus récent)
  const byEmail = new Map();
  for (const d of eligible) {
    const key = d.email || null; // null si email absent/vide
    if (key === null) {
      // Pas d'email : on garde le plus récent parmi les tokens sans email
      const existing = byEmail.get('__no_email__');
      const existingTs = existing?.updatedAt?.toMillis?.() ?? 0;
      const currentTs  = d.updatedAt?.toMillis?.() ?? 0;
      if (!existing || currentTs > existingTs) byEmail.set('__no_email__', d);
    } else {
      const existing = byEmail.get(key);
      const existingTs = existing?.updatedAt?.toMillis?.() ?? 0;
      const currentTs  = d.updatedAt?.toMillis?.() ?? 0;
      if (!existing || currentTs > existingTs) byEmail.set(key, d);
    }
  }

  const tokens = [...byEmail.values()].map(d => d.token);
  console.log(`[${teamId}] ${tokens.length} token(s) éligible(s) (${allTokenDocs.length} total, ${eligible.length} après filtre préfs)`);
  return tokens;
}

async function sendToTeam(teamId, type, title, body) {
  const tokens = await getFilteredTokens(teamId, type);
  if (!tokens.length) {
    console.log(`[${teamId}] Aucun token éligible — notification ignorée.`);
    return;
  }

  const response = await fcm.sendEachForMulticast({
    tokens,
    data: { msgTitle: title, msgBody: body },
    webpush: {
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
  const teamId = 'equipe-lundi';

  // Anti-doublon : on ne veut qu'un seul envoi par type et par jour
  const today = new Date().toISOString().split('T')[0]; // ex: "2026-03-22"
  const sentRef = db.collection('teams').doc(teamId).collection('remindersSent').doc(`${type}-${today}`);
  if (!force) {
    const sentSnap = await sentRef.get();
    if (sentSnap.exists) {
      console.log(`[${teamId}] Rappel "${type}" déjà envoyé aujourd'hui (${today}), abandon. (utiliser --force pour forcer)`);
      return;
    }
  } else {
    console.log(`[${teamId}] Mode --force : envoi forcé même si déjà envoyé.`);
  }

  const person = await getNextPerson(teamId);
  if (!person) {
    console.log(`[${teamId}] Aucune personne dans la rotation.`);
    return;
  }

  const { title, body } = buildMessage(type, person.name);
  console.log(`[${teamId}] Envoi : "${title}" — "${body}"`);
  await sendToTeam(teamId, type, title, body);

  // Marque comme envoyé
  await sentRef.set({ sentAt: admin.firestore.FieldValue.serverTimestamp(), type, personName: person.name });
}

main()
  .then(() => { console.log('Terminé.'); process.exit(0); })
  .catch(err => { console.error('Erreur :', err); process.exit(1); });
