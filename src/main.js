// 入口：權限引導、模組接線、NFC 路由
import { caps, applyBodyClasses } from './platform.js';
import { store } from './store.js';
import { sound } from './sound.js';
import { startCamera, stopCamera } from './camera.js';
import { enableTilt } from './smoke.js';
import { initStage, ignite, resetIncense } from './incense.js';
import { initTimer } from './timer.js';
import { initJiaobei } from './jiaobei.js';
import { initTablet } from './tablet.js';
import * as sutra from './sutra.js';
import { initReminder } from './reminder.js';
import { getNfcAction, scanNfc } from './nfc.js';
import { registerPwa } from './pwa.js';

// 功能偏好（記住選擇，避免每次都詢問權限）：'unset' | 'on' | 'off'
const getPref = (k) => localStorage.getItem('pref_' + k) || 'unset';
const setPref = (k, v) => localStorage.setItem('pref_' + k, v);

applyBodyClasses();
initStage();
initTimer();
initJiaobei();
initTablet();
initReminder();
registerPwa();

const startBtn = document.getElementById('startBtn');
const lightBtn = document.getElementById('lightBtn');
const muteBtn = document.getElementById('muteBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');
const featCamera = document.getElementById('featCamera');
const featMotion = document.getElementById('featMotion');

// 設定面板勾選狀態還原（顯示目前偏好）
featCamera.checked = getPref('camera') === 'on';
featMotion.checked = getPref('motion') === 'on';

// NFC 帶入 ?action=lighter → 等使用者手勢後自動點香
let pendingAutoIgnite = getNfcAction() === 'lighter';

async function enableCamera() {
  const ok = await startCamera();
  setPref('camera', ok ? 'on' : 'off');
  featCamera.checked = ok;
  return ok;
}
async function enableMotion() {
  store.set({ motionEnabled: true });
  const ok = await enableTilt();
  if (!ok) store.set({ motionEnabled: false });
  setPref('motion', ok ? 'on' : 'off');
  featMotion.checked = ok;
  return ok;
}

// 「開始參拜」：只在第一次（unset）或已選開啟（on）時請求；選擇被記住，不再每次詢問
startBtn.addEventListener('click', async () => {
  sound.unlock();
  sutra.unlock();
  store.set({ phase: 'ready' });
  document.body.classList.remove('phase-idle');

  if (caps.isMobile) {
    if (getPref('camera') !== 'off') enableCamera();
    if (getPref('motion') !== 'off') enableMotion();
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

// 設定面板：手動開關（開啟時才請求權限；關閉後永遠不問）
featCamera.addEventListener('change', async () => {
  if (featCamera.checked) { await enableCamera(); }
  else { stopCamera(); setPref('camera', 'off'); }
});
featMotion.addEventListener('change', async () => {
  if (featMotion.checked) { await enableMotion(); }
  else { store.set({ motionEnabled: false, tilt: { beta: 0, gamma: 0 }, fastMove: false }); setPref('motion', 'off'); }
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

// 側滑開關設定：自右緣往左滑開啟；在設定上往右滑關閉
let swStart = null;
window.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  swStart = { x: t.clientX, y: t.clientY };
}, { passive: true });
window.addEventListener('touchend', (e) => {
  if (!swStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swStart.x;
  const dy = t.clientY - swStart.y;
  const startX = swStart.x;
  swStart = null;
  if (document.body.classList.contains('phase-idle')) return;       // 尚未開始參拜
  if (!document.getElementById('jiaobeiResult').hidden) return;     // 擲筊頁面不攔截
  if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.8) return; // 需明顯水平滑動
  const open = !settingsPanel.hidden;
  if (!open && dx < 0 && startX > window.innerWidth * 0.7) settingsPanel.hidden = false; // 右緣左滑→開
  else if (open && dx > 0) settingsPanel.hidden = true;             // 右滑→關
}, { passive: true });

// 誦經 / 梵音
const sutraBtn = document.getElementById('sutraBtn');
const sutraToggle = document.getElementById('sutraToggle');
const sutraMode = document.getElementById('sutraMode');
const sutraUrl = document.getElementById('sutraUrl');
const sutraUrlField = document.getElementById('sutraUrlField');
const sutraMusic = document.getElementById('sutraMusic');
{
  const s = sutra.getState();
  sutraMode.value = s.mode;
  sutraUrl.value = s.url;
  sutraUrlField.hidden = s.mode !== 'custom';
  sutraMusic.checked = s.music;
}
sutraBtn.addEventListener('click', () => sutra.toggle());
sutraToggle.addEventListener('click', () => sutra.toggle());
sutraMode.addEventListener('change', () => { sutra.setMode(sutraMode.value); sutraUrlField.hidden = sutraMode.value !== 'custom'; });
sutraUrl.addEventListener('input', () => sutra.setUrl(sutraUrl.value));
sutraMusic.addEventListener('change', () => sutra.setMusic(sutraMusic.checked));
const sutraBtnLabel = document.getElementById('sutraBtnLabel');
const sutraToggleLabel = document.getElementById('sutraToggleLabel');
sutra.onSutra((isPlaying) => {
  sutraBtn.classList.toggle('is-on', isPlaying);
  sutraToggle.classList.toggle('is-on', isPlaying);
  sutraBtnLabel.textContent = isPlaying ? '誦經中' : '誦經';
  sutraToggleLabel.textContent = isPlaying ? '暫停誦經' : '播放誦經';
});

// 燃畢時把點香鈕變成「重新上香」
store.subscribe((s) => {
  if (s.phase === 'done') lightBtn.textContent = '重新上香';
  else if (s.phase === 'burning') lightBtn.textContent = '熄香';
  else lightBtn.textContent = '點香';
});
