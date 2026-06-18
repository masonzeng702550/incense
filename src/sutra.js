// 誦經 / 梵音：WebAudio 合成木魚・鐘磬・梵音 + 四部佛經語音朗讀（TTS），亦支援自訂 mp3 網址
import { SUTRAS } from './sutra-texts.js';

let ctx, master;
let playing = false;
let timer = null;
let droneG = null;
let droneOsc = [];
let audioEl = null;

// 音量交給裝置系統音量控制（一律全幅輸出）
const state = {
  mode: localStorage.getItem('sutra_mode') || 'muyu',
  url: localStorage.getItem('sutra_url') || '',
};

const listeners = new Set();
function notify() { listeners.forEach((fn) => fn(playing, state)); }
export function onSutra(fn) { listeners.add(fn); fn(playing, state); }

function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);
}

// 在使用者手勢中解鎖音訊（iOS / 自動播放政策）
export async function unlock() {
  ensure();
  if (ctx.state !== 'running') { try { await ctx.resume(); } catch { /* */ } }
  try {
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  } catch { /* */ }
}


// 木魚「篤」
function muyu(t) {
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(420, t);
  o.frequency.exponentialRampToValueAtTime(170, t + 0.06);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.8, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + 0.15);
}

// 鐘磬 / 缽
function bell(t) {
  const f0 = 523.25;
  for (const [m, a] of [[1, 0.5], [2.01, 0.28], [2.83, 0.18], [5.4, 0.09]]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f0 * m;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(a, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 3.5);
  }
}

function startDrone() {
  droneG = ctx.createGain();
  droneG.gain.value = 0;
  droneG.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 1.5);
  droneG.connect(master);
  for (const f of [110, 110.5, 165]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.connect(droneG); o.start();
    droneOsc.push(o);
  }
}
function stopDrone() {
  if (droneG) droneG.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  const osc = droneOsc; droneOsc = []; const g = droneG; droneG = null;
  setTimeout(() => { osc.forEach((o) => { try { o.stop(); } catch { /* */ } }); if (g) g.disconnect(); }, 800);
}

function schedule() {
  if (!playing) return;
  const now = ctx.currentTime + 0.02;
  if (state.mode === 'muyu') { muyu(now); timer = setTimeout(schedule, 850); }
  else if (state.mode === 'bell') { bell(now); timer = setTimeout(schedule, 7000); }
  else if (state.mode === 'fanyin') { bell(now); timer = setTimeout(schedule, 12000); }
}

async function startSynth() {
  await unlock();
  if (!playing) return;
  if (state.mode === 'fanyin') startDrone();
  schedule();
}
function stopSynth() {
  clearTimeout(timer); timer = null;
  stopDrone();
}

// 播放清單（單檔循環；多段則依序播放後循環）。載入失敗呼叫 onError。
let playlist = [];
let plIndex = 0;
let onPlError = null;
function startPlaylist(urls, onError) {
  if (!urls || !urls.length) { if (onError) onError(); return; }
  if (!audioEl) audioEl = new Audio();
  playlist = urls; plIndex = 0; onPlError = onError;
  audioEl.onended = () => {
    plIndex = (plIndex + 1) % playlist.length;
    playOne();
  };
  audioEl.onerror = () => { if (onPlError) onPlError(); };
  playOne();
}
function playOne() {
  audioEl.loop = playlist.length === 1;       // 單檔無縫循環
  audioEl.src = playlist[plIndex];
  audioEl.play().catch(() => { if (onPlError) onPlError(); });
}
function stopPlaylist() {
  if (audioEl) { audioEl.onended = null; audioEl.onerror = null; audioEl.pause(); }
}

// 佛經語音朗讀（TTS）
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices();
  return vs.find((v) => /^zh[-_]?TW/i.test(v.lang))
    || vs.find((v) => /^zh[-_]?(HK|Hant)/i.test(v.lang))
    || vs.find((v) => /^zh/i.test(v.lang)) || null;
}
function startTTS(lines) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  let i = 0;
  const voice = pickVoice();
  const next = () => {
    if (!playing) return;
    if (i >= lines.length) i = 0;             // 循環朗讀
    const u = new SpeechSynthesisUtterance(lines[i]);
    if (voice) u.voice = voice;
    u.lang = (voice && voice.lang) || 'zh-TW';
    u.rate = 0.82; u.pitch = 1; u.volume = 1;
    u.onend = () => { i++; if (playing) next(); };
    u.onerror = () => { i++; if (playing) setTimeout(next, 300); };
    speechSynthesis.speak(u);
  };
  // 語音清單可能尚未載入
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.onvoiceschanged = () => { if (playing) next(); };
    setTimeout(() => { if (playing) next(); }, 300);
  } else {
    next();
  }
}
function stopTTS() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

export function play() {
  if (playing) return;
  playing = true;
  notify();
  if (state.mode === 'custom') {
    startPlaylist(state.url ? [state.url] : null, null);
  } else if (SUTRAS[state.mode]) {
    const s = SUTRAS[state.mode];
    // 優先播放念誦錄音；載入失敗（離線等）退回語音朗讀
    startPlaylist(s.audio, () => { if (playing) startTTS(s.lines); });
  } else {
    startSynth();
  }
}
export function pause() {
  if (!playing) return;
  playing = false;
  stopSynth(); stopPlaylist(); stopTTS();
  notify();
}
export function toggle() { playing ? pause() : play(); }

export function setMode(m) {
  const was = playing;
  if (was) pause();
  state.mode = m;
  localStorage.setItem('sutra_mode', m);
  notify();
  if (was) play();
}
export function setUrl(u) { state.url = u; localStorage.setItem('sutra_url', u); }
export function getState() { return state; }
