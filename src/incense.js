// F2 / F4 — 一炷長香（香爐在底、香身錐度兩色、火星下移、香灰累積後斷落）
import { store } from './store.js';
import { sound } from './sound.js';
import { spawnSmoke, renderSmoke, clearSmoke } from './smoke.js';

let canvas, ctx, raf;

// 版面比例（相對畫面高度）：長香，香爐貼近手機底部
const STICK_TOP = 0.16;   // 起始香頭（最高點）
const CENSER_TOP = 0.86;  // 香爐口（其下延伸至畫面底部）

// 香灰：累積到一定長度便斷落
let attachedAsh = 0;        // 目前懸掛的香灰長度（px）
const ASH_MAX = 46;
const ashFlakes = [];       // 飄落的灰燼

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
  store.set({ igniting: true });
  sound.lighter();
  setTimeout(() => {
    store.set({ lit: true, igniting: false, phase: 'burning', startTime: performance.now() });
    document.getElementById('burnStatus').hidden = false;
    setTimeout(() => lighter.classList.remove('active'), 700);
  }, 900);
}

export function resetIncense() {
  clearSmoke();
  ashFlakes.length = 0;
  attachedAsh = 0;
  store.set({ lit: false, igniting: false, phase: 'idle', burnedRatio: 0 });
  document.getElementById('burnStatus').hidden = true;
}

function emberY(h) {
  const s = store.get();
  return h * STICK_TOP + h * (CENSER_TOP - STICK_TOP) * s.burnedRatio;
}

// 香身輕微擺動
function wobble(y, now) { return Math.sin(y * 0.04 + now * 0.0011) * 5; }

function loop() {
  const w = window.innerWidth, h = window.innerHeight;
  const s = store.get();

  // 殘影（F8）：快速移動時不完全清除
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

  if (s.lit) spawnSmoke(w / 2, emberY(h));
  renderSmoke(ctx, w, h);
  renderAshFlakes();

  raf = requestAnimationFrame(loop);
}

function drawCenser(w, h) {
  const cx = w / 2;
  const y = h * CENSER_TOP;
  const rw = Math.min(160, w * 0.34);
  // 爐身（碗形，向下延伸至畫面底部）
  ctx.beginPath();
  ctx.moveTo(cx - rw, y);
  ctx.quadraticCurveTo(cx - rw * 1.04, y + (h - y) * 0.55, cx - rw * 0.66, h);
  ctx.lineTo(cx + rw * 0.66, h);
  ctx.quadraticCurveTo(cx + rw * 1.04, y + (h - y) * 0.55, cx + rw, y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(30,20,14,0.95)';
  ctx.fill();
  // 爐內香灰
  ctx.fillStyle = 'rgba(64,55,48,0.95)';
  ctx.beginPath();
  ctx.ellipse(cx, y, rw - 6, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // 爐口金線
  ctx.strokeStyle = 'rgba(212,175,55,0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, y, rw, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// 錐度兩色香身（上段香粉褐、下段竹枝紅），有高光，看起來立體
function drawStick(cx, topY, h) {
  const censerY = h * CENSER_TOP;
  const wTop = 2.2, wBot = 3.8;
  const len = censerY - (h * STICK_TOP);
  const tShade = (yy) => (yy - h * STICK_TOP) / len; // 0頂→1底
  const wAt = (yy) => wTop + (wBot - wTop) * tShade(yy);

  ctx.beginPath();
  ctx.moveTo(cx - wAt(topY), topY);
  ctx.lineTo(cx - wBot, censerY + 4);
  ctx.lineTo(cx + wBot, censerY + 4);
  ctx.lineTo(cx + wAt(topY), topY);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, h * STICK_TOP, 0, censerY);
  g.addColorStop(0, '#a9743f');
  g.addColorStop(0.55, '#8a5a32');
  g.addColorStop(0.72, '#6b3f24');
  g.addColorStop(0.74, '#8c2222'); // 竹枝染紅
  g.addColorStop(1, '#5a1414');
  ctx.fillStyle = g;
  ctx.fill();
  // 高光
  ctx.strokeStyle = 'rgba(255,222,180,0.22)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - wAt(topY) * 0.4, topY);
  ctx.lineTo(cx - wBot * 0.4, censerY);
  ctx.stroke();
}

function drawIncense(w, h) {
  const s = store.get();
  const cx = w / 2;
  const top = h * STICK_TOP;
  const eY = emberY(h);
  const burning = s.phase === 'burning';
  const done = s.phase === 'done';
  const igniting = s.igniting;
  const now = performance.now();

  // 未燃香身（火星以下 → 香爐）
  if (s.burnedRatio < 1) {
    drawStick(cx, (burning || done) ? eY : top, h);
  }

  // 香灰累積 + 斷落
  if (burning) {
    attachedAsh += 0.18;
    if (attachedAsh > ASH_MAX) {
      const ashTopY = eY - attachedAsh;
      dropAsh(cx, ashTopY, eY - 10, now);
      attachedAsh = 6;
    }
  }

  // 懸掛的香灰（火星上方，灰白、會擺動，頂端炭化）
  if (burning && attachedAsh > 2) {
    const ashTopY = eY - attachedAsh;
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    let started = false;
    for (let y = eY; y >= ashTopY; y -= 4) {
      const prog = (eY - y) / attachedAsh;
      const ax = cx + wobble(y, now) * prog * 1.5;
      if (!started) { ctx.moveTo(ax, y); started = true; } else ctx.lineTo(ax, y);
    }
    ctx.strokeStyle = 'rgba(150,144,134,0.7)';
    ctx.stroke();
    // 炭化灰頭
    ctx.fillStyle = '#2a2421';
    ctx.beginPath();
    ctx.arc(cx + wobble(ashTopY, now) * 1.5, ashTopY, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 燒盡：香爐中留一小截炭黑殘香，無火光
  if (done) {
    const stubTop = h * CENSER_TOP - 34;
    ctx.lineCap = 'round'; ctx.lineWidth = 4;
    ctx.strokeStyle = '#2a2320';
    ctx.beginPath();
    ctx.moveTo(cx, stubTop);
    ctx.lineTo(cx, h * CENSER_TOP);
    ctx.stroke();
    ctx.fillStyle = '#161210';
    ctx.beginPath();
    ctx.arc(cx, stubTop, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 火光：點火動畫（頂端）或燃燒中火星（小巧內斂）
  if (burning || igniting) {
    const glowY = igniting ? top : eY;
    const breathe = 0.78 + Math.sin(now / 240) * 0.22;
    const R = (igniting ? 9 : 7) * breathe;
    const glow = ctx.createRadialGradient(cx, glowY, 0, cx, glowY, R);
    glow.addColorStop(0, 'rgba(255,245,210,0.95)');
    glow.addColorStop(0.4, `rgba(255,130,40,${0.8 * breathe})`);
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, glowY, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath();
    ctx.arc(cx, glowY, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 一段香灰斷落，化為飄落的灰燼
function dropAsh(cx, fromY, toY, now) {
  const n = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const y = fromY + Math.random() * (toY - fromY);
    ashFlakes.push({
      x: cx + wobble(y, now) + (Math.random() - 0.5) * 5,
      y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 0.3 + Math.random() * 0.6,
      life: 1,
      decay: 0.005 + Math.random() * 0.006,
      size: 1.1 + Math.random() * 1.5,
    });
  }
}

function renderAshFlakes() {
  for (let i = ashFlakes.length - 1; i >= 0; i--) {
    const f = ashFlakes[i];
    f.vy += 0.018;       // 重力
    f.vx += Math.sin(f.y * 0.05) * 0.01; // 飄移
    f.x += f.vx; f.y += f.vy;
    f.life -= f.decay;
    if (f.life <= 0) { ashFlakes.splice(i, 1); continue; }
    ctx.globalAlpha = f.life * 0.7;
    ctx.fillStyle = '#9a948a';
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
