// F2 / F4 — 一炷長香（香爐露上緣、香由上往下燒；香灰=已燒長度、錨在上、最長 1/10、隨機時間或搖晃才整段掉）
import { store } from './store.js';
import { sound } from './sound.js';
import { spawnSmoke, renderSmoke, clearSmoke } from './smoke.js';

let canvas, ctx, raf;

// 版面比例（相對畫面高度）
const STICK_TOP_NORMAL = 0.16;
const STICK_TOP_TABLET = 0.46;  // 牌位模式：香前移、變短
const CENSER_TOP = 0.84;
function topFrac() { return store.get().tabletMode ? STICK_TOP_TABLET : STICK_TOP_NORMAL; }

// 香灰：自上而下累積的節點（世界座標），長度 = 距上次掉落所燒掉的長度
const ASH_NODE_STEP = 3;
let ashNodes = null;       // [{x,y}...] 由上（最老）到下（火星）
let ashSegTopY = 0;        // 本段香灰最頂端（上次掉落處）
let ashDropLen = 0;        // 本段隨機掉落門檻（≤ 整炷香 1/10）
let shakeAccum = 0;        // 搖晃累積（晃手機加速掉落）

const fallingAsh = [];     // 斷落的灰段（剛體翻落）
const debris = [];         // 碎屑
const sparks = [];         // 點火火花

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
    spawnSparks(window.innerWidth / 2, window.innerHeight * topFrac());
    setTimeout(() => lighter.classList.remove('active'), 700);
  }, 900);
}

export function resetIncense() {
  clearSmoke();
  fallingAsh.length = 0; debris.length = 0; sparks.length = 0;
  ashNodes = null; shakeAccum = 0;
  store.set({ lit: false, igniting: false, phase: 'idle', burnedRatio: 0 });
  document.getElementById('burnStatus').hidden = true;
}

// 火星位置：隨燃燒由上往下移
function emberY(h) {
  const s = store.get();
  const top = topFrac();
  return h * top + h * (CENSER_TOP - top) * s.burnedRatio;
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

// 香爐：只畫上緣
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

// 錐度兩色香身
function drawStick(cx, topY, h) {
  const censerY = h * CENSER_TOP;
  const fullTop = h * topFrac();
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

// 整炷香 1/10 為香灰最長值
function maxAshLen(h) { return (h * CENSER_TOP - h * topFrac()) / 10; }
function pickDropLen(h) { return maxAshLen(h) * (0.4 + Math.random() * 0.6); }

function startAshSeg(cx, y, h) {
  ashNodes = [{ x: cx, y }];
  ashSegTopY = y;
  ashDropLen = pickDropLen(h);
}

function rotAbout(p, ox, oy, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = p.x - ox, dy = p.y - oy;
  return { x: ox + dx * c - dy * s, y: oy + dx * s + dy * c };
}

function drawAshColumn(ox, oy, sway) {
  if (!ashNodes || ashNodes.length < 2) return;
  ctx.beginPath();
  for (let i = 0; i < ashNodes.length; i++) {
    const r = rotAbout(ashNodes[i], ox, oy, sway);
    if (i === 0) ctx.moveTo(r.x, r.y); else ctx.lineTo(r.x, r.y);
  }
  ctx.strokeStyle = 'rgba(150,144,134,0.82)';
  ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
  // 頂端（最老最脆）炭化
  const tip = rotAbout(ashNodes[0], ox, oy, sway);
  ctx.fillStyle = 'rgba(70,62,54,0.85)';
  ctx.beginPath(); ctx.arc(tip.x, tip.y, 2, 0, Math.PI * 2); ctx.fill();
}

// 整段香灰斷落、剛體翻墜
function dropAshColumn(ox, oy, sway) {
  if (!ashNodes || ashNodes.length < 2) return;
  const pts = ashNodes.map((p) => rotAbout(p, ox, oy, sway));
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= pts.length; my /= pts.length;
  fallingAsh.push({
    pts: pts.map((p) => ({ x: p.x - mx, y: p.y - my })),
    x: mx, y: my, ang: 0,
    vx: Math.sin(sway) * 2 + (Math.random() - 0.5) * 0.4,
    vy: 0.1 + Math.random() * 0.2,
    va: (Math.random() - 0.5) * 0.05,
    life: 1, decay: 0.006 + Math.random() * 0.004,
  });
  spawnDebris(ox, oy, 3);
}

function drawIncense(w, h) {
  const s = store.get();
  const cx = w / 2;
  const top = h * topFrac();
  const eY = emberY(h);
  const burning = s.phase === 'burning';
  const done = s.phase === 'done';
  const igniting = s.igniting;
  const now = performance.now();

  // 未燃香身（火星 → 香爐）
  if (s.burnedRatio < 1) {
    drawStick(cx, (burning || done) ? eY : top, h);
  }

  if (burning) {
    // 暗紅餘燼 + 黑炭頭（緊貼火星）
    const breathe = 0.7 + Math.sin(now / 240) * 0.3;
    const R = 5 * breathe;
    const glow = ctx.createRadialGradient(cx, eY, 0, cx, eY, R);
    glow.addColorStop(0, `rgba(255,120,40,${0.55 * breathe})`);
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, eY, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1714';
    ctx.beginPath(); ctx.ellipse(cx, eY - 1, 3, 4, 0, 0, Math.PI * 2); ctx.fill();

    // 香灰：隨火星下移在世界座標累積（長度 = 已燒長度）
    if (ashNodes === null) startAshSeg(cx, eY, h);
    let guard = 0;
    while (eY - ashNodes[ashNodes.length - 1].y >= ASH_NODE_STEP && guard++ < 300) {
      const prev = ashNodes[ashNodes.length - 1];
      const nx = prev.x * 0.8 + cx * 0.2 + (Math.random() - 0.5) * 1.8; // 略歪、貼著原軸
      ashNodes.push({ x: nx, y: prev.y + ASH_NODE_STEP });
    }
    const ashLen = eY - ashSegTopY;
    const prec = Math.min(1, ashLen / ashDropLen);
    // 剛性搖晃（繞火星），越接近掉落晃越大 → 搖搖欲墜
    const sway = Math.sin(now / 600 + ashSegTopY) * 0.045 * (0.3 + prec);

    // 晃手機：累積搖晃，提早整段掉落
    if (s.fastMove) shakeAccum += 18; else shakeAccum *= 0.94;

    drawAshColumn(cx, eY, sway);

    if (ashLen >= ashDropLen || (shakeAccum > 200 && ashLen > 8)) {
      dropAshColumn(cx, eY, sway);
      startAshSeg(cx, eY, h);
      shakeAccum = 0;
    }
  }

  // 燒盡：殘香斷落、爐中留炭黑短截，無火光
  if (done) {
    if (ashNodes) { dropAshColumn(cx, eY, 0); ashNodes = null; }
    const stubTop = h * CENSER_TOP - 30;
    ctx.lineCap = 'round'; ctx.lineWidth = 4;
    ctx.strokeStyle = '#2a2320';
    ctx.beginPath(); ctx.moveTo(cx, stubTop); ctx.lineTo(cx, h * CENSER_TOP); ctx.stroke();
    ctx.fillStyle = '#161210';
    ctx.beginPath(); ctx.arc(cx, stubTop, 3, 0, Math.PI * 2); ctx.fill();
  }

  // 點火瞬間火光
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
      const r = rotAbout(f.pts[j], 0, 0, f.ang);
      const X = f.x + r.x, Y = f.y + r.y;
      if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    ctx.strokeStyle = '#8f897f';
    ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
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
