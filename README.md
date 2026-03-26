# 🥐 Croissants du lundi

PWA Angular de gestion du planning de croissants d'équipe. Chaque semaine, un membre apporte les croissants selon un ordre de rotation. L'application gère la liste des membres, les absences et remplacements, l'historique, et envoie des notifications push la veille et le matin du jour J.

> Pour une description détaillée du fonctionnement, des rôles et du modèle de données, voir la [documentation complète](docs/fonctionnement.md).

## Stack

- **Angular 21** — composants standalone, Signals
- **Firebase Firestore** — état partagé temps réel
- **Firebase Authentication** — connexion email/mot de passe
- **Firebase Cloud Messaging** — notifications push
- **Firebase Hosting** — hébergement de la PWA
- **GitHub Actions** — CI/CD, déploiement automatique, rappels planifiés

---

## Lancer en local

### 1. Prérequis

```bash
node >= 20
npm >= 11
```

### 2. Cloner et installer

```bash
git clone <url-du-repo>
cd croissant
npm install
cd .github/scripts && npm install && cd ../..
```

### 3. Configurer Firebase (local)

Copier le template et remplir avec vos identifiants Firebase :

```bash
cp public/firebase-config.example.js public/firebase-config.js
```

Éditer `public/firebase-config.js` avec vos valeurs (voir section [Variables](#variables-et-où-les-trouver)).

Éditer `src/environments/environment.local.ts` avec les mêmes valeurs :

```ts
export const environment = {
  production: false,
  teamId: 'equipe-dev',       // ID du document équipe dans Firestore
  firebase: {
    apiKey:            'VOTRE_API_KEY',
    authDomain:        'VOTRE_PROJECT_ID.firebaseapp.com',
    projectId:         'VOTRE_PROJECT_ID',
    storageBucket:     'VOTRE_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'VOTRE_MESSAGING_SENDER_ID',
    appId:             'VOTRE_APP_ID',
  },
  vapidKey: 'VOTRE_VAPID_KEY',
};
```

### 4. Démarrer

```bash
npm start
```

L'app tourne sur `http://localhost:4200` avec la configuration `local` (pointe sur `environment.local.ts`).

---

## Déployer sur Firebase Hosting

### 1. Installer Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### 2. Déployer manuellement

```bash
npm run build
npx firebase-tools deploy --only hosting --project VOTRE_PROJECT_ID
```

### 3. Déploiement automatique via GitHub Actions

Le workflow `release.yml` se déclenche à chaque push sur `main` :
- Bumpe la version (semantic versioning basé sur les préfixes de commit : `feat:` → mineur, `fix:` → patch)
- Met à jour `CHANGELOG.md` et `src/version.ts`
- Build et déploie sur Firebase Hosting
- Crée un tag git et une GitHub Release

Il nécessite les secrets GitHub suivants (voir section [Variables](#variables-et-où-les-trouver)) :

| Secret GitHub | Description |
|---|---|
| `FIREBASE_API_KEY` | Clé API Firebase |
| `FIREBASE_AUTH_DOMAIN` | Domaine auth Firebase |
| `FIREBASE_PROJECT_ID` | ID du projet Firebase |
| `FIREBASE_STORAGE_BUCKET` | Bucket Storage Firebase |
| `FIREBASE_MESSAGING_SENDER_ID` | Sender ID FCM |
| `FIREBASE_APP_ID` | App ID Firebase |
| `FIREBASE_VAPID_KEY` | Clé VAPID pour les notifications push |
| `FIREBASE_SERVICE_ACCOUNT` | JSON du compte de service Firebase (pour les scripts Node.js) |
| `FIREBASE_TOKEN` | Token CLI Firebase (pour le déploiement) |

---

## Rappels automatiques

Deux workflows GitHub Actions envoient des notifications push à l'équipe chaque dimanche :

| Workflow | Heure (Noumea UTC+11) | Action |
|---|---|---|
| `reminder-eve.yml` | Dimanche 18h00 | Rappel la veille + suppression des comptes en attente |
| `reminder-morning.yml` | Lundi 06h25 | Rappel le matin du jour J |

Ils peuvent aussi être déclenchés manuellement depuis l'onglet **Actions** de GitHub avec une option `--force` pour ignorer l'anti-doublon.

---

## Variables et où les trouver

### Variables Firebase (console web)

Toutes accessibles dans la [Console Firebase](https://console.firebase.google.com) → votre projet → ⚙️ Paramètres du projet → Vos applications → SDK Firebase.

| Variable | Où la trouver |
|---|---|
| `FIREBASE_API_KEY` | Console Firebase → Paramètres projet → Vos applications → `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | Console Firebase → Paramètres projet → Vos applications → `authDomain` |
| `FIREBASE_PROJECT_ID` | Console Firebase → Paramètres projet → `ID du projet` |
| `FIREBASE_STORAGE_BUCKET` | Console Firebase → Paramètres projet → Vos applications → `storageBucket` |
| `FIREBASE_MESSAGING_SENDER_ID` | Console Firebase → Paramètres projet → Vos applications → `messagingSenderId` |
| `FIREBASE_APP_ID` | Console Firebase → Paramètres projet → Vos applications → `appId` |
| `FIREBASE_VAPID_KEY` | Console Firebase → Cloud Messaging → Configuration du Web → Certificats push web → Clé publique |
| `FIREBASE_SERVICE_ACCOUNT` | Console Firebase → Paramètres projet → Comptes de service → Générer une nouvelle clé privée (fichier JSON complet) |

### Variable Firebase CLI

| Variable | Comment l'obtenir |
|---|---|
| `FIREBASE_TOKEN` | En local : `firebase login:ci` — copier le token affiché |

### Variable GitHub Actions (automatique)

| Variable | Description |
|---|---|
| `GITHUB_TOKEN` | Fourni automatiquement par GitHub Actions — aucune configuration nécessaire |

---

## Structure du projet

```
src/
├── app/
│   ├── component/
│   │   ├── header/          # En-tête avec prochain passage
│   │   ├── navigation/      # Onglets de navigation
│   │   ├── rotation/        # Liste de la rotation
│   │   ├── remplacement/    # Déclarer une absence / remplaçant
│   │   ├── historique/      # Historique des rotations
│   │   ├── rappels/         # Préférences de notifications
│   │   ├── parametres/      # Réglages (admin)
│   │   ├── login/           # Authentification
│   │   ├── sync-bar/        # Indicateur de synchronisation
│   │   └── modaux/          # Fenêtres modales (ajout, édition, suppression)
│   ├── croissant.service.ts # Service principal (état, Firebase, logique métier)
│   └── app.html             # Racine de l'application
├── environments/
│   ├── environment.ts           # Dev (valeurs vides)
│   ├── environment.local.ts     # Local (⚠️ non commité)
│   └── environment.prod.ts      # Production (⚠️ généré par CI)
public/
├── firebase-config.js           # Config SW (⚠️ non commité)
├── firebase-config.example.js   # Template à copier
└── firebase-messaging-sw.js     # Service Worker FCM
.github/
├── workflows/
│   ├── release.yml              # Build + déploiement auto
│   ├── reminder-eve.yml         # Rappel dimanche soir
│   ├── reminder-morning.yml     # Rappel lundi matin
│   └── pr-check.yml             # Vérification build sur PR
└── scripts/
    ├── send-reminders.js        # Envoi des notifications FCM
    ├── delete-users.js          # Suppression des comptes en attente
    └── bump-version.js          # Gestion du versioning sémantique
```

---

Made with ☕ and 🥐
