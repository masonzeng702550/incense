// F9 — 擲筊（紅漆月牙形筊杯：一面平=陽、一面凸=陰）；可點按鈕或向上甩動投擲
import { store } from './store.js';
import { sound } from './sound.js';

const RESULTS = {
  sheng: { name: '聖筊', desc: '神明應允' },
  xiao: { name: '笑筊', desc: '神明微笑，請再問' },
  yin: { name: '陰筊', desc: '神明未允，宜三思' },
};

// a/b：true = 平面朝上（陽）；false = 凸面朝上（陰）
function decide(a, b) {
  if (a !== b) return 'sheng';   // 一陰一陽
  return a ? 'xiao' : 'yin';     // 兩陽=笑筊；兩陰=陰筊
}

// 月牙形筊杯。state: 'flat'(陽) | 'convex'(陰) | 'roll'(翻滾中)
function cupSvg(s) {
  const cls = s === 'flat' ? 'cup--flat' : s === 'convex' ? 'cup--convex' : 'cup--roll';
  const label = s === 'flat' ? '陽' : s === 'convex' ? '陰' : '';
  return `<svg class="cup-svg ${cls}" viewBox="0 0 130 88" aria-hidden="true">
    <ellipse class="cup-shadow" cx="65" cy="72" rx="42" ry="6"/>
    <path class="cup-body" d="M20 38 Q65 74 110 38 Q65 53 20 38 Z"/>
    <path class="cup-hi" d="M33 40 Q65 61 97 40 Q65 47 33 40 Z"/>
    <text class="cup-label" x="65" y="86">${label}</text>
  </svg>`;
}

let throwing = false;

export function initJiaobei() {
  const openBtn = document.getElementById('jiaobeiBtn');
  const panel = document.getElementById('jiaobeiResult');
  const stage = panel.querySelector('.jiaobei-stage');
  const cupA = document.getElementById('cupA');
  const cupB = document.getElementById('cupB');
  const text = document.getElementById('jiaobeiText');
  const throwBtn = document.getElementById('throwBtn');
  const closeBtn = document.getElementById('jiaobeiClose');

  function rest() {
    cupA.className = 'cup'; cupB.className = 'cup';
    cupA.innerHTML = cupSvg('flat'); cupB.innerHTML = cupSvg('convex');
    text.textContent = '擲筊請示';
  }

  function open() {
    panel.hidden = false;
    rest();
  }

  function doThrow() {
    if (throwing) return;
    throwing = true;
    text.textContent = '擲筊中…';
    cupA.className = 'cup rolling'; cupB.className = 'cup rolling';
    cupA.innerHTML = cupSvg('roll'); cupB.innerHTML = cupSvg('roll');
    sound.jiaobei();

    setTimeout(() => {
      const a = Math.random() < 0.5;
      const b = Math.random() < 0.5;
      const key = decide(a, b);
      cupA.className = 'cup'; cupB.className = 'cup';
      cupA.innerHTML = cupSvg(a ? 'flat' : 'convex');
      cupB.innerHTML = cupSvg(b ? 'flat' : 'convex');
      const prev = store.get().jiaobei.shengCount;
      const next = key === 'sheng' ? prev + 1 : 0;
      store.set({ jiaobei: { last: key, shengCount: next } });
      text.textContent = `${RESULTS[key].name}　${RESULTS[key].desc}`
        + (next >= 3 ? '（連續三聖筊）' : next > 0 ? `（聖筊 ${next}/3）` : '');
      throwing = false;
    }, 750);
  }

  openBtn.addEventListener('click', open);
  throwBtn.addEventListener('click', doThrow);
  closeBtn.addEventListener('click', () => { panel.hidden = true; });

  // 向上甩動投擲（像丟寶可夢球）；輕點空白處關閉
  let sy = null, st = 0, moved = false;
  const onDown = (y) => { sy = y; st = performance.now(); moved = false; };
  const onMove = (y) => { if (sy !== null && Math.abs(y - sy) > 12) moved = true; };
  const onUp = (y, target) => {
    if (sy === null) return;
    const dy = y - sy; const dt = performance.now() - st;
    sy = null;
    if (dy < -45 && dt < 600) { doThrow(); return; }     // 向上甩 → 擲筊
    if (!moved && (target === panel || target === stage)) panel.hidden = true; // 點空白關閉
  };
  panel.addEventListener('pointerdown', (e) => onDown(e.clientY));
  panel.addEventListener('pointermove', (e) => onMove(e.clientY));
  panel.addEventListener('pointerup', (e) => onUp(e.clientY, e.target));
}
