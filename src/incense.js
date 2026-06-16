// F2 / F4 — 一炷長香（香爐露上緣、香由上往下燒而變短、黑炭頭隨火星下移、灰燼斷續掉落）
import { store } from './store.js';
import { sound } from './sound.js';
import { spawnSmoke, renderSmoke, clearSmoke } from './smoke.js';

let canvas, ctx, raf;

// 版面比例（相對畫面高度）：長香，香爐貼近手機底部
const STICK_TOP = 0.16;   // 起始香頭（最高點）
const CENSER_TOP = 0.84;  // 香爐口

const ashFlakes = [];     // 斷續掉落的灰燼
const sparks = [];        // 點火瞬間的火花

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
    spawnSparks(window.innerWidth / 2, window.innerHeight * STICK_TOP); // 點著的火花
    setTimeout(() => lighter.classList.remove('active'), 700);
  }, 900);
}

export function resetIncense() {
  clearSmoke();
  ashFlakes.length = 0;
  sparks.length = 0;
  store.set({ lit: false, igniting: false, phase: 'idle', burnedRatio: 0 });
  document.getElementById('burnStatus').hidden = true;
}

// 火星位置：隨燃燒由上往下移（香因此變短）
function emberY(h) {
  const s = store.get();
  return h * STICK_TOP + h * (CENSER_TOP - STICK_TOP) * s.burnedRatio;
}

function loop() {
  const w = window.innerWidth, h = window.innerHeight;
  const s = store.get();

  // 殘影（F8）
  if (s.fastMove && s.lit) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }

  if (s.lit && s.phase === 'burning') {
    const elapsed = (performance.now() - s.startTime) / 1000;
    const ratio = Math.min(1, elapsed / s.duration);
    if (ratio !== s.burnedRatio) store.set({ burnedRatio: ratio });
    if (ratio >= 1) store.set({ phase: 'done', lit: false });
  }

  drawIncense(w, h);
  drawCenser(w, h);

  if (s.lit) spawnSmoke(w / 2, emberY(h));
  renderSmoke(ctx, w, h);
  renderAshFlakes();
  renderSparks();

  raf = requestAnimationFrame(loop);
}

// 香爐：只畫上緣（碗口 + 一小段前壁），不畫整個碗
function drawCenser(w, h) {
  const cx = w / 2;
  const y = h * CENSER_TOP;
  const rw = Math.min(140, w * 0.3);
  // 上半碗壁（淺弧）
  ctx.beginPath();
  ctx.moveTo(cx - rw, y);
  ctx.quadraticCurveTo(cx, y + 40, cx + rw, y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(30,20,14,0.95)';
  ctx.fill();
  // 爐內香灰面
  ctx.fillStyle = 'rgba(66,57,50,0.95)';
  ctx.beginPath();
  ctx.ellipse(cx, y, rw - 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // 爐口金線
  ctx.strokeStyle = 'rgba(212,175,55,0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, y, rw, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// 錐度兩色香身（上段香粉褐、下段竹枝紅），側邊高光
function drawStick(cx, topY, h) {
  const censerY = h * CENSER_TOP;
  const fullTop = h * STICK_TOP;
  const len = censerY - fullTop;
  const wTop = 2.4, wBot = 3.8;
  const wAt = (yy) => wTop + (wBot - wTop) * ((yy - fullTop) / len);

  ctx.beginPath();
  ctx.moveTo(cx - wAt(topY), topY);
  ctx.lineTo(cx - wBot, censerY + 4);
  ctx.lineTo(cx + wBot, censerY + 4);
  ctx.lineTo(cx + wAt(topY), topY);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, fullTop, 0, censerY);
  g.addColorStop(0, '#a9743f');
  g.addColorStop(0.55, '#8a5a32');
  g.addColorStop(0.72, '#6b3f24');
  g.addColorStop(0.74, '#8c2222'); // 竹枝染紅
  g.addColorStop(1, '#5a1414');
  ctx.fillStyle = g;
  ctx.fill();
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

  // 未燃香身：從火星（頂端）到香爐——香隨燃燒由上而短
  if (s.burnedRatio < 1) {
    drawStick(cx, (burning || done) ? eY : top, h);
  }

  // 燃燒中：暗紅餘燼 + 黑炭頭（緊貼火星，隨之下移）
  if (burning) {
    const breathe = 0.7 + Math.sin(now / 240) * 0.3;
    const R = 5 * breathe;
    const glow = ctx.createRadialGradient(cx, eY, 0, cx, eY, R);
    glow.addColorStop(0, `rgba(255,120,40,${0.55 * breathe})`);
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, eY, R, 0, Math.PI * 2);
    ctx.fill();
    // 黑炭頭
    ctx.fillStyle = '#1c1714';
    ctx.beginPath();
    ctx.ellipse(cx, eY - 1, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 灰燼斷斷續續掉落（非連續晃動的線）
    if (Math.random() < 0.03) dropAshFlake(cx, eY);
  }

  // 點火瞬間：頂端火光（之後就不再有火花）
  if (igniting) {
    const breathe = 0.8 + Math.sin(now / 120) * 0.2;
    const R = 10 * breathe;
    const glow = ctx.createRadialGradient(cx, top, 0, cx, top, R);
    glow.addColorStop(0, 'rgba(255,245,210,0.95)');
    glow.addColorStop(0.4, `rgba(255,130,40,${0.85 * breathe})`);
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, top, R, 0, Math.PI * 2);
    ctx.fill();
  }

  // 燒盡：爐中留一小截炭黑殘香，無火光
  if (done) {
    const stubTop = h * CENSER_TOP - 30;
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
}

// 一片灰燼從火星處剝落、飄墜
function dropAshFlake(cx, y) {
  ashFlakes.push({
    x: cx + (Math.random() - 0.5) * 4,
    y: y - 2,
    vx: (Math.random() - 0.5) * 0.5,
    vy: 0.2 + Math.random() * 0.5,
    life: 1,
    decay: 0.004 + Math.random() * 0.005,
    size: 1.1 + Math.random() * 1.4,
  });
}

function renderAshFlakes() {
  for (let i = ashFlakes.length - 1; i >= 0; i--) {
    const f = ashFlakes[i];
    f.vy += 0.016;                         // 重力
    f.vx += Math.sin(f.y * 0.05) * 0.01;   // 飄移
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

// 點著瞬間的火花
function spawnSparks(cx, y) {
  const n = 12 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
    const sp = 1 + Math.random() * 2.4;
    sparks.push({
      x: cx, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1,
      decay: 0.03 + Math.random() * 0.03,
      size: 0.8 + Math.random() * 1.2,
    });
  }
}

function renderSparks() {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.vy += 0.06; // 重力
    s.x += s.vx; s.y += s.vy;
    s.life -= s.decay;
    if (s.life <= 0) { sparks.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, s.life);
    ctx.fillStyle = s.life > 0.5 ? '#fff2b0' : '#ff7a18';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
