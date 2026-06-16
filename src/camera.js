// F1 — AR 鏡頭背景（手機後鏡頭）
import { store } from './store.js';
import { caps } from './platform.js';

let stream = null;

export async function startCamera() {
  if (!caps.hasCamera) return false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    const video = document.getElementById('camera');
    video.srcObject = stream;
    await video.play();
    document.body.classList.add('camera-active');
    store.set({ cameraOn: true });
    return true;
  } catch (err) {
    console.warn('鏡頭啟動失敗，改用靜態背景：', err.message);
    document.body.classList.remove('camera-active');
    store.set({ cameraOn: false });
    return false;
  }
}

export function stopCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  document.body.classList.remove('camera-active');
  store.set({ cameraOn: false });
}
