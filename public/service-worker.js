// 環保電子香 — Service Worker（離線快取）
// 注意：Vite build 後 JS/CSS 會帶 hash，採「執行時快取」策略涵蓋，
// 預快取只放確定存在的入口與圖示。
const CACHE = 'incense-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 天氣 API：network-first，失敗退回快取
  if (url.hostname.includes('open-meteo')) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // 同源靜態資源：cache-first，並把新資源寫入快取（stale-while-revalidate 風格）
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || fetched;
      }),
    );
  }
});
