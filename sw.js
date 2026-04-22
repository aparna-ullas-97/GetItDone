const CACHE = "mission-control-v1";
const ASSETS = ["/", "/index.html"];

// ── Install: cache core assets
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fallback to network
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Push notifications
self.addEventListener("push", e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || "Mission Control", {
      body: data.body || "Time to log your progress!",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "mission",
      requireInteraction: false,
      data: { url: data.url || "/" },
    })
  );
});

// ── Notification click: open app
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow(e.notification.data.url || "/");
    })
  );
});

// ── Background sync: scheduled reminders via postMessage
self.addEventListener("message", e => {
  if (e.data && e.data.type === "SCHEDULE_REMINDERS") {
    // Reminders are scheduled client-side; SW handles delivery
    console.log("[SW] Reminders acknowledged");
  }
});
