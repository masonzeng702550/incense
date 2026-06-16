// F7 / F8 — 煙霧粒子系統（陀螺儀方向 + 殘影）
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

export function spawnSmoke(x, y) {
  const eco = store.get().ecoMode;
  if (Math.random() > (eco ? 0.4 : 0.8)) return;
  particles.push({
    x: x + (Math.random() - 0.5) * 8,
    y,
    speed: 0.5 + Math.random() * 0.7,
    size: 8 + Math.random() * 10,
    life: 1,
    decay: 0.004 + Math.random() * 0.004,
    drift: (Math.random() - 0.5) * 0.4,
  });
}

// 依手機左右傾角 gamma，讓「上升方向」偏向真實世界上方
function upVector() {
  const g = (store.get().tilt.gamma || 0) * (Math.PI / 180);
  return { x: Math.sin(g), y: -Math.cos(g) };
}

export function renderSmoke(ctx, w, h) {
  const up = upVector();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += up.x * p.speed + p.drift;
    p.y += up.y * p.speed;
    p.size += 0.3;
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life * 0.4;
    ctx.fillStyle = '#d8d2c8';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function clearSmoke() { particles.length = 0; }
