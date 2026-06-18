// 早晚拜拜提醒：到設定時間以通知推播提醒上香（設定存 localStorage）
const KEY = 'reminder';
const DEFAULT = { on: false, morning: '06:00', evening: '18:00', firedM: '', firedE: '' };

function load() {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULT }; }
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

const state = load();
let intervalId = null;
let els = {};

function nowHM() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function fire(slot) {
  const title = '上香時刻到了';
  const opts = {
    body: `${slot}・該為神明與祖先上一炷香了`,
    icon: `${import.meta.env.BASE_URL}assets/icons/icon.svg`,
    badge: `${import.meta.env.BASE_URL}assets/icons/icon.svg`,
    tag: 'incense-reminder',
    renotify: true,
  };
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, opts))
      .catch(() => { try { new Notification(title, opts); } catch { /* */ } });
  } else {
    try { new Notification(title, opts); } catch { /* */ }
  }
}

function check() {
  if (!state.on || !('Notification' in window) || Notification.permission !== 'granted') return;
  const hm = nowHM();
  const today = todayStr();
  if (hm === state.morning && state.firedM !== today) { state.firedM = today; save(); fire('早課'); }
  if (hm === state.evening && state.firedE !== today) { state.firedE = today; save(); fire('晚課'); }
}

function startScheduler() {
  if (intervalId) return;
  check();
  intervalId = setInterval(check, 30000);
}
function stopScheduler() { clearInterval(intervalId); intervalId = null; }

async function ensurePermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try { return (await Notification.requestPermission()) === 'granted'; }
  catch { return false; }
}

function syncUI() {
  els.on.checked = state.on;
  els.fields.hidden = !state.on;
  els.morning.value = state.morning;
  els.evening.value = state.evening;
  if (state.on && 'Notification' in window && Notification.permission === 'denied') {
    els.note.textContent = '通知權限被拒，請至瀏覽器設定開啟通知後再試。';
  } else {
    els.note.textContent = '需允許通知；App 開啟或在背景執行時才會準時提醒（iOS 需先「加入主畫面」）。';
  }
}

export function initReminder() {
  els = {
    on: document.getElementById('reminderOn'),
    fields: document.getElementById('reminderFields'),
    morning: document.getElementById('reminderMorning'),
    evening: document.getElementById('reminderEvening'),
    note: document.getElementById('reminderNote'),
  };

  els.on.addEventListener('change', async () => {
    if (els.on.checked) {
      const ok = await ensurePermission();
      state.on = ok;
      els.on.checked = ok;
      if (ok) startScheduler();
    } else {
      state.on = false;
      stopScheduler();
    }
    save(); syncUI();
  });
  els.morning.addEventListener('change', () => { state.morning = els.morning.value || '06:00'; state.firedM = ''; save(); });
  els.evening.addEventListener('change', () => { state.evening = els.evening.value || '18:00'; state.firedE = ''; save(); });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });

  syncUI();
  if (state.on) startScheduler();
}
