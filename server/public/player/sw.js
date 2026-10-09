// Service worker: offline lejátszás – a médiafájlok és a lejátszó gyorsítótárazása
const SHELL = 'signage-shell-v2';
const MEDIA = 'signage-media';
const SHELL_FILES = ['./', 'index.html', 'player.css', 'player.js', 'manifest.webmanifest', '/shared/themes.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('signage-shell') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Média: cache-first (a fájlnevek egyediek, sosem változnak). Range kéréseket a hálózat kapja,
  // ha az nem elérhető, a teljes fájlt adjuk vissza a gyorsítótárból.
  if (url.pathname.startsWith('/media/')) {
    e.respondWith(caches.open(MEDIA).then(async (c) => {
      const hit = await c.match(url.pathname);
      if (hit && !e.request.headers.get('range')) return hit;
      try {
        const res = await fetch(e.request);
        if (res.status === 200) c.put(url.pathname, res.clone());
        return res;
      } catch (err) {
        if (hit) return hit;
        throw err;
      }
    }));
    return;
  }
  // Lejátszó fájlok: network-first, offline esetén cache
  if (url.pathname.startsWith('/player/') || url.pathname.startsWith('/shared/')) {
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
