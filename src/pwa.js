// F10 — 註冊 Service Worker
export function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    // 相對於 base 的 SW 路徑；Vite 會把 public/ 內的檔放到根
    const swUrl = `${import.meta.env.BASE_URL}service-worker.js`;
    navigator.serviceWorker.register(swUrl).catch((err) =>
      console.warn('SW 註冊失敗：', err.message));
  });
}
