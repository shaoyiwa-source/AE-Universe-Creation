# AE Lumina Wall｜雲端作品庫設定說明（Owner 操作，約 5 分鐘）

R3 起，AE 工作室的密碼由網站伺服器驗證，作品存放在 Vercel Blob（與商店使用同一個私有儲存空間）。
只要完成下面兩步，`/gallery` 的 AE 工作室就能上傳作品，所有客戶裝置同步看到。

## 步驟 1：設定工作室密碼
1. 登入 Vercel → 進入專案 **ae-universe-creation**。
2. **Settings → Environment Variables → Add New**。
3. Key 填 `LUMINA_STUDIO_PASSWORD`，Value 填你自己決定的密碼（建議 16 字以上，例如三個英文單字加四位數字）。
4. Environments 勾選 **Production** 與 **Preview**，按 Save。
5. （選填）再加一個 `LUMINA_SESSION_SECRET`，填一串隨機長字串；之後換密碼時，舊的登入會自動失效。

> 密碼只存在 Vercel，不在程式碼或 GitHub 裡。要換密碼：改這個值並重新部署即可。

## 步驟 2：確認雲端儲存（Blob）
1. 在同一個專案點 **Storage**。
2. 如果已經看到一個 Blob store 連到這個專案（商店的私有檔案就在這裡），**不用做任何事**，`BLOB_READ_WRITE_TOKEN` 已經存在。
3. 如果沒有：**Create Database → Blob → Private** → Connect to Project（Production 與 Preview 都勾）。

## 步驟 3：重新部署並驗收
1. **Deployments** → 最新一筆 → **Redeploy**（環境變數要重新部署才會生效）。
2. 打開 `https://<你的網址>/gallery` → **長按左上角三環標誌 3 秒** → 輸入步驟 1 的密碼。
3. 看到「AE 工作室」標籤與「加入作品」按鈕，即完成。

## 使用限制
- 每個檔案 4MB 以內（Vercel 函式的上傳上限）。照片會自動縮到最長邊 2560px；影片請先壓縮成 MP4（1080p、約 10–20 秒的動態作品通常在 4MB 內）。
- 支援：JPG、PNG、WebP、GIF（動態）、AVIF；影片 MP4、WebM、MOV；音樂 MP3、M4A、WAV、OGG。

## 疑難排解
| 畫面訊息 | 原因 | 處理 |
|---|---|---|
| 伺服器尚未設定工作室密碼 | 沒有 `LUMINA_STUDIO_PASSWORD`，或設定後沒重新部署 | 回到步驟 1、3 |
| 雲端作品庫尚未設定 | 專案沒有連到 Blob store | 回到步驟 2 |
| 密碼不正確 | 密碼打錯 | 重新長按輸入 |
| 工作室登入已過期 | 登入 12 小時後自動登出，或已更換密碼 | 重新長按登入 |
