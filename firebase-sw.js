// ============================================================
// firebase-sw.js — Service Worker FCM
// À placer à la RACINE de votre hébergement (même niveau que croissants.html)
// Remplacer les valeurs YOUR_* par vos clés Firebase
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ── CONFIGURATION FIREBASE ──────────────────────────────────
// Copier depuis : Console Firebase > Paramètres projet > Vos applis
firebase.initializeApp({

// Charger la config dynamiquement
self.addEventListener('install', event => {
  event.waitUntil(
    fetch('config/firebase-config.json')
      .then(r => r.json())
      .then(cfg => {
        firebase.initializeApp({
          apiKey: cfg.apiKey,
          authDomain: cfg.authDomain,
          projectId: cfg.projectId,
          storageBucket: cfg.storageBucket,
          messagingSenderId: cfg.messagingSenderId,
          appId: cfg.appId
        });
      })
      .catch(() => {
        // Fallback: ne rien faire
      })
  );
});

const messaging = firebase.messaging();

// ── GESTION DES MESSAGES EN ARRIÈRE-PLAN ───────────────────
// Déclenché quand l'app est fermée ou en arrière-plan
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification ?? {};
  // ...existing code...
});
