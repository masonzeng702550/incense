// 極簡全域狀態管理：set() 更新並通知訂閱者
const state = {
  phase: 'idle',        // idle | igniting | burning | done
  lit: false,
  igniting: false,      // 打火機點火動畫進行中
  startTime: 0,
  duration: 600,        // 秒
  burnedRatio: 0,       // 0~1
  cameraOn: false,
  motionEnabled: false, // 動態效果（陀螺儀）是否啟用
  tilt: { beta: 0, gamma: 0 },
  fastMove: false,
  autoTime: false,
  ecoMode: false,
  muted: false,
  tabletMode: false,    // 牌位模式
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
