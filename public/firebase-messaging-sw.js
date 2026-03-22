// firebase-messaging-sw.js — Service Worker FCM (raw push handler)

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const title = payload.data?.msgTitle ?? payload.notification?.title ?? '🥐 Croissants du lundi';
  const body  = payload.data?.msgBody  ?? payload.notification?.body  ?? '';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/favicon.ico',
      badge: '/favicon.ico',
      data:  { url: payload.fcmOptions?.link ?? payload.webpush?.fcmOptions?.link ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'));
});
