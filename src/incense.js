// F2 / F4 — 一炷香（置中、爐中升起、火星下移、香灰飄擺）
import { store } from './store.js';
import { sound } from './sound.js';
import { spawnSmoke, renderSmoke, clearSmoke } from './smoke.js';

let canvas, ctx, raf;

// 版面比例（相對畫面高度）：香身中點對齊畫面正中 0.5
const TIP_TOP = 0.34;      // 起始香頭（最高點）
const STICK_BOTTOM = 0.66; // 插入香爐處（中點 = 0.5）
const CENSER_Y = 0.66;

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

// 火星座標（隨燃燒下移）
function emberPos(w, h) {
  const s = store.get();
  const top = h * TIP_TOP;
  const bottom = h * STICK_BOTTOM;
  return { x: w / 2, y: top + (bottom - top) * s.burnedRatio };
}

function loop() {
  const w = window.innerWidth, h = window.innerHeight;
  const s = store.get();

  // 殘影（F8）：快速移動時不完全清除，疊半透明
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
    if (ratio >= 1) store.set({ phase: 'done', lit: false });
  }

  drawCenser(w, h);
  drawIncense(w, h);

  if (s.lit) {
    const e = emberPos(w, h);
    spawnSmoke(e.x, e.y);
  }
  renderSmoke(ctx, w, h);

  raf = requestAnimationFrame(loop);
}

function drawCenser(w, h) {
  const cx = w / 2;
  const y = h * CENSER_Y;
  const rw = Math.min(120, w * 0.26); // 半寬
  // 爐身（梯形碗）
  ctx.beginPath();
  ctx.moveTo(cx - rw, y);
  ctx.lineTo(cx + rw, y);
  ctx.lineTo(cx + rw * 0.78, y + 46);
  ctx.lineTo(cx - rw * 0.78, y + 46);
  ctx.closePath();
  ctx.fillStyle = 'rgba(28,18,12,0.92)';
  ctx.fill();
  // 爐口金線
  ctx.strokeStyle = 'rgba(212,175,55,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, y, rw, 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  // 爐內陰影
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, y, rw - 6, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawIncense(w, h) {
  const s = store.get();
  const cx = w / 2;
  const top = h * TIP_TOP;
  const bottom = h * STICK_BOTTOM;
  const emberY = s.lit ? top + (bottom - top) * s.burnedRatio : top;
  const now = performance.now();

  // 未燃香身（火星以下）：暖褐，略帶錐度
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#8a5a32';
  ctx.beginPath();
  ctx.moveTo(cx, emberY);
  ctx.lineTo(cx, bottom);
  ctx.stroke();

  // 已燃香灰（火星以上）：灰白、隨高度微微飄擺
  if (s.lit && emberY > top) {
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    let started = false;
    for (let y = emberY; y >= top; y -= 4) {
      const prog = (emberY - y) / (emberY - top + 0.001); // 0(火星) → 1(頂)
      const ax = cx + Math.sin(y * 0.045 + now * 0.0012) * 6 * prog;
      if (!started) { ctx.moveTo(ax, y); started = true; }
      else ctx.lineTo(ax, y);
    }
    ctx.strokeStyle = 'rgba(196,190,180,0.7)';
    ctx.stroke();
  }

  // 火星：呼吸般明滅 + 光暈
  if (s.lit && s.phase === 'burning') {
    const breathe = 0.75 + Math.sin(now / 260) * 0.25;
    const R = 12 * breathe;
    const glow = ctx.createRadialGradient(cx, emberY, 0, cx, emberY, R);
    glow.addColorStop(0, 'rgba(255,255,255,0.95)');
    glow.addColorStop(0.35, `rgba(255,138,43,${0.85 * breathe})`);
    glow.addColorStop(1, 'rgba(255,90,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, emberY, R, 0, Math.PI * 2);
    ctx.fill();
    // 核心亮點
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, emberY, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
