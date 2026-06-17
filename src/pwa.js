// F10 — 註冊 Service Worker（並在新版啟用時自動刷新一次）
export function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}service-worker.js`;
    // updateViaCache:'none' → SW 檔本身一律重新驗證，避免吃到舊 SW
    navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' })
      .then((reg) => { reg.update(); })
      .catch((err) => console.warn('SW 註冊失敗：', err.message));

    // 已有舊 SW 控制時，新版接手 → 自動刷新一次拿最新樣式
    // （首次安裝沒有 controller，不刷新，避免無謂重整）
    if (navigator.serviceWorker.controller) {
      let refreshed = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshed) return;
        refreshed = true;
        window.location.reload();
      });
    }
  });
}
