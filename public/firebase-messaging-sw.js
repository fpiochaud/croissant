// firebase-messaging-sw.js — Service Worker FCM (raw push handler)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const title = payload.data?.msgTitle ?? '🥐 Croissants du lundi';
  const body  = payload.data?.msgBody  ?? '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/favicon.ico',
      badge: '/favicon.ico',
      data:  { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'));
});
