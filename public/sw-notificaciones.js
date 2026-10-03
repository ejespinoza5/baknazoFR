/*
 * Service worker de las notificaciones push de Baknazo.
 *
 * El backend manda por FCM mensajes solo de datos ({ titulo, texto, url,
 * etiqueta, silencio }) y aquí se convierten en notificación. No carga el SDK
 * de Firebase: no le hace falta para recibir, y así decide él el sonido, la
 * etiqueta que agrupa y a dónde lleva al pulsar.
 *
 * Los textos son genéricos a propósito ("Tienes mensajes nuevos"): la pantalla
 * de bloqueo la ve cualquiera. El detalle está dentro de la app.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

/** Solo rutas internas: un push nunca puede llevar a otro sitio. */
function rutaSegura(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/notificaciones';
}

self.addEventListener('push', (evento) => {
  evento.waitUntil(
    (async () => {
      let carga = {};
      try {
        carga = evento.data ? evento.data.json() : {};
      } catch {
        carga = {};
      }
      // FCM entrega { data: {...}, from, … }; se acepta también el objeto suelto.
      const d = carga.data || carga.notification || carga;

      // Con Baknazo a la vista, el aviso ya salió dentro de la app.
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (ventanas.some((v) => v.visibilityState === 'visible')) return;

      await self.registration.showNotification(d.titulo || 'Baknazo', {
        body: d.texto || d.body || 'Tienes una notificación nueva',
        // El logo de Baknazo; el badge es la silueta que Android pinta en la barra.
        icon: '/favicon-192.png',
        badge: '/badge-96.png',
        // Misma etiqueta = reemplaza al aviso anterior del grupo (likes, mensajes).
        tag: d.etiqueta || undefined,
        renotify: Boolean(d.etiqueta),
        silent: d.silencio === '1',
        data: { url: rutaSegura(d.url) },
      });
    })()
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const ruta = rutaSegura(evento.notification.data && evento.notification.data.url);
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
      if (abierta) {
        // La app navega por dentro, sin recargar.
        abierta.postMessage({ tipo: 'bkn-abrir', ruta });
        return abierta.focus();
      }
      return self.clients.openWindow(ruta);
    })()
  );
});
