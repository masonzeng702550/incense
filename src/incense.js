// F2 / F4 — 一炷長香 + 小香爐
// 香灰 = 已燒長度（錨在上、隨火星下移、最長 1/10、隨機時間或搖晃才整段掉、掉入爐中）
import { store } from './store.js';
import { sound } from './sound.js';
import { spawnSmoke, renderSmoke, clearSmoke } from './smoke.js';

let canvas, ctx, raf;

const STICK_TOP_NORMAL = 0.16;
const STICK_TOP_TABLET = 0.46;  // 牌位模式：香前移、變短
const CENSER_TOP = 0.84;
function topFrac() { return store.get().tabletMode ? STICK_TOP_TABLET : STICK_TOP_NORMAL; }
function censerRim(w) { return Math.min(60, w * 0.15); }

// 香灰節點：以「相對香的座標」儲存 → 縮放/視窗變動時跟著香，不位移
// dx = 相對中軸的水平偏移；fy = 相對畫面高度的比例
const ASH_NODE_STEP = 3;
let ashNodes = null;       // [{dx, fy}...] 由上（最老）到下（火星）
let ashSegTopFy = 0;       // 本段頂端（上次掉落處）
let ashDropLen = 0;        // 本段隨機掉落門檻（≤ 整炷香 1/10，單位 px）
let shakeAccum = 0;

const fallingAsh = [];     // 斷落的灰段（剛體翻落）
const settledAsh = [];     // 落定在爐中的灰屑 {dx, up, r}
let ashPile = 0;           // 爐中香灰堆積（0~1）
const debris = [];
const sparks = [];

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
  fallingAsh.length = 0; settledAsh.length = 0; debris.length = 0; sparks.length = 0;
  ashNodes = null; shakeAccum = 0; ashPile = 0;
  store.set({ lit: false, igniting: false, phase: 'idle', burnedRatio: 0 });
  document.getElementById('burnStatus').hidden = true;
}

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

  drawIncense(w, h);  // 香身、香灰、火星、黑炭頭（黑炭頭在最上）
  drawCenser(w, h);   // 小香爐（含爐中堆積的灰）

  if (s.lit) spawnSmoke(w / 2, emberY(h));
  renderSmoke(ctx, w, h);
  renderFallingAsh(w, h);
  renderDebris();
  renderSparks();

  raf = requestAnimationFrame(loop);
}

// 小香爐：甕形爐身 + 兩耳 + 三足 + 爐口金邊 + 爐中香灰
function drawCenser(w, h) {
  const cx = w / 2;
  const rimY = h * CENSER_TOP;
  const rim = censerRim(w);
  const belly = rim * 1.3;
  const bodyH = 52;
  const botY = rimY + bodyH;

  // 兩耳
  ctx.strokeStyle = '#caa24a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx - rim, rimY + 6, 9, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + rim, rimY + 6, 9, Math.PI * 1.5, Math.PI * 2.5); ctx.stroke();

  // 爐身（甕）
  ctx.beginPath();
  ctx.moveTo(cx - rim, rimY);
  ctx.bezierCurveTo(cx - belly, rimY + bodyH * 0.4, cx - belly * 0.8, botY - 6, cx - rim * 0.55, botY);
  ctx.lineTo(cx + rim * 0.55, botY);
  ctx.bezierCurveTo(cx + belly * 0.8, botY - 6, cx + belly, rimY + bodyH * 0.4, cx + rim, rimY);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - belly, 0, cx + belly, 0);
  g.addColorStop(0, '#2c1d12');
  g.addColorStop(0.45, '#6e4f30');
  g.addColorStop(0.55, '#7a5a38');
  g.addColorStop(1, '#241710');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(202,162,74,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();

  // 三足
  ctx.fillStyle = '#241710';
  for (const dxLeg of [-rim * 0.5, 0, rim * 0.5]) {
    ctx.beginPath();
    ctx.moveTo(cx + dxLeg - 4, botY - 3);
    ctx.lineTo(cx + dxLeg + 4, botY - 3);
    ctx.lineTo(cx + dxLeg + 2, botY + 9);
    ctx.lineTo(cx + dxLeg - 2, botY + 9);
    ctx.closePath(); ctx.fill();
  }

  // 爐口金邊
  ctx.strokeStyle = 'rgba(212,175,55,0.7)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(cx, rimY, rim, 7, 0, 0, Math.PI * 2); ctx.stroke();

  // 爐內香灰（隨掉落堆積成小丘）
  ctx.fillStyle = '#5f574e';
  ctx.beginPath(); ctx.ellipse(cx, rimY, rim - 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (ashPile > 0) {
    const moundH = 3 + ashPile * 9;
    ctx.fillStyle = '#7d756b';
    ctx.beginPath(); ctx.ellipse(cx, rimY - moundH * 0.4, (rim - 6) * 0.8, moundH * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 落定的灰屑
  ctx.fillStyle = '#8f897f';
  for (const p of settledAsh) {
    ctx.beginPath(); ctx.arc(cx + p.dx, rimY - p.up, p.r, 0, Math.PI * 2); ctx.fill();
  }
}

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
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,222,180,0.22)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - wAt(topY) * 0.4, topY);
  ctx.lineTo(cx - wBot * 0.4, censerY);
  ctx.stroke();
}

function maxAshLen(h) { return (h * CENSER_TOP - h * topFrac()) / 10; }
function pickDropLen(h) { return maxAshLen(h) * (0.4 + Math.random() * 0.6); }

function startAshSeg(eY, h) {
  ashNodes = [{ dx: 0, fy: eY / h }];
  ashSegTopFy = eY / h;
  ashDropLen = pickDropLen(h);
}

function rotAbout(p, ox, oy, a) {
  const c = Math.cos(a), s = Math.sin(a);
  const dx = p.x - ox, dy = p.y - oy;
  return { x: ox + dx * c - dy * s, y: oy + dx * s + dy * c };
}

// 香灰節點 → 世界座標
function ashWorld(node, cx, h) { return { x: cx + node.dx, y: node.fy * h }; }

function drawAshColumn(cx, h, eY, sway) {
  if (!ashNodes || ashNodes.length < 2) return;
  ctx.beginPath();
  for (let i = 0; i < ashNodes.length; i++) {
    const r = rotAbout(ashWorld(ashNodes[i], cx, h), cx, eY, sway);
    if (i === 0) ctx.moveTo(r.x, r.y); else ctx.lineTo(r.x, r.y);
  }
  ctx.strokeStyle = 'rgba(150,144,134,0.82)';
  ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
  const tip = rotAbout(ashWorld(ashNodes[0], cx, h), cx, eY, sway);
  ctx.fillStyle = 'rgba(70,62,54,0.85)';
  ctx.beginPath(); ctx.arc(tip.x, tip.y, 2, 0, Math.PI * 2); ctx.fill();
}

function dropAshColumn(cx, h, eY, sway) {
  if (!ashNodes || ashNodes.length < 2) return;
  const pts = ashNodes.map((nd) => rotAbout(ashWorld(nd, cx, h), cx, eY, sway));
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= pts.length; my /= pts.length;
  fallingAsh.push({
    pts: pts.map((p) => ({ x: p.x - mx, y: p.y - my })),
    x: mx, y: my, ang: 0,
    vx: Math.sin(sway) * 1.6 + (Math.random() - 0.5) * 0.4,
    vy: 0.1 + Math.random() * 0.2,
    va: (Math.random() - 0.5) * 0.05,
    life: 1,
  });
  spawnDebris(cx, eY, 3);
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

  // 未燃香身
  if (s.burnedRatio < 1) {
    drawStick(cx, (burning || done) ? eY : top, h);
  }

  if (burning) {
    // 香灰：相對座標累積（長度 = 已燒長度）
    if (ashNodes === null) startAshSeg(eY, h);
    let guard = 0;
    while (eY - (ashNodes[ashNodes.length - 1].fy * h) >= ASH_NODE_STEP && guard++ < 300) {
      const prev = ashNodes[ashNodes.length - 1];
      const ndx = prev.dx * 0.8 + (Math.random() - 0.5) * 1.8;
      ashNodes.push({ dx: ndx, fy: (prev.fy * h + ASH_NODE_STEP) / h });
    }
    const ashLen = eY - ashSegTopFy * h;
    const prec = Math.min(1, ashLen / ashDropLen);
    const sway = Math.sin(now / 600 + ashSegTopFy * 50) * 0.045 * (0.3 + prec);

    if (s.fastMove) shakeAccum += 18; else shakeAccum *= 0.94;

    // 香灰（先畫，黑炭頭蓋其上）
    drawAshColumn(cx, h, eY, sway);

    if (ashLen >= ashDropLen || (shakeAccum > 200 && ashLen > 8)) {
      dropAshColumn(cx, h, eY, sway);
      startAshSeg(eY, h);
      shakeAccum = 0;
    }

    // 暗紅餘燼 + 黑炭頭（圖層最前，蓋在香灰之上）
    const breathe = 0.7 + Math.sin(now / 240) * 0.3;
    const R = 5 * breathe;
    const glow = ctx.createRadialGradient(cx, eY, 0, cx, eY, R);
    glow.addColorStop(0, `rgba(255,120,40,${0.55 * breathe})`);
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, eY, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1714';
    ctx.beginPath(); ctx.ellipse(cx, eY - 1, 3.2, 4.2, 0, 0, Math.PI * 2); ctx.fill();
  }

  if (done) {
    if (ashNodes) { dropAshColumn(cx, h, eY, 0); ashNodes = null; }
    const stubTop = h * CENSER_TOP - 30;
    ctx.lineCap = 'round'; ctx.lineWidth = 4;
    ctx.strokeStyle = '#2a2320';
    ctx.beginPath(); ctx.moveTo(cx, stubTop); ctx.lineTo(cx, h * CENSER_TOP); ctx.stroke();
    ctx.fillStyle = '#161210';
    ctx.beginPath(); ctx.arc(cx, stubTop, 3, 0, Math.PI * 2); ctx.fill();
  }

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

// 斷落灰段：落到爐口即堆積入爐
function renderFallingAsh(w, h) {
  const cx = w / 2;
  const rimY = h * CENSER_TOP;
  const rim = censerRim(w);
  for (let i = fallingAsh.length - 1; i >= 0; i--) {
    const f = fallingAsh[i];
    f.vy += 0.022; f.va *= 0.99;
    f.x += f.vx; f.y += f.vy; f.ang += f.va;
    f.life -= 0.0015;
    if (f.y >= rimY) {           // 落入香爐 → 堆積
      ashPile = Math.min(1, ashPile + 0.05);
      for (let k = 0; k < 2; k++) {
        settledAsh.push({ dx: (Math.random() - 0.5) * (rim * 1.2), up: Math.random() * ashPile * 8, r: 1 + Math.random() * 1.4 });
      }
      if (settledAsh.length > 28) settledAsh.splice(0, settledAsh.length - 28);
      fallingAsh.splice(i, 1); continue;
    }
    if (f.life <= 0) { fallingAsh.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, f.life) * 0.85;
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
