// firebase-messaging-sw.js — Service Worker FCM
// Ce fichier doit rester à la racine du site (servi par Angular depuis public/)

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
// firebase-config.js définit self.FIREBASE_SW_CONFIG (gitignore — voir firebase-config.example.js)
importScripts('/firebase-config.js');

firebase.initializeApp(self.FIREBASE_SW_CONFIG);

const messaging = firebase.messaging();

// Déclenché quand l'app est fermée ou en arrière-plan
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? '🥐 Croissants du lundi';
  const body  = payload.notification?.body  ?? '';
  self.registration.showNotification(title, {
    body,
    icon:  '/favicon.ico',
    badge: '/favicon.ico',
    data:  { url: payload.fcmOptions?.link ?? '/' },
  });
});

// Ouvre l'app au clic sur la notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'));
});
