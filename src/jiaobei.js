// F9 — 擲筊（筊杯：一面平、一面凸的月牙形紅漆木塊）
import { store } from './store.js';
import { sound } from './sound.js';

const RESULTS = {
  sheng: { name: '聖筊', desc: '神明應允' },
  xiao: { name: '笑筊', desc: '神明微笑，請再問' },
  yin: { name: '陰筊', desc: '神明未允，宜三思' },
};

// a/b：true = 平面朝上（陽）；false = 凸面朝上（陰）
function decide(a, b) {
  if (a !== b) return 'sheng'; // 一陰一陽
  return a ? 'xiao' : 'yin';   // 兩陽=笑筊；兩陰=陰筊
}

// 畫一只筊杯。flatUp: 平面朝上 / 凸面朝上 / null=擲筊中
function cupSvg(flatUp) {
  let face;
  let label = '';
  if (flatUp === null) {
    // 滾動中：側立月牙
    face = '<path class="cup-face" d="M30,12 A48,48 0 0 1 30,68 A30,48 0 0 0 30,12 Z"/>';
  } else if (flatUp) {
    // 平面朝上（陽）：上緣平直，下緣隆起
    face = '<path class="cup-face" d="M14,30 A52,40 0 0 0 106,30 Z"/>'
      + '<ellipse class="cup-shine" cx="46" cy="44" rx="18" ry="7"/>';
    label = '<text class="jiaobei-label" x="60" y="74">陽</text>';
  } else {
    // 凸面朝上（陰）：上緣隆起，下緣平直
    face = '<path class="cup-face" d="M14,52 A52,40 0 0 1 106,52 Z"/>'
      + '<ellipse class="cup-shine" cx="46" cy="34" rx="18" ry="6"/>';
    label = '<text class="jiaobei-label" x="60" y="74">陰</text>';
  }
  return `<svg viewBox="0 0 120 80">
    <ellipse class="cup-shadow" cx="60" cy="76" rx="40" ry="5"/>
    ${face}${label}
  </svg>`;
}

export function initJiaobei() {
  const btn = document.getElementById('jiaobeiBtn');
  const panel = document.getElementById('jiaobeiResult');
  const cupA = document.getElementById('cupA');
  const cupB = document.getElementById('cupB');
  const text = document.getElementById('jiaobeiText');

  btn.addEventListener('click', () => {
    panel.hidden = false;
    text.textContent = '擲筊中…';
    cupA.className = 'cup rolling';
    cupB.className = 'cup rolling';
    cupA.innerHTML = cupSvg(null);
    cupB.innerHTML = cupSvg(null);
    sound.jiaobei();

    setTimeout(() => {
      const a = Math.random() < 0.5;
      const b = Math.random() < 0.5;
      const key = decide(a, b);
      cupA.className = 'cup';
      cupB.className = 'cup';
      cupA.innerHTML = cupSvg(a);
      cupB.innerHTML = cupSvg(b);
      const sheng = store.get().jiaobei.shengCount;
      const next = key === 'sheng' ? sheng + 1 : 0;
      store.set({ jiaobei: { last: key, shengCount: next } });
      text.textContent = `${RESULTS[key].name}　${RESULTS[key].desc}`
        + (next >= 3 ? '（連續三聖筊）' : next > 0 ? `（聖筊 ${next}/3）` : '');
    }, 650);
  });

  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.hidden = true;
  });
}
