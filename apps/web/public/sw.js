// Ballpark's service worker. It only shows the streak reminder: the push has no message body, so the words are here.
self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Your streak ends at midnight", {
      body: "Today’s climb is waiting. Seven questions, about two minutes.",
      tag: "ballpark-streak",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) if ("focus" in client) return client.focus();
      return self.clients.openWindow("/");
    }),
  );
});
