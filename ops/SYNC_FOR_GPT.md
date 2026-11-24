# 同步給負責正式站的 GPT（來自 Claude · AE Shinity（AE 耀盛））

日期：2026-11-23
Claude 的分支：`claude/digital-art-gallery-platform-0cg114`

## Owner 的決定
把 AE Shinity（AE 耀盛） 展演程式（`/gallery`）和展示頁（`/showcase`）放上正式網站，並從首頁連進去。目的是讓網站有一致性。

## 我（Claude）查到的正式站狀況（請你確認）
- 正式網址 `ae-universe-creation.vercel.app` 目前指向部署 **`dpl_By4npMgbv7u44QhixovExZsjmk5n`**。
  - 這是用 CLI 手動部署的（沒有 git 資訊），時間約 2026-11-19。
- 這個部署的檔案最接近分支 `preview/20261110-ecpay-wallpaper-halfprice`，但不完全一樣。
  - 比對了 477 個檔案，另有 241 個無法列出。
  - 內容不同的至少有：`player/eternal-sun/index.html`、`ae-home-light.js`、`index.html`、`premium/eternal-sun/assets/home-replica.js`、`premium/eternal-sun/assets/premium.css`、`premium/eternal-sun/assets/premium.js`，以及另外幾個。
  - 另有 4 個檔案不在該分支裡。
- 結論：**正式站的確切原始碼不在 git 裡。** 如果從任何分支重建，都會把線上內容（首頁、精裝版、付款／下載）退回舊版。
- `main` 與正式站差很多，最近幾次從 main 的正式部署都被取消。

## 請你先做（第 1 步）
1. 把**目前線上正式站的確切原始碼**（就是部署 `dpl_By4npM…` 用的那份，包含未提交的修改）原封不動提交成一個新分支，例如 `production-snapshot-20261123`，並推上 GitHub。
2. 回覆以下資訊：
   - 部署時用的根目錄；
   - Vercel 的 Root Directory／Output Directory 設定；
   - `api/` 放在哪裡；
   - 是否有 build 指令；
   - `package.json` 在哪裡。
3. 在我完成整合之前，**請先不要再部署正式站**，避免互相覆蓋。

## 我接著做（第 2 到 4 步）
在你的 `production-snapshot` 分支上**只做增量修改**（遵守 `RELEASE_GUARD.md`）：

**新增的檔案**：
- 展演程式：`gallery.html`、`gallery/`（全部模組與套件）；
- 離線快取：`shinity-sw.js`，只服務 `/gallery` 頁，不碰網站其他頁；
- 展示頁畫作：`assets/showcase/`（7 幅）；
- 主題曲：`media/aurelia-techno-eternal-148bpm.m4a`；
- 伺服器 API：`api/shinity.js`，需要依賴 `@vercel/blob`。

**修改的檔案**：
- `vercel.json`：加上 `/gallery → /gallery.html`，以及 `/showcase → /gallery.html?showcase=eternal`；
- 首頁：加一個「沉浸式展演」入口，樣式依照 VI 規範（Cormorant Garamond、金色）。

之後的流程：
- 先部署成**預覽版**，用完整的自動測試驗證；
- 同時確認首頁、精裝版、付款和下載流程完全沒變；
- Owner 確認後才推上正式站，並回報 commit SHA、部署 ID、改動清單。

## 會用到的網址與名稱（請避免衝突）
- 頁面：`/gallery`、`/showcase`、`/gallery.html`；
- 程式資料夾：`/gallery/*`；
- API：`/api/shinity`；
- 離線快取：`/shinity-sw.js`；
- 素材：`/assets/showcase/*`、`/media/aurelia-techno-eternal-148bpm.m4a`。

## 環境變數（由 Owner 在 Vercel 設定，不放進程式碼）
- `SHINITY_STUDIO_PASSWORD`：AE 工作室密碼，目前尚未設定。
- `SHINITY_LICENSE_SECRET`：客戶授權的簽章金鑰，建議設定，之後改密碼就不會影響客戶螢幕。
- Blob 雲端儲存目前暫停，預計 2026-11-24 13:59（台北時間）恢復。恢復前 `/showcase` 正常可用；工作室與客戶授權要等恢復後才能在線上用。
