// F5 — 季節 / 溫度 → 燃香時間（Open-Meteo，免金鑰）
import { caps } from './platform.js';

const DEFAULT_SECONDS = 600; // 預設 10 分鐘
const BASE = 600;

function getGeo() {
  return new Promise((resolve, reject) => {
    if (!caps.hasGeo) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      reject,
      { timeout: 8000, maximumAge: 600000 },
    );
  });
}

function calcBurn(temp, month0) {
  const m = month0 + 1;
  const season = [12, 1, 2].includes(m) ? 1.2 : [6, 7, 8].includes(m) ? 0.8 : 1.0;
  const tempFactor = 1 - (temp - 20) / 100;
  const clamped = Math.max(0.5, Math.min(1.5, tempFactor));
  return Math.round(BASE * season * clamped);
}

// 回傳 { seconds, temp, source }
export async function getBurnSeconds() {
  try {
    const { latitude, longitude } = await getGeo();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m`;
    const res = await fetch(url);
    const data = await res.json();
    const temp = data.current.temperature_2m;
    return { seconds: calcBurn(temp, new Date().getMonth()), temp, source: 'weather' };
  } catch (err) {
    console.warn('天氣推算失敗，採用預設：', err.message);
    return { seconds: DEFAULT_SECONDS, temp: null, source: 'default' };
  }
}
