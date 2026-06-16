// F3 — NFC 點香
// 方案 A：NFC 貼紙存網址 ?action=lighter（iOS+Android 通用，由系統原生開站）
// 方案 B：Web NFC 主動掃描（Android Chrome 限定）
import { caps } from './platform.js';

// 方案 A：解析 query string
export function getNfcAction() {
  const p = new URLSearchParams(location.search);
  return p.get('action'); // 'lighter' | null
}

// 方案 B：App 內主動掃描
export async function scanNfc(onLighter) {
  if (!caps.hasNfc) return false;
  try {
    const reader = new NDEFReader();
    await reader.scan();
    reader.onreading = () => onLighter();
    return true;
  } catch (err) {
    console.warn('Web NFC 掃描不可用：', err.message);
    return false;
  }
}
