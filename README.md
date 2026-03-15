# 🥐 Croissants du lundi

PWA de gestion du planning de croissants pour votre équipe.
Notifications push via Firebase Cloud Messaging.

## Stack

- HTML / CSS / JS vanilla (zéro framework, zéro bundler)
- Firebase Firestore (état partagé temps réel)
- Firebase Cloud Messaging (notifications push)
- GitHub Pages (hébergement)

## Fichiers

```
├── index.html        # PWA principale
├── firebase-sw.js    # Service Worker FCM
├── firestore.rules   # Règles de sécurité Firestore
└── README.md
```

## Installation

### 1. Cloner le repo

```bash
git clone https://github.com/VOTRE_PSEUDO/croissants-app.git
cd croissants-app
```

### 2. Configurer Firebase

1. Créer un projet sur [console.firebase.google.com](https://console.firebase.google.com)
2. Activer **Firestore Database** et **Cloud Messaging**
3. Récupérer les clés SDK : Console → Paramètres projet → Vos applications
4. Remplacer les `YOUR_*` dans `index.html` ET dans `firebase-sw.js`
5. Récupérer la clé **VAPID** : Cloud Messaging → Certificats push web

```js
// Dans index.html et firebase-sw.js
const FIREBASE_CONFIG = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "VOTRE_PROJECT_ID.firebaseapp.com",
  projectId:         "VOTRE_PROJECT_ID",
  storageBucket:     "VOTRE_PROJECT_ID.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId:             "VOTRE_APP_ID"
};
const VAPID_KEY = "VOTRE_VAPID_PUBLIC_KEY";
```

### 3. Déployer les règles Firestore

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # choisir votre projet
firebase deploy --only firestore:rules
```

### 4. Activer GitHub Pages

Settings → Pages → Branch: `main` / `/ (root)` → Save

L'app sera disponible sur : `https://VOTRE_PSEUDO.github.io/croissants-app/`

### 5. Autoriser le domaine dans Firebase

Console Firebase → Authentication → Domaines autorisés → Ajouter `VOTRE_PSEUDO.github.io`

## Utilisation

1. Ouvrir l'URL sur mobile
2. Installer l'app : iOS (Safari → Partager → Sur l'écran d'accueil) / Android (Menu → Ajouter à l'écran d'accueil)
3. Chaque membre de l'équipe doit ouvrir l'app et cliquer **"Activer les notifications"**
4. Lors d'un remplacement, tous les membres reçoivent un push automatiquement

## Cloud Function (notifications push)

Pour envoyer les pushs aux collègues, déployez cette Cloud Function :

```bash
firebase init functions   # choisir Node.js
```

```js
// functions/index.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp }     = require("firebase-admin/app");
const { getFirestore }      = require("firebase-admin/firestore");
const { getMessaging }      = require("firebase-admin/messaging");

initializeApp();

exports.onNewNotification = onDocumentCreated(
  "teams/{teamId}/notifications/{notifId}",
  async (event) => {
    const { text } = event.data.data();
    const teamId   = event.params.teamId;
    const db       = getFirestore();

    const subs = await db.collection("subscriptions")
      .where("teamId", "==", teamId).get();
    const tokens = subs.docs.map(d => d.data().token).filter(Boolean);

    if (!tokens.length) return;

    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: "🥐 Croissants", body: text },
      webpush: {
        notification: { icon: "/icon-192.png", badge: "/icon-72.png" }
      }
    });
  }
);
```

```bash
firebase deploy --only functions
```

## Sécurité

Les clés Firebase côté client sont **publiques par design** (c'est la norme Firebase).
La sécurité repose sur les **Firestore Security Rules** — voir `firestore.rules`.

---

Made with ☕ and 🥐
