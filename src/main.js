// 入口：權限引導、模組接線、NFC 路由
import { caps, applyBodyClasses } from './platform.js';
import { store } from './store.js';
import { sound } from './sound.js';
import { startCamera } from './camera.js';
import { enableTilt } from './smoke.js';
import { initStage, ignite, resetIncense } from './incense.js';
import { initTimer } from './timer.js';
import { initJiaobei } from './jiaobei.js';
import { initTablet } from './tablet.js';
import { getNfcAction, scanNfc } from './nfc.js';
import { registerPwa } from './pwa.js';

applyBodyClasses();
initStage();
initTimer();
initJiaobei();
initTablet();
registerPwa();

const startBtn = document.getElementById('startBtn');
const lightBtn = document.getElementById('lightBtn');
const muteBtn = document.getElementById('muteBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');

// NFC 帶入 ?action=lighter → 等使用者手勢後自動點香
let pendingAutoIgnite = getNfcAction() === 'lighter';

// 「開始參拜」：在這個手勢中請求所有權限（iOS 限制）
startBtn.addEventListener('click', async () => {
  sound.unlock();
  store.set({ phase: 'ready' });
  document.body.classList.remove('phase-idle');

  // 並行請求（互不阻塞），失敗皆優雅降級
  if (caps.isMobile) {
    startCamera();
    enableTilt();
  }

  // Android Chrome：嘗試 App 內主動掃描 NFC
  if (caps.hasNfc) {
    scanNfc(() => ignite());
  }

  if (pendingAutoIgnite) {
    pendingAutoIgnite = false;
    setTimeout(() => ignite(), 600);
  }
});

lightBtn.addEventListener('click', () => {
  const s = store.get();
  if (s.phase === 'done' || s.lit) { resetIncense(); return; }
  sound.unlock();
  ignite();
});

muteBtn.addEventListener('click', () => {
  const muted = !store.get().muted;
  store.set({ muted });
  muteBtn.textContent = muted ? '靜音' : '聲音';
  muteBtn.classList.toggle('is-muted', muted);
});

settingsBtn.addEventListener('click', () => { settingsPanel.hidden = false; });
closeSettings.addEventListener('click', () => { settingsPanel.hidden = true; });

// 燃畢時把點香鈕變成「重新上香」
store.subscribe((s) => {
  if (s.phase === 'done') lightBtn.textContent = '重新上香';
  else if (s.phase === 'burning') lightBtn.textContent = '熄香';
  else lightBtn.textContent = '點香';
});
