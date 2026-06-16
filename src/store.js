// 極簡全域狀態管理：set() 更新並通知訂閱者
const state = {
  phase: 'idle',        // idle | igniting | burning | done
  lit: false,
  startTime: 0,
  duration: 600,        // 秒
  burnedRatio: 0,       // 0~1
  cameraOn: false,
  tilt: { beta: 0, gamma: 0 },
  fastMove: false,
  autoTime: false,
  ecoMode: false,
  muted: false,
  jiaobei: { last: null, shengCount: 0 },
};

const listeners = new Set();

export const store = {
  get: () => state,
  set(patch) {
    Object.assign(state, patch);
    listeners.forEach((fn) => fn(state, patch));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
