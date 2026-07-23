# AGENTS.md — Croissants du lundi

Ce fichier documente le projet pour un agent IA qui reprend le travail dessus.
Objectif : donner en une lecture tout ce qu'il faut savoir sans avoir à
ré-explorer le repo. Voir aussi [docs/fonctionnement.md](docs/fonctionnement.md)
(fonctionnel détaillé) et [docs/versioning.md](docs/versioning.md) (release).

## En une phrase

PWA Angular (standalone components + Signals) qui gère le planning tournant
des croissants d'une équipe, avec Firestore comme état partagé temps réel et
FCM pour les rappels push.

## Stack

- **Angular 22** (`@angular/*` ^22.0.7) — standalone components, `signal()`/`computed()`, pas de NgModules, pas de zone.js implicite documenté ailleurs (vérifier `app.config.ts` si besoin)
- **Firebase** (`firebase` ^12.14.0, SDK client) : Firestore (data), Auth (email/mdp), Cloud Messaging (push), Hosting (déploiement)
- **firebase-admin** / **firebase-tools** : utilisés uniquement côté scripts Node (`.github/scripts/`), pas dans l'app
- **RxJS** ~7.8 (dépendance Angular, peu utilisée directement — l'état passe surtout par les Signals)
- **Vitest** — tests unitaires (`npm test`)
- **Playwright** — tests e2e contre les émulateurs Firebase (`npm run e2e`)
- **Prettier** (`.prettierrc`: printWidth 100, singleQuote, parser angular pour les `.html`)
- Node ≥20 requis, Volta épingle `node 24.18.0` / `npm 11.18.0`

## Structure

```
src/app/
├── croissant.service.ts     # SEUL point d'accès à Firebase. État global via signal `state`.
├── rotation-logic.ts         # Logique pure (dates, rotation, remplacement) — zéro dépendance Firestore, testée unitairement
├── rotation-logic.spec.ts    # Tests Vitest de rotation-logic.ts
├── app.ts / app.html / app.css  # Shell racine : swipe tactile entre onglets, détection de mise à jour PWA
├── app.routes.ts             # Vide — pas de routing, navigation gérée par activeTab (signal) dans le service
├── app.config.ts             # ApplicationConfig Angular (providers globaux)
└── component/
    ├── login/           # Écran de connexion Firebase Auth
    ├── header/           # En-tête, affiche le prochain passage
    ├── navigation/        # Onglets (rotation / remplacement / historique / rappels / params / admin)
    ├── sync-bar/          # Indicateur d'état Firestore (🟢/🟠/🔴)
    ├── rotation/          # Liste ordonnée des membres
    ├── remplacement/      # Déclarer une absence + remplacement auto/manuel
    ├── historique/        # Historique des événements (6 mois glissants)
    ├── rappels/           # Activation/désactivation des notifications FCM
    ├── parametres/        # Réglages (dark mode, statut sync, décalage jour, PWA install)
    ├── admin/             # Gestion membres, règles, comptes (admin only — bordure orange dans l'UI)
    └── modaux/            # Modales génériques (ajout/édition/suppression/confirmation)

src/environments/
├── environment.ts            # Dev — valeurs Firebase vides (à remplir localement, non commité en vrai)
├── environment.local.ts       # ⚠️ non commité — config Firebase perso pour `npm start`
├── environment.e2e.ts         # Config fixe pour les émulateurs (projet demo-croissant, teamId equipe-test)
└── environment.prod.ts        # ⚠️ généré par CI (release.yml) à partir des secrets GitHub

.github/
├── workflows/
│   ├── release.yml           # Push sur main → bump version (bump-version.js) + build + deploy Hosting + tag + GitHub Release
│   ├── reminder-eve.yml      # Dimanche 18h Nouméa (UTC+11) → send-reminders.js (veille) + delete-users.js
│   ├── reminder-morning.yml  # Lundi 06h25 Nouméa → send-reminders.js (matin)
│   └── pr-check.yml          # Vérifie le build sur chaque PR
└── scripts/                  # Node.js, package.json séparé (npm install requis à part), utilisent firebase-admin
    ├── send-reminders.js       # Lit persons[rank=0], envoie FCM data-only, dédup par email, anti-doublon via remindersSent/
    ├── delete-users.js         # Supprime les comptes Firebase Auth marqués pendingDeletion
    ├── bump-version.js         # Semver depuis préfixes de commit (feat/fix/feat!) — voir docs/versioning.md
    └── backfill-order-base.js  # Script ponctuel de migration (orderBase)

e2e/
├── tests/                    # Specs Playwright : admin, rotation, remplacement, historique, no-double-rotation, auto-member-creation
├── helpers/                  # auth.ts (login émulateur), seed.ts (data Firestore), selectors.ts
├── fixtures/data.ts
└── global-setup.ts           # Setup avant la suite (reset émulateurs probable)

config/firebase-config.js     # Généré par CI pour le service worker (⚠️ non commité en vrai)
public/firebase-config.js     # Idem, template : firebase-config.example.js
public/firebase-messaging-sw.js  # Service worker FCM (affichage notif en arrière-plan)
firestore.rules               # Règles de sécurité Firestore (voir section dédiée ci-dessous)
```

## Architecture applicative

- **Un seul service central** : `CroissantService` (`src/app/croissant.service.ts`, ~620 lignes). Tout passe par lui — Firebase (Auth/Firestore/FCM), état global (`state: Signal<AppState>`), navigation par onglets (`activeTab`), gestion des modales. Les composants sont des vues quasi sans logique, elles `inject(CroissantService)` et lisent/appellent ses signals/méthodes.
- **Logique pure isolée** : tout calcul de date/rotation/remplacement vit dans `rotation-logic.ts`, sans import Firestore, pour rester testable en Vitest sans émulateur. Si vous ajoutez une règle métier sur la rotation, elle va probablement là, pas dans le service.
- **Pas de routing Angular réel** : `app.routes.ts` est vide. La navigation entre écrans est un `signal<Tab>` (`activeTab`) piloté par `NavigationComponent` + swipe tactile dans `app.ts`.
- **Temps réel via `onSnapshot`** : 5 listeners actifs en continu après login (`users/{uid}`, `teams/{teamId}`, `.../persons`, `.../history`, `.../notifications`), plus un listener admin-only sur `users` global. Toute mutation locale fait un `state.update()` optimiste puis écrit dans Firestore (pas d'attente de round-trip).
- **Rotation hebdomadaire automatique** : déclenchée côté client au premier snapshot confirmé serveur des `persons` (`checkAndRotate`), pas par une Cloud Function. Elle compare `lastRotationDate` stocké à la date du lundi (+ `sessionOffset`) le plus récent. Un bouton "forcer la rotation" existe en dev (`forceRotation`, visible dans `AdminComponent`).
- **`orderBase` vs `rank`** : `rank` = position d'affichage courante (bouge à chaque rotation/remplacement/drag). `orderBase` = référence stable d'origine, utilisée uniquement pour resynchroniser l'ordre après un cycle complet de rotation (cf. commentaire détaillé dans `rotateOnce`, rotation-logic.ts:72-104). Ne pas confondre les deux en cas de bug d'ordre.
- **Notifications FCM par appareil, pas par utilisateur** : un même email peut avoir plusieurs tokens (téléphone + PC). Dédup par email fait côté script d'envoi (garde le plus récent), pas côté stockage.
- **Rôle admin** = présence dans `users/{uid}.role === 'admin'` (pas une collection `admins` séparée malgré ce que dit docs/fonctionnement.md §2 — **vérifier le code fait foi**, la doc fonctionnelle peut être en retard sur ce point précis).

## Modèle de données Firestore (résumé — détail dans docs/fonctionnement.md §10)

```
teams/{teamId}                        # teamName, lastRotationDate, sessionOffset, rules{auto,catch,manual}
teams/{teamId}/persons/{id}           # name, initials, color, email, rank, orderBase, status(ok|absent|catch), replacedBy, absentDate, catchupDate, promoted
teams/{teamId}/history/{id}           # date, type, details, timestamp
teams/{teamId}/notifications/{id}
teams/{teamId}/tokens/{tokenPrefix}   # FCM tokens (lecture bloquée, écriture par le client authentifié)
users/{uid}                           # email, role(member|admin), notifPrefs{eve,morning,swap}, darkMode, appVersion, lastLogin
pendingDeletions/{encodedEmail}       # bloque l'accès + traité par delete-users.js le dimanche
```

`teamId` vient de `environment.teamId` (un seul environnement = une seule équipe dans cette instance de l'app).

## Sécurité (firestore.rules)

- Tout accès à `teams/**`, `history`, `notifications` : n'importe quel utilisateur **authentifié** (pas de vérif de rôle ni d'appartenance à l'équipe au niveau des règles — la séparation par équipe repose sur `teamId` côté client, pas sur les rules).
- `teams/{id}/tokens` : lecture interdite côté client (`allow read: if false`), seul l'Admin SDK (scripts GitHub Actions) peut lire les tokens FCM.
- `users/{uid}` : chacun peut lire son propre profil ou (si admin) n'importe lequel ; chacun peut écrire uniquement le sien.
- `pendingDeletions` : lecture ouverte à tout authentifié (permet à un compte de vérifier s'il est bloqué), écriture réservée admin.
- Pas de règles de validation de schéma — tout champ de document est accepté tel quel côté client.

## Commandes utiles

```bash
npm start                 # ng serve, config `local` (environment.local.ts), http://localhost:4200
npm run build              # ng build
npm test                   # alias de `ng test` (Vitest, watch)
npm run test:unit          # ng test --watch=false (CI)
npm run e2e                # tue les ports 8080/9099/4201, lance émulateurs + ng serve config e2e + playwright
npm run e2e:fast           # build préalable + serve statique (dist/) au lieu de ng serve — plus rapide en CI
npm run e2e:ui             # Playwright UI mode
npm run test:all            # unit + e2e
```

Scripts GitHub Actions (`.github/scripts/`) ont leur **propre** `package.json` —
`npm install` doit être relancé dans ce sous-dossier séparément (voir README §2).

## Conventions

- Commits : préfixes conventionnels (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `perf:`, `ci:`, `feat!:`/`BREAKING CHANGE:`) — déterminent le bump semver automatique en CI. Voir [docs/versioning.md](docs/versioning.md) avant de rédiger un message de commit qui touche au comportement de l'app.
- Version affichée dans l'app (`src/version.ts`, `APP_VERSION`) est régénérée par CI, ne pas éditer à la main.
- Commentaires dans le code : rares mais denses quand présents — expliquent le "pourquoi" d'une logique non triviale (ex. `rotateOnce`, `checkAndRotate`, `deletePerson`). Suivre ce style : pas de commentaire qui répète ce que fait le code.
- Composants standalone Angular : pas de NgModules dans ce projet, tout composant déclare ses `imports` directement.
- L'état ne doit jamais être dupliqué dans un composant — toujours lire/écrire via les signals de `CroissantService`.
- **`docs/fonctionnement.md` doit rester synchronisé avec le code.** Dès qu'une modification touche un comportement fonctionnel décrit dans ce fichier (rôles, rotation, absences/remplacement, notifications, historique, réglages, modèle de données Firestore), mettre à jour la section correspondante **dans le même changement**, sans attendre que l'utilisateur le demande.

## Pièges connus / points d'attention

- Le double comparatif `snap.metadata.fromCache` avant d'écrire un doc par défaut ou avant de déclencher `checkAndRotate` est **volontaire** (évite d'écraser `lastRotationDate` avec un snapshot cache vide, ou de faire tourner la rotation sur une liste partielle). Ne pas "simplifier" en enlevant ces gardes sans comprendre pourquoi (commentaires en place à `croissant.service.ts:231` et `:248`).
- `firebase-debug.log` et `firestore-debug.log` à la racine sont des artefacts locaux des émulateurs (gros fichiers, générés par `npm run e2e`) — ne pas les committer par erreur, vérifier `git status` avant un commit après une session e2e.
- `docs/fonctionnement.md` mentionne une collection `admins/{encodedEmail}` pour le rôle admin ; le code actuel (`croissant.service.ts`, `firestore.rules`) utilise en réalité `users/{uid}.role`. Faire confiance au code si divergence, et envisager de corriger la doc fonctionnelle si vous la retouchez.
