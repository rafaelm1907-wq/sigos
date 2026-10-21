const SIGOS_PUSH_VERSION = 'sigos-push-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text?.() || '' }; }
  const data = payload.data || {};
  const title = payload.title || 'SIGOS';
  const options = {
    body: payload.body || 'Você recebeu uma nova notificação.',
    icon: payload.icon || '/assets/sigos-symbol.png',
    badge: payload.badge || '/assets/sigos-symbol.png',
    tag: data.notificationId ? `sigos-${data.notificationId}` : `${SIGOS_PUSH_VERSION}-${Date.now()}`,
    renotify: true,
    data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => 'focus' in client);
    if (existing) {
      await existing.focus();
      if ('navigate' in existing && new URL(targetUrl, self.location.origin).origin === self.location.origin) await existing.navigate(targetUrl);
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});
