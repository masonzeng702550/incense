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
  music: localStorage.getItem('sutra_music') !== '0', // 念經時是否疊佛樂背景
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
// 木魚「篤」：木質撞擊雜訊（帶通）＋ 中空共鳴體（音高下滑、快速衰減）
let _noiseBuf;
function noiseBuffer() {
  if (_noiseBuf) return _noiseBuf;
  const len = Math.ceil(ctx.sampleRate * 0.2);
  _noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = _noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  return _noiseBuf;
}
function muyu(t) {
  // 撞擊聲（木頭敲擊的「咑」）
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer();
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 5;
  const ng = ctx.createGain(); ng.gain.value = 0.55;
  n.connect(bp).connect(ng).connect(master);
  // 中空木魚共鳴體
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(135, t + 0.05);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.75, t + 0.004);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
  o.connect(og).connect(master);
  // 第二諧波讓木質更實
  const o2 = ctx.createOscillator(); o2.type = 'sine';
  o2.frequency.setValueAtTime(620, t); o2.frequency.exponentialRampToValueAtTime(300, t + 0.04);
  const og2 = ctx.createGain();
  og2.gain.setValueAtTime(0.0001, t);
  og2.gain.exponentialRampToValueAtTime(0.25, t + 0.003);
  og2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o2.connect(og2).connect(master);

  n.start(t); n.stop(t + 0.2);
  o.start(t); o.stop(t + 0.18);
  o2.start(t); o2.stop(t + 0.1);
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

// 佛樂背景（疊在念誦下）：低沉梵音 drone + 緩慢引磬
let bedActive = false;
let bedNodes = [];
let bedTimer = null;
let bedGain = null;
function bedBell(t) {
  for (const [m, a] of [[1, 0.5], [2.7, 0.24], [5.2, 0.1]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880 * m;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(a, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    o.connect(g).connect(bedGain); o.start(t); o.stop(t + 4.3);
  }
}
function startMusicBed() {
  if (bedActive) return;
  ensure();
  bedActive = true;
  bedGain = ctx.createGain(); bedGain.gain.value = 0.45; bedGain.connect(master);
  const dg = ctx.createGain(); dg.gain.value = 0;
  dg.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2.5);
  dg.connect(bedGain);
  for (const f of [98, 98.4, 147]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    o.connect(dg); o.start(); bedNodes.push(o);
  }
  bedNodes.push(dg);
  const tick = () => { if (!bedActive) return; bedBell(ctx.currentTime + 0.02); bedTimer = setTimeout(tick, 6500); };
  bedTimer = setTimeout(tick, 1500);
}
function stopMusicBed() {
  if (!bedActive) return;
  bedActive = false;
  clearTimeout(bedTimer); bedTimer = null;
  const nodes = bedNodes; bedNodes = []; const bg = bedGain; bedGain = null;
  if (bg && ctx) bg.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  setTimeout(() => { nodes.forEach((n) => { try { n.stop ? n.stop() : n.disconnect(); } catch { /* */ } }); if (bg) bg.disconnect(); }, 800);
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

export async function play() {
  if (playing) return;
  playing = true;
  notify();
  if (state.mode === 'custom') {
    startPlaylist(state.url ? [state.url] : null, null);
  } else if (SUTRAS[state.mode]) {
    const s = SUTRAS[state.mode];
    // 優先播放念誦錄音；載入失敗（離線等）退回語音朗讀
    startPlaylist(s.audio, () => { if (playing) startTTS(s.lines); });
    if (state.music) { await unlock(); if (playing) startMusicBed(); }  // 疊佛樂背景
  } else {
    startSynth();
  }
}
export function pause() {
  if (!playing) return;
  playing = false;
  stopSynth(); stopPlaylist(); stopTTS(); stopMusicBed();
  notify();
}
export function setMusic(on) {
  state.music = on;
  localStorage.setItem('sutra_music', on ? '1' : '0');
  if (playing && SUTRAS[state.mode]) {
    if (on) unlock().then(() => { if (playing) startMusicBed(); });
    else stopMusicBed();
  }
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
