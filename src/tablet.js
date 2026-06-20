// 牌位模式：樣式、對象（祖先/寵物）、姓名/綽號、稱謂模板，並可存多筆牌位，全存於 cookie
import { store } from './store.js';

const COOKIE = 'incense_tablet';
const STYLES = ['lotus', 'spirit', 'plain'];

function blankCurrent() {
  return { style: 'lotus', kind: 'person', surname: '', given: '', template: 'wangsheng', petName: '', petTemplate: 'pet_wangsheng' };
}

const state = {
  on: false,
  current: blankCurrent(),
  saved: [],
};

function saveCookie() {
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(state))}; path=/; max-age=31536000; samesite=lax`;
}
function loadCookie() {
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
  if (!m) return;
  try {
    const o = JSON.parse(decodeURIComponent(m[1]));
    if (typeof o.on === 'boolean') state.on = o.on;
    if (o.current) state.current = { ...blankCurrent(), ...o.current };
    if (Array.isArray(o.saved)) state.saved = o.saved;
    // 相容舊格式（單一牌位）
    else if (o.style || o.surname || o.name) state.current = { ...blankCurrent(), ...o };
  } catch { /* ignore */ }
  if (!STYLES.includes(state.current.style)) state.current.style = 'lotus';
}

// 設定 → { cols: [由左到右的直書欄], suffix }
// → { main: 置中名諱欄, lineage: 左側歷代註記, suffix: 下方蓮位 }
function content(c) {
  if (c.kind === 'pet') {
    const nm = (c.petName || '').trim() || '○○';
    switch (c.petTemplate) {
      case 'pet_wangsheng': return { main: nm, lineage: '', suffix: '往生蓮位' };
      case 'pet_aichong': return { main: '愛寵' + nm, lineage: '', suffix: '之蓮位' };
      case 'pet_lingwei': return { main: nm, lineage: '', suffix: '之靈位' };
      default: return { main: nm, lineage: '', suffix: '' };
    }
  }
  const sur = (c.surname || '').trim();
  const giv = (c.given || '').trim();
  const full = (sur + giv) || '○○○';
  const surC = sur || '○';
  switch (c.template) {
    case 'wangsheng': return { main: full, lineage: `${surC}氏歷代`, suffix: '往生蓮位' };
    case 'lianwei': return { main: full, lineage: '', suffix: '之蓮位' };
    case 'lidai': return { main: `${surC}氏歷代祖先`, lineage: '', suffix: '之蓮位' };
    case 'lingwei': return { main: full, lineage: '', suffix: '之靈位' };
    default: return { main: full, lineage: '', suffix: '' };
  }
}

function label(c) {
  if (c.kind === 'pet') return (c.petName || '').trim() || '寵物';
  return ((c.surname || '') + (c.given || '')).trim() || '未命名';
}

let els = {};

function renderSavedList() {
  els.saved.innerHTML = '';
  if (!state.saved.length) {
    const p = document.createElement('p');
    p.className = 'saved-empty';
    p.textContent = '尚無已存牌位';
    els.saved.appendChild(p);
    return;
  }
  for (const cfg of state.saved) {
    const row = document.createElement('div');
    row.className = 'saved-row';
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'saved-pick';
    pick.textContent = label(cfg);
    pick.addEventListener('click', () => { state.current = { ...blankCurrent(), ...cfg }; delete state.current.id; apply(); saveCookie(); });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'saved-del';
    del.setAttribute('aria-label', '刪除');
    del.textContent = '刪除';
    del.addEventListener('click', () => { state.saved = state.saved.filter((x) => x.id !== cfg.id); apply(); saveCookie(); });
    row.append(pick, del);
    els.saved.appendChild(row);
  }
}

function apply() {
  const c = state.current;
  document.body.classList.toggle('tablet-mode', state.on);
  store.set({ tabletMode: state.on });

  els.tablet.className = 'tablet tablet--' + c.style;
  const { main, lineage, suffix } = content(c);
  els.cols.innerHTML = '';   // .tablet__cols 本身即兩列字群組（flex row，絕對置中）
  if (lineage) {
    const ln = document.createElement('div');
    ln.className = 'tablet__col tablet__lineage';
    ln.textContent = lineage;
    els.cols.appendChild(ln);
  }
  const nm = document.createElement('div');
  nm.className = 'tablet__col tablet__name';
  nm.textContent = main;
  els.cols.appendChild(nm);
  els.suffix.textContent = suffix;
  els.suffix.hidden = !suffix;

  // 同步編輯 UI
  els.toggle.checked = state.on;
  els.options.hidden = !state.on;
  els.surname.value = c.surname;
  els.given.value = c.given;
  els.template.value = c.template;
  els.petName.value = c.petName;
  els.petTemplate.value = c.petTemplate;
  els.personFields.hidden = c.kind !== 'person';
  els.petFields.hidden = c.kind !== 'pet';
  for (const b of els.styleBtns) b.classList.toggle('seg__btn--on', b.dataset.style === c.style);
  for (const b of els.kindBtns) b.classList.toggle('seg__btn--on', b.dataset.kind === c.kind);
  renderSavedList();
}

export function initTablet() {
  loadCookie();

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
    saved: document.getElementById('savedTablets'),
    saveBtn: document.getElementById('saveTablet'),
  };

  const upd = () => { apply(); saveCookie(); };
  const c = () => state.current;
  els.toggle.addEventListener('change', () => { state.on = els.toggle.checked; upd(); });
  els.surname.addEventListener('input', () => { c().surname = els.surname.value; upd(); });
  els.given.addEventListener('input', () => { c().given = els.given.value; upd(); });
  els.template.addEventListener('change', () => { c().template = els.template.value; upd(); });
  els.petName.addEventListener('input', () => { c().petName = els.petName.value; upd(); });
  els.petTemplate.addEventListener('change', () => { c().petTemplate = els.petTemplate.value; upd(); });
  for (const b of els.styleBtns) b.addEventListener('click', () => { c().style = b.dataset.style; upd(); });
  for (const b of els.kindBtns) b.addEventListener('click', () => { c().kind = b.dataset.kind; upd(); });

  els.saveBtn.addEventListener('click', () => {
    const id = 'tb' + Date.now() + Math.floor(Math.random() * 1000);
    state.saved.push({ ...state.current, id });
    upd();
  });

  apply();
}
