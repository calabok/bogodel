/* БогоДел — service worker. Версия подставляется deploy.sh; любое изменение файла = обновление у игроков. */
const VERSION = '20261026-214759';
const CACHE = 'bogodel-' + VERSION;
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'art/city.webp', 'art/village.webp', 'art/forest.webp', 'art/swamp.webp', 'art/mount.webp', 'art/valley.webp', 'art/field.webp', 'art/castle.webp', 'art/coast.webp', 'art/waste.webp', 'art/ravine.webp', 'art/dungeon.webp', 'art/arena.webp', 'art/hero_idle.webp', 'art/hero_walk1.webp', 'art/hero_walk2.webp', 'art/hero_attack.webp', 'art/hero_block.webp', 'art/hero_hurt.webp', 'art/hero_dead.webp', 'art/foe_beast.webp', 'art/foe_bandit.webp', 'art/foe_undead.webp', 'art/kit_h_idle.webp', 'art/kit_h_walk1.webp', 'art/kit_h_walk2.webp', 'art/kit_h_attack.webp', 'art/kit_h_block.webp', 'art/kit_h_hurt.webp', 'art/kit_l_idle.webp', 'art/kit_c_idle.webp', 'art/world_grass.webp', 'art/world_forest.webp', 'art/world_dirt.webp', 'art/world_swamp.webp', 'art/world_coast.webp', 'art/world_mount.webp', 'art/world_waste.webp', 'art/world_city.webp', 'art/world_dungeon.webp'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))));
  // не вызываем skipWaiting сразу: игра сама предложит «Обновить» (или обновится, когда её свернут)
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('bogodel-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) { e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))); return; }
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname === new URL('./', self.registration.scope).pathname;
  if (isPage) {
    // сеть в приоритете: новые версии приходят сразу; без сети — из кэша
    e.respondWith(Promise.race([fetch(req, { cache: 'no-store' }), timeout(5000)]).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); }
      return res;
    }).catch(() => caches.open(CACHE).then(c => c.match('index.html').then(r => r || c.match('./')))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
