# 環保電子香 Eco e-Incense 🪔

無煙・無火・零空汙的數位上香 Web App，供寺廟與信眾使用。手機可用鏡頭 AR、NFC 點香、陀螺儀煙霧；電腦則為 RWD 簡化版。純前端、可 PWA 化、託管於 GitHub Pages。

## 功能
- 🔥 點香（NFC 貼紙 / 按鈕觸發）＋打火機動畫
- 🪔 一炷香渲染與燃燒進度
- 📷 鏡頭 AR 背景（手機後鏡頭）
- 🌬️ 陀螺儀煙霧方向 + 快速移動殘影（手機）
- 🌡️ 依季節 / 溫度自動推算燃香時間，或手動設定
- 🥢 擲筊（聖筊 / 笑筊 / 陰筊，含三聖筊計數）
- 📱 PWA、RWD，可加入主畫面離線使用

## 開發
```bash
npm install
npm run dev        # 本機開發（手機可用同網段 IP 測試）
npm run build      # 輸出到 dist/
npm run preview    # 預覽 build 結果
```

> 開發時 `base` 預設為 `/incense/`。本機若想用根路徑，執行 `BASE=/ npm run dev`。

## 部署（GitHub Pages）
1. 將專案推到 GitHub，Repo 名稱建議 `incense`。
2. Settings → Pages → Source 選 **GitHub Actions**。
3. 推到 `main` 會自動透過 [.github/workflows/deploy.yml](.github/workflows/deploy.yml) 建置部署。
4. 網址：`https://<user>.github.io/<repo>/`
   （Actions 會自動以 repo 名稱當作 `base`。）

## NFC 貼紙設定（寺廟佈署）
用「NFC Tools」App 將下列**網址**寫入 NTAG213/215 貼紙：
```
https://<user>.github.io/incense/?action=lighter
```
手機觸碰即自動開站並點香（iOS / Android 通用）。Android Chrome 另支援 App 內主動掃描。

## 注意事項
- 鏡頭、陀螺儀需 HTTPS 與使用者手勢授權 → 已用「開始參拜」按鈕承接。
- iOS Safari 不支援 Web NFC 主動讀取 → 採「貼紙存網址」方案。
- 天氣用 [Open-Meteo](https://open-meteo.com/)（免金鑰），失敗自動退回預設時間。

## 檔案結構
```
index.html              入口
src/                    各功能模組（main/incense/smoke/nfc/weather/jiaobei/timer…）
styles/                 base.css / responsive.css
public/                 manifest、service-worker、icons、.nojekyll
.github/workflows/      Pages 自動部署
```
