// F2 / F4 — 一炷長香（香爐露上緣、香由上往下燒而變短、香灰歪斜下垂、整段斷落）
import { store } from './store.js';
import { sound } from './sound.js';
import { spawnSmoke, renderSmoke, clearSmoke } from './smoke.js';

let canvas, ctx, raf;

// 版面比例（相對畫面高度）：長香，香爐貼近手機底部
const STICK_TOP = 0.16;   // 起始香頭（最高點）
const CENSER_TOP = 0.84;  // 香爐口

// 懸掛香灰（固定形狀的歪斜下垂灰柱，長到上限就整段斷落）
const ASH_STEP = 3.5;
let ashShape = null;      // 灰柱節點（相對火星的偏移，已含歪斜與下垂）
let ashLen = 0;           // 目前已長出的長度（px）
let ashMaxLen = 0;        // 本段斷落門檻
let ashLean = 0;          // 下垂方向
let ashSeed = 0;
const fallingAsh = [];    // 斷落的灰段（剛體翻落）
const debris = [];        // 斷裂時的小碎屑
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
    spawnSparks(window.innerWidth / 2, window.innerHeight * STICK_TOP);
    setTimeout(() => lighter.classList.remove('active'), 700);
  }, 900);
}

export function resetIncense() {
  clearSmoke();
  fallingAsh.length = 0; debris.length = 0; sparks.length = 0;
  ashShape = null; ashLen = 0;
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
  renderFallingAsh();
  renderDebris();
  renderSparks();

  raf = requestAnimationFrame(loop);
}

// 香爐：只畫上緣（碗口 + 一小段前壁）
function drawCenser(w, h) {
  const cx = w / 2;
  const y = h * CENSER_TOP;
  const rw = Math.min(140, w * 0.3);
  ctx.beginPath();
  ctx.moveTo(cx - rw, y);
  ctx.quadraticCurveTo(cx, y + 40, cx + rw, y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(30,20,14,0.95)';
  ctx.fill();
  ctx.fillStyle = 'rgba(66,57,50,0.95)';
  ctx.beginPath();
  ctx.ellipse(cx, y, rw - 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(212,175,55,0.55)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(cx, y, rw, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// 錐度兩色香身（上段香粉褐、下段竹枝紅）
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
  g.addColorStop(0.74, '#8c2222');
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

// 建立一段固定形狀的歪斜下垂灰柱（建立後不再變形 → 不會有彈性）
function buildAsh(maxLen, lean) {
  const pts = [{ x: 0, y: 0 }];
  let x = 0, y = 0, wob = 0;
  for (let s = ASH_STEP; s <= maxLen; s += ASH_STEP) {
    const frac = s / maxLen;
    wob = wob * 0.78 + (Math.random() - 0.5) * 0.32;   // 固定的歪斜
    const sag = lean * frac * 0.9;                       // 越長越下垂（重力彎曲）
    const heading = -Math.PI / 2 + wob * 0.5 + sag;      // 大致朝上、略歪略垂
    x += Math.cos(heading) * ASH_STEP;
    y += Math.sin(heading) * ASH_STEP;
    pts.push({ x, y });
  }
  return pts;
}

function regenAsh() {
  ashLean = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5);
  ashMaxLen = 26 + Math.random() * 26;   // 26~52px 即斷
  ashSeed = (Math.random() * 6.28);
  ashShape = buildAsh(ashMaxLen, ashLean);
  ashLen = 0;
}

function rot(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function drawAshPolyline(ox, oy, pts, n, ang) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const r = rot(pts[i], ang);
    const X = ox + r.x, Y = oy + r.y;
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  ctx.strokeStyle = 'rgba(150,144,134,0.82)';
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
  // 灰尾端炭化
  const tip = rot(pts[n - 1], ang);
  ctx.fillStyle = 'rgba(58,52,46,0.85)';
  ctx.beginPath();
  ctx.arc(ox + tip.x, oy + tip.y, 2, 0, Math.PI * 2);
  ctx.fill();
}

function detachAsh(ox, oy, pts, n, ang) {
  const seg = [];
  for (let i = 0; i < n; i++) seg.push(rot(pts[i], ang));
  fallingAsh.push({
    pts: seg, x: ox, y: oy, ang: 0,
    vx: ashLean * 0.5 + (Math.random() - 0.5) * 0.3,
    vy: 0.15 + Math.random() * 0.25,
    va: (Math.random() - 0.5) * 0.05,
    life: 1, decay: 0.007 + Math.random() * 0.005,
  });
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

  // 未燃香身（火星 → 香爐），香隨燃燒由上而短
  if (s.burnedRatio < 1) {
    drawStick(cx, (burning || done) ? eY : top, h);
  }

  // 燃燒中：暗紅餘燼 + 黑炭頭（緊貼火星，隨之下移）+ 懸掛灰柱
  if (burning) {
    const breathe = 0.7 + Math.sin(now / 240) * 0.3;
    const R = 5 * breathe;
    const glow = ctx.createRadialGradient(cx, eY, 0, cx, eY, R);
    glow.addColorStop(0, `rgba(255,120,40,${0.55 * breathe})`);
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, eY, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1714';
    ctx.beginPath(); ctx.ellipse(cx, eY - 1, 3, 4, 0, 0, Math.PI * 2); ctx.fill();

    // 懸掛灰柱：成長 → 搖搖欲墜 → 整段斷落
    if (!ashShape) regenAsh();
    ashLen += 0.22;
    const n = Math.max(2, Math.min(ashShape.length, Math.floor(ashLen / ASH_STEP) + 1));
    const prec = Math.min(1, ashLen / ashMaxLen);
    // 極輕微的「剛性」搖晃（整段一起轉一點點，非逐點彈動），越接近斷落晃越明顯
    const sway = Math.sin(now / 620 + ashSeed) * 0.025 * (0.35 + prec);
    drawAshPolyline(cx, eY, ashShape, n, sway);
    if (ashLen >= ashMaxLen) {
      const tip = rot(ashShape[n - 1], sway);
      detachAsh(cx, eY, ashShape, n, sway);
      spawnDebris(cx + tip.x, eY + tip.y, 3);
      regenAsh();
    }
  }

  // 燒盡：殘香斷落、爐中留炭黑短截，無火光
  if (done) {
    if (ashShape) {
      const n = Math.max(2, Math.min(ashShape.length, Math.floor(ashLen / ASH_STEP) + 1));
      detachAsh(cx, eY, ashShape, n, 0);
      ashShape = null;
    }
    const stubTop = h * CENSER_TOP - 30;
    ctx.lineCap = 'round'; ctx.lineWidth = 4;
    ctx.strokeStyle = '#2a2320';
    ctx.beginPath(); ctx.moveTo(cx, stubTop); ctx.lineTo(cx, h * CENSER_TOP); ctx.stroke();
    ctx.fillStyle = '#161210';
    ctx.beginPath(); ctx.arc(cx, stubTop, 3, 0, Math.PI * 2); ctx.fill();
  }

  // 點火瞬間：頂端火光（之後不再有火花）
  if (igniting) {
    const breathe = 0.8 + Math.sin(now / 120) * 0.2;
    const R = 10 * breathe;
    const glow = ctx.createRadialGradient(cx, top, 0, cx, top, R);
    glow.addColorStop(0, 'rgba(255,245,210,0.95)');
    glow.addColorStop(0.4, `rgba(255,130,40,${0.85 * breathe})`);
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, top, R, 0, Math.PI * 2); ctx.fill();
  }
}

// 斷落的灰段：剛體翻落、淡出
function renderFallingAsh() {
  for (let i = fallingAsh.length - 1; i >= 0; i--) {
    const f = fallingAsh[i];
    f.vy += 0.022; f.va *= 0.99;
    f.x += f.vx; f.y += f.vy; f.ang += f.va;
    f.life -= f.decay;
    if (f.life <= 0 || f.y > window.innerHeight + 40) { fallingAsh.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, f.life) * 0.8;
    ctx.beginPath();
    for (let j = 0; j < f.pts.length; j++) {
      const r = rot(f.pts[j], f.ang);
      const X = f.x + r.x, Y = f.y + r.y;
      if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.strokeStyle = '#8f897f';
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function spawnDebris(x, y, n) {
  for (let i = 0; i < n; i++) {
    debris.push({
      x: x + (Math.random() - 0.5) * 4, y,
      vx: (Math.random() - 0.5) * 0.6, vy: 0.2 + Math.random() * 0.5,
      life: 1, decay: 0.01 + Math.random() * 0.01, size: 1 + Math.random() * 1.2,
    });
  }
}

function renderDebris() {
  for (let i = debris.length - 1; i >= 0; i--) {
    const f = debris[i];
    f.vy += 0.02; f.x += f.vx; f.y += f.vy;
    f.life -= f.decay;
    if (f.life <= 0) { debris.splice(i, 1); continue; }
    ctx.globalAlpha = f.life * 0.6;
    ctx.fillStyle = '#9a948a';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function spawnSparks(cx, y) {
  const n = 12 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
    const sp = 1 + Math.random() * 2.4;
    sparks.push({
      x: cx, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 1, decay: 0.03 + Math.random() * 0.03, size: 0.8 + Math.random() * 1.2,
    });
  }
}

function renderSparks() {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.vy += 0.06; s.x += s.vx; s.y += s.vy;
    s.life -= s.decay;
    if (s.life <= 0) { sparks.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, s.life);
    ctx.fillStyle = s.life > 0.5 ? '#fff2b0' : '#ff7a18';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
