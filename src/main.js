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

// 三牲供奉
const offeringsToggle = document.getElementById('offeringsToggle');
const applyOfferings = (on) => document.body.classList.toggle('offerings-on', on);
offeringsToggle.checked = getPref('offerings') === 'on';
applyOfferings(offeringsToggle.checked);
offeringsToggle.addEventListener('change', () => {
  applyOfferings(offeringsToggle.checked);
  setPref('offerings', offeringsToggle.checked ? 'on' : 'off');
});

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

// 啟動時只在「瀏覽器已記住授權」時靜默開啟鏡頭，絕不主動跳權限；
// 動態效果改由設定開關或擲筊搖晃時才請求 → 不再每次開啟 PWA 都被詢問
async function autoStartCamera() {
  if (getPref('camera') !== 'on' || !caps.hasCamera) return; // 只有使用者「明確開啟過」才還原
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const p = await navigator.permissions.query({ name: 'camera' });
      if (p.state === 'denied') { setPref('camera', 'off'); featCamera.checked = false; return; }
    }
  } catch { /* 不支援查詢（Safari）→ 直接還原（已授權則靜默） */ }
  enableCamera();   // 已授權 → 靜默開啟；尚未授權則因使用者選用過而再請求
}

// 「開始參拜」
startBtn.addEventListener('click', async () => {
  sound.unlock();
  sutra.unlock();
  store.set({ phase: 'ready' });
  document.body.classList.remove('phase-idle');

  if (caps.isMobile) autoStartCamera();

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
const featCameraNote = document.getElementById('featCameraNote');
featCamera.addEventListener('change', async () => {
  if (featCamera.checked) {
    const ok = await enableCamera();
    featCameraNote.textContent = ok ? '鏡頭已開啟。' : '無法開啟鏡頭：可能被拒絕，請至瀏覽器網站設定允許鏡頭後再試。';
  } else {
    stopCamera(); setPref('camera', 'off');
    featCameraNote.textContent = '鏡頭已關閉。';
  }
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

// 設定面板：像拉窗簾般滑入/拖曳
const settingsOverlay = document.getElementById('settingsOverlay');
function openPanel() { settingsPanel.classList.add('is-open'); settingsOverlay.classList.add('is-open'); }
function closePanel() { settingsPanel.classList.remove('is-open'); settingsOverlay.classList.remove('is-open'); }
settingsBtn.addEventListener('click', openPanel);
closeSettings.addEventListener('click', closePanel);
settingsOverlay.addEventListener('click', closePanel);

// 拉窗簾手勢：面板即時跟手，背幕隨之變暗；放手依拖動距離決定開合
const panelW = () => settingsPanel.offsetWidth || Math.min(window.innerWidth * 0.92, 360);
let g = null;
window.addEventListener('touchstart', (e) => {
  if (document.body.classList.contains('phase-idle')) return;
  if (!document.getElementById('jiaobeiResult').hidden) return;
  const t = e.touches[0];
  const w = panelW();
  const open = settingsPanel.classList.contains('is-open');
  if (open) {
    if (t.clientX > window.innerWidth - w + 44) return; // 只在面板左緣/背幕抓取，避開滑桿
  } else if (t.clientX < window.innerWidth - 28) {
    return;                                              // 關閉時只在畫面右緣抓取
  }
  g = { x0: t.clientX, y0: t.clientY, w, open, committed: false, base: open ? 0 : w };
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (!g) return;
  const t = e.touches[0];
  const dx = t.clientX - g.x0;
  const dy = t.clientY - g.y0;
  if (!g.committed) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dy) > Math.abs(dx)) { g = null; return; }   // 垂直 → 放給捲動
    g.committed = true;
    settingsPanel.classList.add('dragging', 'is-open');      // 拖曳期間可見、無過渡
    settingsOverlay.classList.add('dragging');
  }
  e.preventDefault();
  const off = Math.max(0, Math.min(g.w, g.base + dx));
  settingsPanel.style.transform = `translateX(${off}px)`;
  settingsOverlay.style.opacity = String((1 - off / g.w) * 0.5);
  settingsOverlay.style.pointerEvents = 'auto';
}, { passive: false });
window.addEventListener('touchend', (e) => {
  if (!g) return;
  const committed = g.committed; const w = g.w; const base = g.base; const x0 = g.x0;
  g = null;
  settingsPanel.classList.remove('dragging');
  settingsOverlay.classList.remove('dragging');
  settingsPanel.style.transform = '';
  settingsOverlay.style.opacity = '';
  settingsOverlay.style.pointerEvents = '';
  if (!committed) return;
  const off = Math.max(0, Math.min(w, base + (e.changedTouches[0].clientX - x0)));
  if (off < w * 0.5) openPanel(); else closePanel();
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
