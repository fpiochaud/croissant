// firebase-messaging-sw.js — Service Worker FCM (raw push handler)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const raw = event.data.json();

  // DEBUG — à supprimer après diagnostic
  event.waitUntil(
    self.registration.showNotification('DEBUG payload', {
      body: JSON.stringify(raw),
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'));
});
