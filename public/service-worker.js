// 環保電子香 — Service Worker
// 策略：HTML 走 network-first（永遠拿最新、引用到最新樣式/程式）；
//       帶 hash 的 JS/CSS/圖示走 cache-first（檔名不同即更新）。
const CACHE = 'incense-v6';
// build 時由 vite 注入 self.__PRECACHE__（含全部帶 hash 的 JS/CSS）；無注入時退回基本清單
const PRECACHE = self.__PRECACHE__ || [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/icon.svg',
];

self.addEventListener('install', (e) => {
  // 逐一加入快取：單一檔失敗不致整個安裝失敗（離線更穩）
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isHTML(request, url) {
  return request.mode === 'navigate'
    || request.destination === 'document'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('.html');
}

// 點擊拜拜提醒通知 → 聚焦或開啟 App
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    }),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // HTML：network-first，離線才用快取 → 不會吃到舊樣式
  if (url.origin === location.origin && isHTML(request, url)) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }

  // 天氣 API：network-first
  if (url.hostname.includes('open-meteo')) {
    e.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // 其餘同源資源（帶 hash 的 JS/CSS、圖示）：cache-first
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })),
    );
  }
});
