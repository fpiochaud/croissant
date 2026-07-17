# Documentation — Croissants du lundi

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Authentification et rôles](#2-authentification-et-rôles)
3. [Rotation](#3-rotation)
4. [Absences et remplacements](#4-absences-et-remplacements)
5. [Notifications push](#5-notifications-push)
6. [Historique](#6-historique)
7. [Réglages](#7-réglages)
8. [Rôle administrateur — détail complet](#8-rôle-administrateur--détail-complet)
9. [Synchronisation temps réel](#9-synchronisation-temps-réel)
10. [Modèle de données Firestore](#10-modèle-de-données-firestore)

---

## 1. Vue d'ensemble

L'application gère le planning hebdomadaire des croissants dans une équipe. Chaque semaine, un membre apporte les croissants selon un ordre de rotation défini. L'app affiche qui est le prochain, quand c'est son tour, et permet de déclarer des absences avec remplacement automatique ou manuel.

L'état est partagé en temps réel entre tous les membres via Firestore. Chaque membre s'authentifie avec son adresse e-mail et reçoit des notifications push le dimanche soir et le lundi matin pour être rappelé.

---

## 2. Authentification et rôles

### Connexion

L'app utilise Firebase Authentication (email + mot de passe). À l'ouverture, l'app affiche un écran de chargement animé pendant la vérification de la session, puis redirige vers :

- L'écran de **connexion** si l'utilisateur n'est pas authentifié
- L'**application** si la session est valide

### Rôles

Il existe deux rôles :

| Rôle | Description |
|---|---|
| **Membre** | Peut voir la rotation, déclarer sa propre absence, gérer ses notifications, modifier sa propre fiche |
| **Administrateur** | Accès complet : gestion de tous les membres, suppression, décalage de session, règles de remplacement |

Le rôle est déterminé par la présence de l'e-mail de l'utilisateur dans la collection `admins` de Firestore. Un utilisateur dont le compte est en cours de suppression (`pendingDeletion = true`) voit son accès bloqué avec un message explicatif.

---

## 3. Rotation

### Principe

La liste des membres est ordonnée par rang (`rank`). Le membre en **position 0** est le prochain à apporter les croissants. Après son tour, il passe en fin de liste — c'est la **rotation**.

### Calcul du prochain lundi

La fonction `getNextCroissantDay(offset)` calcule la date du prochain jour de croissants :

- Par défaut : prochain **lundi** (ou aujourd'hui si aujourd'hui est lundi)
- Avec un offset : prochain lundi **+ offset jours** (ex. offset=1 → mardi)

### Déclenchement de la rotation

Au chargement de l'app, `checkAndRotate()` est appelé automatiquement. Il compare la date de la dernière rotation (`lastRotationDate` dans Firestore) avec la date du lundi le plus récent passé. Si aucune rotation n'a eu lieu depuis ce lundi, la rotation s'effectue.

La rotation consiste à :
1. Déplacer le membre en position 0 à la fin de la liste (mise à jour des `rank` de tous les membres)
2. Traiter l'historique de chaque membre absent (`status === 'absent'` → passe en `status === 'catch'`)
3. Mettre à jour `lastRotationDate` dans Firestore
4. Remettre `sessionOffset` à 0
5. Purger l'historique au-delà de 6 mois

### Affichage des dates dans la liste

Chaque membre de la liste affiche sa date de passage prévue. Le calcul tient compte de :

- **L'offset de session** : s'applique uniquement au premier membre (la session de la semaine courante peut être décalée au mardi ou mercredi)
- **Les absences** : le membre qui suit un absent affiche la date de l'absent (car il le remplace ce jour-là), et non sa propre date habituelle

### Passer en premier

Un membre peut se déplacer en tête de liste (bouton ⬆️ sur sa propre fiche). Cette action est bloquée le jour même des croissants. Une popup de confirmation s'affiche avant l'action.

---

## 4. Absences et remplacements

### Déclarer une absence

L'onglet **Remplacer** permet de déclarer qu'un membre sera absent. La sélection du membre déclenche un aperçu du remplacement proposé.

### Remplacement automatique

Si la règle **Remplacement automatique** est activée (admin), le suivant dans la liste (en ignorant les membres déjà absents) est automatiquement proposé comme remplaçant.

Le flux affiché : `Absent → Remplaçant`

### Remplacement manuel

En cliquant **Choisir manuellement**, un menu déroulant permet de sélectionner n'importe quel membre disponible comme remplaçant.

### Rattrapage

Si la règle **Rattrapage automatique** est activée (admin), le membre absent doit rattraper son tour la semaine suivante (sa date de rattrapage = date d'absence + 7 jours). Cette information est stockée dans `catchupDate` et affichée dans la liste.

Lors de la rotation suivante, le statut `absent` passe à `catch` et le membre apparaît avec la mention `🗓 Rattrapage le [date]`.

### Champs stockés pour une absence

| Champ | Valeur |
|---|---|
| `status` | `'absent'` |
| `absentDate` | Date formatée du jour d'absence |
| `replacedBy` | Nom du remplaçant |
| `catchupDate` | Date du rattrapage (absent + 7 jours) si règle activée |

---

## 5. Notifications push

### Activation par l'utilisateur

Chaque membre active les notifications depuis l'onglet **Rappels**. L'app demande la permission du navigateur, puis enregistre le token FCM dans la collection `subscriptions` de Firestore avec l'e-mail de l'utilisateur et ses préférences (veille / matin).

Les notifications sont **par appareil** : un membre qui utilise l'app sur téléphone et ordinateur aura deux tokens distincts.

### Envoi automatique (GitHub Actions)

Deux workflows GitHub Actions envoient les notifications chaque semaine :

| Workflow | Horaire (Noumea UTC+11) | Type |
|---|---|---|
| `reminder-eve` | Dimanche 18h00 | Rappel la veille |
| `reminder-morning` | Lundi 06h25 | Rappel le matin |

Le script `send-reminders.js` :
1. Récupère le membre en position 0 (prochain à apporter)
2. Lit tous les tokens FCM dans `subscriptions`, filtrés selon les préférences de chaque utilisateur
3. Déduplique par e-mail (conserve le token le plus récent)
4. Envoie un message FCM data-only (sans payload `notification`) — le Service Worker intercepte l'événement `push` et affiche la notification
5. Nettoie les tokens invalides (appareils désenregistrés)
6. Écrit un document dans `remindersSent/{type}-{date}` pour éviter les doublons en cas de déclenchement multiple

### Désactivation

Un membre peut désactiver les notifications depuis l'onglet **Rappels**. Son token est supprimé de Firestore.

---

## 6. Historique

L'onglet **Historique** affiche la liste des événements passés dans l'ordre chronologique inverse. Chaque événement contient :

- La **date**
- Le **type** d'action (rotation, absence, remplacement, promotion…)
- Les **détails** (noms des personnes concernées)

L'historique est automatiquement purgé lors de chaque rotation : seuls les 6 derniers mois sont conservés.

---

## 7. Réglages

L'onglet **Réglages** affiche :

- **Statut Firestore** : connecté / synchronisation / hors ligne
- **Token FCM** : indique si les notifications sont enregistrées sur cet appareil
- **Jour des croissants** *(admin uniquement)* : permet de décaler la session de la semaine
- **Installer l'application** : instructions PWA pour Android (Chrome) et iOS (Safari)

---

## 8. Rôle administrateur — détail complet

Les fonctionnalités suivantes sont **exclusivement réservées aux administrateurs**. Elles sont visuellement identifiées par une **bordure orange** sur les éléments concernés.

### Gestion des membres

| Action | Détail |
|---|---|
| **Ajouter un membre** | Bouton "+" dans l'onglet Rotation. Saisie du nom, des initiales, de l'e-mail (optionnel) et choix d'une couleur parmi 16 |
| **Modifier n'importe quel membre** | Le bouton ✏️ avec bordure orange permet d'éditer la fiche de n'importe quel membre (pas seulement la sienne) |
| **Supprimer un membre** | Bouton 🗑️ disponible sur chaque fiche. Une popup de confirmation s'affiche avant la suppression définitive. L'action est irréversible |

> Un membre non-admin peut uniquement modifier **sa propre fiche** (bouton ✏️ sans bordure orange).

### Statut d'un membre (édition)

Depuis la modal d'édition, seul un admin (ou le membre lui-même) peut modifier le **statut** :

- **Disponible** (`ok`) : passage normal dans la rotation
- **Absent** (`absent`) : le membre est absent, affiché avec ⛔ dans la liste

### Règles de remplacement *(onglet Remplacer)*

Section visible uniquement par les admins (bordure orange) :

| Règle | Description |
|---|---|
| **Remplacement automatique** | Propose automatiquement le suivant dans la liste comme remplaçant lors d'une absence |
| **Rattrapage automatique** | L'absent doit rattraper son tour la semaine suivante (`catchupDate = absentDate + 7 jours`) |

### Décalage de session *(onglet Réglages)*

Permet de décaler le jour des croissants de la semaine en cours (section avec bordure orange) :

| Valeur | Jour |
|---|---|
| `+0` | Lundi (par défaut) |
| `+1` | Mardi |
| `+2` | Mercredi |

Ce décalage s'affiche dans le header sous forme d'un avertissement orange : `⚠️ Férié ou chômé — décalé le [date]`. Il est automatiquement remis à 0 après la rotation.

### Suppression de comptes utilisateurs

Lorsqu'un membre quitte l'équipe, son compte Firebase Auth peut être marqué pour suppression (`pendingDeletion`). Le workflow `reminder-eve` exécute chaque dimanche le script `delete-users.js` qui supprime effectivement ces comptes.

---

## 9. Synchronisation temps réel

L'application utilise des **listeners Firestore** (`onSnapshot`) pour maintenir l'état synchronisé en temps réel entre tous les appareils connectés. La barre de synchronisation en haut de l'app indique l'état :

| Indicateur | Signification |
|---|---|
| 🟢 Vert | Connecté et à jour |
| 🟠 Orange (clignotant) | Synchronisation en cours |
| 🔴 Rouge | Hors ligne |

---

## 10. Modèle de données Firestore

### Collection `teams/{teamId}`

Document principal de l'équipe.

| Champ | Type | Description |
|---|---|---|
| `teamName` | string | Nom de l'équipe |
| `lastRotationDate` | string | Date ISO de la dernière rotation |
| `sessionOffset` | number | Décalage du jour (0, 1 ou 2) |
| `rules.auto` | boolean | Remplacement automatique activé |
| `rules.catch` | boolean | Rattrapage automatique activé |

### Sous-collection `teams/{teamId}/persons/{personId}`

Un document par membre.

| Champ | Type | Description |
|---|---|---|
| `name` | string | Nom complet |
| `initials` | string | Initiales (2 caractères) |
| `color` | string | Classe CSS de couleur (`c1`…`c16`) |
| `email` | string | E-mail (lié au compte Firebase Auth) |
| `rank` | number | Position dans la rotation (0 = prochain) |
| `status` | string | `ok` / `absent` / `catch` |
| `absentDate` | string | Date d'absence formatée |
| `replacedBy` | string | Nom du remplaçant |
| `catchupDate` | string | Date du rattrapage |

### Sous-collection `teams/{teamId}/history/{eventId}`

Un document par événement.

| Champ | Type | Description |
|---|---|---|
| `date` | string | Date ISO de l'événement |
| `type` | string | Type d'action |
| `details` | object | Données de l'événement |

### Collection `subscriptions/{tokenId}`

Un document par token FCM enregistré.

| Champ | Type | Description |
|---|---|---|
| `token` | string | Token FCM de l'appareil |
| `email` | string | E-mail de l'utilisateur |
| `teamId` | string | ID de l'équipe |
| `eve` | boolean | Préférence rappel veille |
| `morning` | boolean | Préférence rappel matin |
| `updatedAt` | timestamp | Date d'enregistrement |

### Collection `admins/{encodedEmail}`

Un document par administrateur. L'e-mail est encodé (`.` remplacé par `,`).

### Collection `remindersSent/{type}-{date}`

Anti-doublon pour les rappels. Un document est créé après chaque envoi pour éviter de renvoyer le même rappel deux fois dans la journée.
