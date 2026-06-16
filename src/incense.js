// F2 / F4 — 一炷香渲染、打火機點香、燃燒進度
import { store } from './store.js';
import { sound } from './sound.js';
import { spawnSmoke, renderSmoke, clearSmoke } from './smoke.js';

let canvas, ctx, raf;

export function initStage() {
  canvas = document.getElementById('stage');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  loop();
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// 打火機動畫 → 點香
export function ignite() {
  const s = store.get();
  if (s.lit) return;
  const lighter = document.getElementById('lighter');
  lighter.classList.add('active');
  sound.lighter();
  setTimeout(() => {
    store.set({ lit: true, phase: 'burning', startTime: performance.now() });
    document.getElementById('burnStatus').hidden = false;
    setTimeout(() => lighter.classList.remove('active'), 700);
  }, 900);
}

export function resetIncense() {
  clearSmoke();
  store.set({ lit: false, phase: 'idle', burnedRatio: 0 });
  document.getElementById('burnStatus').hidden = true;
}

function loop() {
  const w = window.innerWidth, h = window.innerHeight;
  const s = store.get();

  // 殘影（F8）：fastMove 時不完全清空，疊半透明
  if (s.fastMove && s.lit) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }

  // 燃燒進度
  if (s.lit && s.phase === 'burning') {
    const elapsed = (performance.now() - s.startTime) / 1000;
    const ratio = Math.min(1, elapsed / s.duration);
    if (ratio !== s.burnedRatio) store.set({ burnedRatio: ratio });
    if (ratio >= 1) { store.set({ phase: 'done', lit: false }); }
  }

  drawIncense(w, h);
  if (s.lit) {
    const tip = incenseTip(w, h);
    spawnSmoke(tip.x, tip.y);
  }
  renderSmoke(ctx, w, h);

  raf = requestAnimationFrame(loop);
}

// 香頭（火星）座標：隨燃燒下移
function incenseTip(w, h) {
  const s = store.get();
  const baseTop = h * 0.30;
  const fullLen = h * 0.34;
  const burnedLen = fullLen * s.burnedRatio;
  return { x: w / 2, y: baseTop + burnedLen };
}

function drawIncense(w, h) {
  const s = store.get();
  const x = w / 2;
  const top = h * 0.30;
  const bottom = h * 0.64;
  const tipY = top + (bottom - top) * s.burnedRatio;

  // 香身（未燃部分）
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#7a4a2b';
  ctx.beginPath();
  ctx.moveTo(x, s.lit ? tipY : top);
  ctx.lineTo(x, bottom);
  ctx.stroke();

  // 已燃香灰（細灰白）
  if (s.lit && s.burnedRatio > 0) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(180,180,175,0.7)';
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, tipY);
    ctx.stroke();
  }

  // 香頭火星（發光）
  if (s.lit && s.phase === 'burning') {
    const glow = 4 + Math.sin(performance.now() / 200) * 1.5;
    const grad = ctx.createRadialGradient(x, tipY, 0, x, tipY, glow * 2.2);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.4, '#ff7a18');
    grad.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, tipY, glow * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
