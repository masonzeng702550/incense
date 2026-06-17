// 牌位模式：樣式選擇、祖先名字、稱謂模板，設定存於 cookie
import { store } from './store.js';

const COOKIE = 'incense_tablet';
const STYLES = ['lotus', 'spirit', 'plain'];

const state = {
  on: false,
  style: 'lotus',
  name: '',
  template: 'wangsheng',
};

function saveCookie() {
  const val = encodeURIComponent(JSON.stringify(state));
  document.cookie = `${COOKIE}=${val}; path=/; max-age=31536000; samesite=lax`;
}
function loadCookie() {
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
  if (!m) return;
  try { Object.assign(state, JSON.parse(decodeURIComponent(m[1]))); } catch { /* ignore */ }
}

// 名字 + 模板 → 牌位三部分（名諱欄、歷代欄、結尾蓮位）
function parts(name, template) {
  const n = (name || '').trim() || '○○○';
  const surname = n[0] || '○';
  switch (template) {
    case 'wangsheng': return { name: n, lineage: `${surname}氏歷代`, suffix: '往生蓮位' };
    case 'lianwei': return { name: n, lineage: '', suffix: '之蓮位' };
    case 'lidai': return { name: '', lineage: `${surname}氏歷代祖先`, suffix: '之蓮位' };
    case 'lingwei': return { name: n, lineage: '', suffix: '之靈位' };
    default: return { name: n, lineage: '', suffix: '' };
  }
}

let els = {};

function setText(el, txt) { el.textContent = txt; el.hidden = !txt; }

function apply() {
  document.body.classList.toggle('tablet-mode', state.on);
  store.set({ tabletMode: state.on });

  els.tablet.className = 'tablet tablet--' + state.style;
  const p = parts(state.name, state.template);
  setText(els.name, p.name);
  setText(els.lineage, p.lineage);
  setText(els.suffix, p.suffix);

  els.toggle.checked = state.on;
  els.options.hidden = !state.on;
  els.nameInput.value = state.name;
  els.template.value = state.template;
  for (const b of els.styleBtns) b.classList.toggle('seg__btn--on', b.dataset.style === state.style);
}

export function initTablet() {
  loadCookie();
  if (!STYLES.includes(state.style)) state.style = 'lotus';

  els = {
    tablet: document.getElementById('tablet'),
    name: document.getElementById('tabletName'),
    lineage: document.getElementById('tabletLineage'),
    suffix: document.getElementById('tabletSuffix'),
    toggle: document.getElementById('tabletMode'),
    options: document.getElementById('tabletOptions'),
    nameInput: document.getElementById('ancestorName'),
    template: document.getElementById('tabletTemplate'),
    styleBtns: Array.from(document.querySelectorAll('#tabletStyles .seg__btn')),
  };

  els.toggle.addEventListener('change', () => { state.on = els.toggle.checked; apply(); saveCookie(); });
  els.nameInput.addEventListener('input', () => { state.name = els.nameInput.value; apply(); saveCookie(); });
  els.template.addEventListener('change', () => { state.template = els.template.value; apply(); saveCookie(); });
  for (const b of els.styleBtns) {
    b.addEventListener('click', () => { state.style = b.dataset.style; apply(); saveCookie(); });
  }

  apply();
}
