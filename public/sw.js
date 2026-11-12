// Service worker do Outflow: só cuida das notificações push (não faz cache nem funciona offline).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { titulo: event.data ? event.data.text() : "Outflow" };
  }
  event.waitUntil(
    self.registration.showNotification(dados.titulo || "Outflow", {
      body: dados.corpo || "",
      icon: "/icones/icone-192.png",
      // ícone pequeno da barra de status: o Android usa só o formato (transparência), por isso é a silhueta branca
      badge: "/icones/badge-96.png",
      lang: "pt-BR",
      data: { url: dados.url || "/" },
    }),
  );
});

// Tocar na notificação: volta para o Outflow se já estiver aberto, senão abre
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
      if (aberta) return aberta.focus(); // o painel aberto já se atualiza sozinho (AoVivo)
      return self.clients.openWindow(url);
    }),
  );
});
