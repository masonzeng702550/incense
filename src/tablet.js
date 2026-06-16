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

// --- cookie ---
function saveCookie() {
  const val = encodeURIComponent(JSON.stringify(state));
  // 一年有效
  document.cookie = `${COOKIE}=${val}; path=/; max-age=31536000; samesite=lax`;
}
function loadCookie() {
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
  if (!m) return;
  try {
    const o = JSON.parse(decodeURIComponent(m[1]));
    Object.assign(state, o);
  } catch { /* ignore */ }
}

// 依名字 + 模板組出牌位文字
function formatText(name, template) {
  const n = (name || '').trim() || '○○○';
  const surname = n[0] || '○';
  switch (template) {
    case 'wangsheng': return `${n}　往生蓮位`;
    case 'full': return `${n}　${surname}氏歷代　往生蓮位`;
    case 'lidai': return `${surname}氏歷代祖先`;
    case 'lianwei': return `${n}　之蓮位`;
    case 'lingwei': return `${n}　之靈位`;
    default: return n;
  }
}

let els = {};

function apply() {
  document.body.classList.toggle('tablet-mode', state.on);
  store.set({ tabletMode: state.on });

  const tablet = els.tablet;
  tablet.className = 'tablet tablet--' + state.style;
  els.text.textContent = formatText(state.name, state.template);

  // 同步 UI
  els.toggle.checked = state.on;
  els.options.hidden = !state.on;
  els.name.value = state.name;
  els.template.value = state.template;
  for (const b of els.styleBtns) {
    b.classList.toggle('seg__btn--on', b.dataset.style === state.style);
  }
}

export function initTablet() {
  loadCookie();
  if (!STYLES.includes(state.style)) state.style = 'lotus';

  els = {
    tablet: document.getElementById('tablet'),
    text: document.getElementById('tabletText'),
    toggle: document.getElementById('tabletMode'),
    options: document.getElementById('tabletOptions'),
    name: document.getElementById('ancestorName'),
    template: document.getElementById('tabletTemplate'),
    styleBtns: Array.from(document.querySelectorAll('#tabletStyles .seg__btn')),
  };

  els.toggle.addEventListener('change', () => { state.on = els.toggle.checked; apply(); saveCookie(); });
  els.name.addEventListener('input', () => { state.name = els.name.value; apply(); saveCookie(); });
  els.template.addEventListener('change', () => { state.template = els.template.value; apply(); saveCookie(); });
  for (const b of els.styleBtns) {
    b.addEventListener('click', () => { state.style = b.dataset.style; apply(); saveCookie(); });
  }

  apply();
}
