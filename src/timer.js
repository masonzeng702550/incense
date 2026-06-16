// F5 / F6 — 燃香時間設定（手動滑桿 + 自動天氣推算 + localStorage）
import { store } from './store.js';
import { getBurnSeconds } from './weather.js';

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function initTimer() {
  const slider = document.getElementById('durSlider');
  const label = document.getElementById('durLabel');
  const auto = document.getElementById('autoTime');
  const eco = document.getElementById('ecoMode');
  const weatherInfo = document.getElementById('weatherInfo');

  // 還原設定
  const saved = Number(localStorage.getItem('duration'));
  const initMin = saved ? Math.round(saved / 60) : 10;
  slider.value = initMin;
  label.textContent = initMin;
  store.set({ duration: initMin * 60 });

  slider.addEventListener('input', () => {
    const min = Number(slider.value);
    label.textContent = min;
    auto.checked = false;
    store.set({ duration: min * 60, autoTime: false });
    localStorage.setItem('duration', min * 60);
  });

  auto.addEventListener('change', async () => {
    if (!auto.checked) { store.set({ autoTime: false }); weatherInfo.textContent = ''; return; }
    store.set({ autoTime: true });
    weatherInfo.textContent = '推算中…';
    const { seconds, temp, source } = await getBurnSeconds();
    store.set({ duration: seconds });
    slider.value = Math.round(seconds / 60);
    label.textContent = Math.round(seconds / 60);
    weatherInfo.textContent = source === 'weather'
      ? `目前 ${temp}°C，建議一炷香 ${fmt(seconds)}`
      : `無法取得天氣，採用預設 ${fmt(seconds)}`;
  });

  eco.addEventListener('change', () => store.set({ ecoMode: eco.checked }));

  // 燃香狀態文字 / 進度條
  const fill = document.getElementById('burnFill');
  const text = document.getElementById('burnText');
  store.subscribe((s) => {
    if (s.phase === 'burning') {
      fill.style.width = `${(s.burnedRatio * 100).toFixed(1)}%`;
      const left = Math.max(0, s.duration * (1 - s.burnedRatio));
      text.textContent = `一炷香 ${fmt(left)}`;
    } else if (s.phase === 'done') {
      fill.style.width = '100%';
      text.textContent = '一炷香已盡';
    }
  });
}
