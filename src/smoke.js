// F7 / F8 — 煙霧粒子（細縷上升、左右搖擺、隨高度變淡擴散）
import { store } from './store.js';
import { caps } from './platform.js';

const MOTION_THRESHOLD = 18; // 加速度閾值（m/s²）觸發殘影
const particles = [];

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

// 依手機左右傾角 gamma，讓上升方向偏向真實世界上方
function upVector() {
  const g = (store.get().tilt.gamma || 0) * (Math.PI / 180);
  return { x: Math.sin(g) * 0.6, y: -Math.cos(g) };
}

export function spawnSmoke(x, y) {
  const eco = store.get().ecoMode;
  if (Math.random() > (eco ? 0.3 : 0.55)) return;
  particles.push({
    cx: x + (Math.random() - 0.5) * 2, // 升流中軸
    y,
    age: 0,
    maxAge: (eco ? 120 : 170) + Math.random() * 60,
    speed: 0.75 + Math.random() * 0.4,
    phase: Math.random() * Math.PI * 2,
    sway: 7 + Math.random() * 12,    // 上升時的橫向擺幅
    size: 1.6 + Math.random() * 1.4,
  });
}

export function renderSmoke(ctx, w, h) {
  const up = upVector();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age++;
    if (p.age > p.maxAge) { particles.splice(i, 1); continue; }

    const t = p.age / p.maxAge;
    p.cx += up.x * p.speed;
    p.y += up.y * p.speed;

    // 越往上擺幅越大、煙越散
    const x = p.cx + Math.sin(p.age * 0.07 + p.phase) * p.sway * t;
    const r = p.size + t * 9;
    const alpha = Math.sin(t * Math.PI) * 0.16; // 升起時淡入、消散時淡出

    const grad = ctx.createRadialGradient(x, p.y, 0, x, p.y, r);
    grad.addColorStop(0, `rgba(214,209,198,${alpha})`);
    grad.addColorStop(1, 'rgba(214,209,198,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function clearSmoke() { particles.length = 0; }
