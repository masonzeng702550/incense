// F9 — 擲筊：3D 月牙筊（CrescentMoon.stl，紅色霧面）；無 WebGL 時退回 2D 月牙。可點按鈕或向上甩動投擲
import { store } from './store.js';
import { sound } from './sound.js';
import * as j3d from './jiaobei3d.js';

const RESULTS = {
  sheng: { name: '聖筊', desc: '神明應允' },
  xiao: { name: '笑筊', desc: '神明微笑，請再問' },
  yin: { name: '陰筊', desc: '神明未允，宜三思' },
};

// a/b：true = 平面朝上（陽）；false = 凸面朝上（陰）
function decide(a, b) {
  if (a !== b) return 'sheng';
  return a ? 'xiao' : 'yin';
}

// 2D 退回用月牙筊
const TOP = 'M22 44 Q70 84 118 44 Q70 60 22 44 Z';
function cupSvg(s, id) {
  const cls = s === 'flat' ? 'cup--flat' : s === 'convex' ? 'cup--convex' : 'cup--roll';
  const label = s === 'flat' ? '陽' : s === 'convex' ? '陰' : '';
  const fill = s === 'flat' ? `url(#flat${id})` : `url(#dome${id})`;
  const spec = s === 'convex'
    ? '<ellipse class="cup-spec" cx="70" cy="51" rx="30" ry="6"/><ellipse class="cup-spec2" cx="57" cy="50" rx="9" ry="3"/>'
    : s === 'flat'
      ? '<path class="cup-flatsheen" d="M34 46 Q70 66 106 46 Q70 53 34 46 Z"/>'
      : '<ellipse class="cup-spec" cx="70" cy="51" rx="26" ry="5"/>';
  return `<svg class="cup-svg ${cls}" viewBox="0 0 140 104" aria-hidden="true">
    <defs>
      <radialGradient id="dome${id}" cx="50%" cy="34%" r="70%">
        <stop offset="0" stop-color="#f0958a"/><stop offset="42%" stop-color="#bd3b35"/><stop offset="100%" stop-color="#6c1111"/>
      </radialGradient>
      <linearGradient id="flat${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#9c2626"/><stop offset="100%" stop-color="#711515"/>
      </linearGradient>
    </defs>
    <ellipse class="cup-shadow" cx="70" cy="90" rx="46" ry="7"/>
    <path class="cup-edge" d="${TOP}" transform="translate(0,7)"/>
    <path class="cup-body" d="${TOP}" fill="${fill}"/>
    ${spec}
    <text class="cup-label" x="70" y="102">${label}</text>
  </svg>`;
}

let throwing = false;
let use3d = false;
let inited = false;

export function initJiaobei() {
  const openBtn = document.getElementById('jiaobeiBtn');
  const panel = document.getElementById('jiaobeiResult');
  const stage = panel.querySelector('.jiaobei-stage');
  const canvas = document.getElementById('jiaobeiCanvas');
  const cupsWrap = document.getElementById('jiaobeiCups');
  const cupA = document.getElementById('cupA');
  const cupB = document.getElementById('cupB');
  const text = document.getElementById('jiaobeiText');
  const throwBtn = document.getElementById('throwBtn');
  const closeBtn = document.getElementById('jiaobeiClose');

  function restSvg() {
    cupA.className = 'cup'; cupB.className = 'cup';
    cupA.innerHTML = cupSvg('flat', 'a'); cupB.innerHTML = cupSvg('convex', 'b');
  }

  async function open() {
    panel.hidden = false;
    if (!inited) { inited = true; use3d = await j3d.ensure3d(canvas); }
    if (use3d) {
      canvas.hidden = false; cupsWrap.hidden = true;
      j3d.resize(canvas); j3d.settle(true, false);
    } else {
      canvas.hidden = true; cupsWrap.hidden = false;
      restSvg();
    }
    text.textContent = '擲筊請示';
  }

  function impact() {
    stage.classList.add('impact');
    if (navigator.vibrate) { try { navigator.vibrate(35); } catch { /* */ } }
    setTimeout(() => stage.classList.remove('impact'), 280);
  }

  function doThrow() {
    if (throwing) return;
    throwing = true;
    text.textContent = '擲筊中…';
    sound.jiaobei();
    const a = Math.random() < 0.5;
    const b = Math.random() < 0.5;
    const key = decide(a, b);
    setTimeout(impact, 560);

    const finish = () => {
      const prev = store.get().jiaobei.shengCount;
      const next = key === 'sheng' ? prev + 1 : 0;
      store.set({ jiaobei: { last: key, shengCount: next } });
      text.textContent = `${RESULTS[key].name}　${RESULTS[key].desc}`
        + (next >= 3 ? '（連續三聖筊）' : next > 0 ? `（聖筊 ${next}/3）` : '');
      throwing = false;
    };

    if (use3d) {
      j3d.throwAnim(a, b, finish);
    } else {
      cupA.className = 'cup throwing'; cupB.className = 'cup throwing';
      cupA.innerHTML = cupSvg('roll', 'a'); cupB.innerHTML = cupSvg('roll', 'b');
      setTimeout(() => {
        cupA.className = 'cup'; cupB.className = 'cup';
        cupA.innerHTML = cupSvg(a ? 'flat' : 'convex', 'a');
        cupB.innerHTML = cupSvg(b ? 'flat' : 'convex', 'b');
        finish();
      }, 820);
    }
  }

  openBtn.addEventListener('click', open);
  throwBtn.addEventListener('click', doThrow);
  closeBtn.addEventListener('click', () => { panel.hidden = true; });

  // 向上甩動投擲；輕點空白處關閉
  let sy = null, st = 0, moved = false;
  panel.addEventListener('pointerdown', (e) => { sy = e.clientY; st = performance.now(); moved = false; });
  panel.addEventListener('pointermove', (e) => { if (sy !== null && Math.abs(e.clientY - sy) > 12) moved = true; });
  panel.addEventListener('pointerup', (e) => {
    if (sy === null) return;
    const dy = e.clientY - sy; const dt = performance.now() - st;
    sy = null;
    if (dy < -45 && dt < 600) { doThrow(); return; }
    if (!moved && (e.target === panel || e.target === stage)) panel.hidden = true;
  });
}
