// 平台與能力偵測
export const caps = {
  isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
  isIOS: /iPhone|iPad|iPod/i.test(navigator.userAgent),
  hasCamera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  hasNfc: 'NDEFReader' in window,
  hasOrientation: typeof DeviceOrientationEvent !== 'undefined',
  hasGeo: 'geolocation' in navigator,
};

export function applyBodyClasses() {
  const b = document.body.classList;
  b.toggle('is-mobile', caps.isMobile);
  b.toggle('is-desktop', !caps.isMobile);
  b.toggle('has-nfc', caps.hasNfc);
}
