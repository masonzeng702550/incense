import { defineConfig } from 'vite';

// GitHub Pages 子路徑：https://<user>.github.io/incense/
// 部署到其他路徑時改這裡，或用環境變數 BASE。
export default defineConfig({
  base: process.env.BASE || '/incense/',
  build: {
    target: 'es2018',
    outDir: 'dist',
  },
  server: {
    host: true, // 方便手機在同網段測試
  },
});
