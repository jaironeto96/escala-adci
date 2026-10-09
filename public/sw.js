// Service worker do ADCI Escalas.
//
// Faz uma coisa so: receber notificacoes e abrir o app quando a pessoa toca nelas.
// Nao tem handler de "fetch" de proposito — sem ele o navegador nunca serve o app a
// partir de cache, e toda atualizacao publicada aparece na hora.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { corpo: evento.data ? evento.data.text() : "" };
  }

  evento.waitUntil(
    self.registration.showNotification(dados.titulo || "ADCI Escalas", {
      body: dados.corpo || "",
      icon: "/icon-192.png",
      // Icone pequeno da barra de status do Android: tem que ser branco em fundo
      // transparente, senao vira um quadrado.
      badge: "/badge-96.png",
      // Mesmo aviso repetido no mesmo dia substitui o anterior em vez de empilhar.
      tag: dados.tag || "aviso-escala",
      data: { url: dados.url || "/escala?minha=true" },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = new URL(evento.notification.data?.url || "/", self.location.origin).href;

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
      // Se o app ja esta aberto, reaproveita a janela em vez de abrir outra.
      for (const janela of abertas) {
        if (janela.url.startsWith(self.location.origin) && "focus" in janela) {
          return janela.navigate(url).then((j) => (j || janela).focus());
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
