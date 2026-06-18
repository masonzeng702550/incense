// 誦經 / 梵音：WebAudio 合成木魚・鐘磬・梵音（免音檔、可離線），亦支援自訂 mp3 網址
let ctx, master;
let playing = false;
let timer = null;
let droneG = null;
let droneOsc = [];
let audioEl = null;

const state = {
  mode: localStorage.getItem('sutra_mode') || 'muyu',
  volume: Number(localStorage.getItem('sutra_vol') ?? 50) / 100,
  url: localStorage.getItem('sutra_url') || '',
};

const listeners = new Set();
function notify() { listeners.forEach((fn) => fn(playing, state)); }
export function onSutra(fn) { listeners.add(fn); fn(playing, state); }

function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = state.volume;
  master.connect(ctx.destination);
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

function startSynth() {
  ensure();
  ctx.resume();
  if (state.mode === 'fanyin') startDrone();
  schedule();
}
function stopSynth() {
  clearTimeout(timer); timer = null;
  stopDrone();
}

function startCustom() {
  if (!audioEl) { audioEl = new Audio(); audioEl.loop = true; }
  if (!state.url) return false;
  audioEl.src = state.url;
  audioEl.volume = state.volume;
  audioEl.play().catch(() => {});
  return true;
}
function stopCustom() { if (audioEl) audioEl.pause(); }

export function play() {
  if (playing) return;
  playing = true;
  if (state.mode === 'custom') startCustom();
  else startSynth();
  notify();
}
export function pause() {
  if (!playing) return;
  playing = false;
  stopSynth(); stopCustom();
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
export function setVolume(v) {
  state.volume = Math.max(0, Math.min(1, v));
  localStorage.setItem('sutra_vol', Math.round(state.volume * 100));
  if (master) master.gain.value = state.volume;
  if (audioEl) audioEl.volume = state.volume;
}
export function setUrl(u) { state.url = u; localStorage.setItem('sutra_url', u); }
export function getState() { return state; }
