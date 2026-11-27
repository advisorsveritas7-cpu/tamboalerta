// Service worker de TamboAlerta: abre sin señal y ahorra datos.
const VERSION = 'ta-v1';
const NUCLEO = ['./', './manifest.webmanifest', './data/tambogrande.json', './icons/icon.svg', './icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(NUCLEO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== 'ta-tiles').map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Teselas del mapa base: caché primero (máx. ~600), para ahorrar datos.
  if (url.hostname.endsWith('basemaps.cartocdn.com')) {
    e.respondWith(
      caches.open('ta-tiles').then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          c.put(req, res.clone());
          c.keys().then((ks) => ks.length > 600 && c.delete(ks[0]));
        }
        return res;
      }),
    );
    return;
  }

  // APIs (Open-Meteo, Supabase): siempre red; la app guarda su propio respaldo.
  if (url.origin !== self.location.origin) return;

  // Navegación: red primero, caché si no hay señal.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(VERSION).then((c) => c.put('./', res.clone()));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  // Estáticos propios (_next, data, icons): caché y actualización en segundo plano.
  e.respondWith(
    caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      const red = fetch(req)
        .then((res) => {
          if (res.ok) c.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || red;
    }),
  );
});
