// F9 — 擲筊
import { store } from './store.js';
import { sound } from './sound.js';

const RESULTS = {
  sheng: { name: '聖筊', desc: '神明應允 ✅' },
  xiao: { name: '笑筊', desc: '神明微笑，請再問 🙂' },
  yin: { name: '陰筊', desc: '神明未允，宜三思 🙏' },
};

// a/b：true = 正面（平面朝上）
function decide(a, b) {
  if (a !== b) return 'sheng';
  return a ? 'xiao' : 'yin';
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
    sound.jiaobei();

    setTimeout(() => {
      const a = Math.random() < 0.5;
      const b = Math.random() < 0.5;
      const key = decide(a, b);
      cupA.className = 'cup' + (a ? ' up' : '');
      cupB.className = 'cup' + (b ? ' up' : '');
      const sheng = store.get().jiaobei.shengCount;
      const next = key === 'sheng' ? sheng + 1 : 0;
      store.set({ jiaobei: { last: key, shengCount: next } });
      text.textContent = `${RESULTS[key].name}：${RESULTS[key].desc}`
        + (next >= 3 ? '（連續三聖筊！）' : next > 0 ? `（聖筊 ${next}/3）` : '');
    }, 650);
  });

  // 點背景關閉
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.hidden = true;
  });
}
