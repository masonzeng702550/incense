// F7 / F8 — 煙霧：從火星升起的連貫細縷，邊上升邊蛇行擺動、漸淡擴散
import { store } from './store.js';
import { caps } from './platform.js';

const MOTION_THRESHOLD = 18; // 加速度閾值（m/s²）觸發殘影
const particles = [];
let emberX = 0; // 升流起點（火星 x）

// 在使用者手勢中呼叫（iOS 需明確授權）
export async function enableTilt() {
  if (!caps.hasOrientation) return false;
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') return false;
    }
    window.addEventListener('deviceorientation', (e) => {
      store.set({ tilt: { beta: e.beta || 0, gamma: e.gamma || 0 } });
    });
    if (typeof DeviceMotionEvent !== 'undefined') {
      window.addEventListener('devicemotion', (e) => {
        const a = e.acceleration || {};
        const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
        store.set({ fastMove: mag > MOTION_THRESHOLD });
      });
    }
    return true;
  } catch {
    return false;
  }
}

// 手機左右傾角 → 升流的橫向偏移。
// 取負號：手機向右轉時，煙相對螢幕往左偏，使其維持朝真實世界上方。
function tiltLean() {
  return -Math.sin((store.get().tilt.gamma || 0) * (Math.PI / 180)) * 0.5;
}

export function spawnSmoke(x, y) {
  emberX = x;
  const eco = store.get().ecoMode;
  if (Math.random() > (eco ? 0.4 : 0.7)) return;
  particles.push({
    startY: y,
    y,
    life: 0,
    maxLife: (eco ? 90 : 130) + Math.random() * 50,
    speed: 0.85 + Math.random() * 0.35,
    seed: Math.random() * Math.PI * 2,
    jitter: (Math.random() - 0.5) * 2.4,
  });
}

export function renderSmoke(ctx, w, h) {
  const lean = tiltLean();
  const now = performance.now();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life++;
    if (p.life > p.maxLife) { particles.splice(i, 1); continue; }

    p.y -= p.speed;                 // 上升
    const rise = p.startY - p.y;    // 已上升高度
    const t = p.life / p.maxLife;

    // 共用的行進波：相鄰粒子形成連貫蛇行的煙縷（而非直線）
    const amp = 2 + rise * 0.10;    // 越高擺幅越大
    const phase = now * 0.0016 - rise * 0.05 + p.seed * 0.25;
    const x = emberX + lean * rise + Math.sin(phase) * amp + p.jitter;

    const r = 1.6 + t * 3.4;        // 收斂尺寸（最大 ~5），不再過大
    const alpha = Math.sin(t * Math.PI) * 0.13;

    const grad = ctx.createRadialGradient(x, p.y, 0, x, p.y, r);
    grad.addColorStop(0, `rgba(216,210,198,${alpha})`);
    grad.addColorStop(1, 'rgba(216,210,198,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function clearSmoke() { particles.length = 0; }
