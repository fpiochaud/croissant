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

  self.registration.showNotification(title ?? '🥐 Croissants', {
    body:    body ?? 'Un changement a eu lieu dans le planning.',
    icon:    icon ?? '/icon-192.png',
    badge:   '/icon-72.png',
    tag:     'croissants-update',       // remplace la notif précédente si déjà présente
    renotify: true,
    data:    payload.data ?? {},
    actions: [
      { action: 'open', title: 'Voir le planning' }
    ]
  });
});

// ── CLIC SUR LA NOTIFICATION ───────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const url    = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si l'app est déjà ouverte, focus dessus
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon ouvrir une nouvelle fenêtre
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
