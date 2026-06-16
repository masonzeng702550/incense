// 用 WebAudio 合成簡單音效，避免額外音檔依賴（可日後換成 assets/sound/*）
import { store } from './store.js';

let ctx;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function blip(freq, dur, type = 'sine', gain = 0.15) {
  if (store.get().muted) return;
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g).connect(c.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.stop(c.currentTime + dur);
  } catch { /* ignore */ }
}

export const sound = {
  // 需在使用者手勢中先呼叫一次以解鎖 iOS
  unlock() { try { ac().resume(); } catch { /* */ } },
  lighter() { blip(90, 0.25, 'sawtooth', 0.12); setTimeout(() => blip(180, 0.4, 'triangle', 0.1), 120); },
  jiaobei() { blip(400, 0.08, 'square', 0.1); setTimeout(() => blip(260, 0.12, 'square', 0.1), 90); },
};
