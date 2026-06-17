import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// build 後把 dist 內所有產出檔（含帶 hash 的 JS/CSS）注入 Service Worker 預快取，
// 讓 PWA 安裝後即可完整離線運作。
function swPrecache() {
  return {
    name: 'sw-precache',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(process.env.OUTDIR || 'dist');
      const swPath = path.join(dist, 'service-worker.js');
      if (!fs.existsSync(swPath)) return;
      const files = [];
      const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          if (fs.statSync(full).isDirectory()) { walk(full); continue; }
          if (name === 'service-worker.js' || name === '.nojekyll') continue;
          files.push('./' + path.relative(dist, full).split(path.sep).join('/'));
        }
      };
      walk(dist);
      const list = ['./', ...files];
      const sw = fs.readFileSync(swPath, 'utf8');
      fs.writeFileSync(swPath, `self.__PRECACHE__ = ${JSON.stringify(list)};\n${sw}`);
    },
  };
}

export default defineConfig({
  base: process.env.BASE || '/incense/',
  plugins: [swPrecache()],
  build: {
    target: 'es2018',
    outDir: 'dist',
  },
  server: {
    host: true,
  },
});
