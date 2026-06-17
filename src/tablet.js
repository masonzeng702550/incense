// 牌位模式：樣式、對象（祖先/寵物）、姓名/綽號、稱謂模板，設定存於 cookie
import { store } from './store.js';

const COOKIE = 'incense_tablet';
const STYLES = ['lotus', 'spirit', 'plain'];

const state = {
  on: false,
  style: 'lotus',
  kind: 'person',      // person | pet
  surname: '',
  given: '',
  template: 'wangsheng',
  petName: '',
  petTemplate: 'pet_wangsheng',
};

function saveCookie() {
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(state))}; path=/; max-age=31536000; samesite=lax`;
}
function loadCookie() {
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
  if (!m) return;
  try { Object.assign(state, JSON.parse(decodeURIComponent(m[1]))); } catch { /* ignore */ }
}

// → { cols: [由左到右的直書欄], suffix }
function content() {
  if (state.kind === 'pet') {
    const nm = state.petName.trim() || '○○';
    switch (state.petTemplate) {
      case 'pet_wangsheng': return { cols: [nm], suffix: '往生蓮位' };
      case 'pet_aichong': return { cols: ['愛寵' + nm], suffix: '之蓮位' };
      case 'pet_lingwei': return { cols: [nm], suffix: '之靈位' };
      default: return { cols: [nm], suffix: '' };
    }
  }
  const sur = state.surname.trim();
  const giv = state.given.trim();
  const full = (sur + giv) || '○○○';
  const surC = sur || '○';
  switch (state.template) {
    case 'wangsheng': return { cols: [`${surC}氏歷代`, full], suffix: '往生蓮位' };
    case 'lianwei': return { cols: [full], suffix: '之蓮位' };
    case 'lidai': return { cols: [`${surC}氏歷代祖先`], suffix: '之蓮位' };
    case 'lingwei': return { cols: [full], suffix: '之靈位' };
    default: return { cols: [full], suffix: '' };
  }
}

let els = {};

function apply() {
  document.body.classList.toggle('tablet-mode', state.on);
  store.set({ tabletMode: state.on });

  els.tablet.className = 'tablet tablet--' + state.style;

  const { cols, suffix } = content();
  els.cols.innerHTML = '';
  for (const text of cols) {
    const d = document.createElement('div');
    d.className = 'tablet__col';
    d.textContent = text;
    els.cols.appendChild(d);
  }
  els.suffix.textContent = suffix;
  els.suffix.hidden = !suffix;

  // 同步 UI
  els.toggle.checked = state.on;
  els.options.hidden = !state.on;
  els.surname.value = state.surname;
  els.given.value = state.given;
  els.template.value = state.template;
  els.petName.value = state.petName;
  els.petTemplate.value = state.petTemplate;
  els.personFields.hidden = state.kind !== 'person';
  els.petFields.hidden = state.kind !== 'pet';
  for (const b of els.styleBtns) b.classList.toggle('seg__btn--on', b.dataset.style === state.style);
  for (const b of els.kindBtns) b.classList.toggle('seg__btn--on', b.dataset.kind === state.kind);
}

export function initTablet() {
  loadCookie();
  if (!STYLES.includes(state.style)) state.style = 'lotus';

  els = {
    tablet: document.getElementById('tablet'),
    cols: document.getElementById('tabletCols'),
    suffix: document.getElementById('tabletSuffix'),
    toggle: document.getElementById('tabletMode'),
    options: document.getElementById('tabletOptions'),
    surname: document.getElementById('surname'),
    given: document.getElementById('givenName'),
    template: document.getElementById('tabletTemplate'),
    petName: document.getElementById('petName'),
    petTemplate: document.getElementById('petTemplate'),
    personFields: document.getElementById('personFields'),
    petFields: document.getElementById('petFields'),
    styleBtns: Array.from(document.querySelectorAll('#tabletStyles .seg__btn')),
    kindBtns: Array.from(document.querySelectorAll('#tabletKinds .seg__btn')),
  };

  const upd = () => { apply(); saveCookie(); };
  els.toggle.addEventListener('change', () => { state.on = els.toggle.checked; upd(); });
  els.surname.addEventListener('input', () => { state.surname = els.surname.value; upd(); });
  els.given.addEventListener('input', () => { state.given = els.given.value; upd(); });
  els.template.addEventListener('change', () => { state.template = els.template.value; upd(); });
  els.petName.addEventListener('input', () => { state.petName = els.petName.value; upd(); });
  els.petTemplate.addEventListener('change', () => { state.petTemplate = els.petTemplate.value; upd(); });
  for (const b of els.styleBtns) b.addEventListener('click', () => { state.style = b.dataset.style; upd(); });
  for (const b of els.kindBtns) b.addEventListener('click', () => { state.kind = b.dataset.kind; upd(); });

  apply();
}
