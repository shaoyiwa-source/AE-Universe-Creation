# AE Universe Creation｜給所有開發者與 AI 助手的長期守則

這份檔案寫給之後所有參與這個專案的人與 AI（Claude、GPT／Codex 等）。
開始動手前請先讀完它，以及 [`RELEASE_GUARD.md`](RELEASE_GUARD.md)（上線與 VI 規則）。

---

## 1. 模組化原則（Owner 指示，2026-11-24）

> 功能只做一次，做成模組；其他地方要用，直接 `import` 進來。

- 任何「可能在第二個地方用到」的功能，都要做成**獨立模組**，不要寫死在某一個頁面裡。
- 模組放在 **`public/modules/<模組名稱>/`**，網址是 `/modules/<模組名稱>/index.js`。
- 每個模組都要：
  - 是原生 ES module（`export`），**不依賴任何建置工具**，瀏覽器直接 `import` 就能用。
  - 不碰頁面的 DOM、樣式、文案；UI 由使用它的頁面自己做（才能配合各頁面的 VI）。
  - 自己附一份 `README.md`：用途、`import` 範例、API、限制（例如 iOS Safari 的權限）。
  - 盡量不改 API；必須改的話要相容舊用法，或同時更新所有使用它的地方。
- 使用方式：

  ```js
  import { createRecorder } from '/modules/audio-record/index.js';
  import { createVoiceFx } from '/modules/audio-voice/index.js';
  ```

- 要新增功能時，先看 `public/modules/` 是否已經有類似的模組，**有就沿用、擴充，不要重寫一份**。
- 每個模組都要列在下面的「模組清單」裡。

### 模組清單

| 模組 | 狀態 | 內容 |
| --- | --- | --- |
| `audio-record` 錄音 | 規劃中 | 麥克風錄音、存檔（下載／分享），以及和錄音相關的延伸：變聲（高音、小動物聲、機器人聲…）、把錄下的聲音變成樂器音色（依音高彈奏） |
| `audio-tune` 修音 | 規劃中 | 錄音室式修音：音高校正、降噪、等化（EQ）、壓縮、殘響、音量標準化，輸出處理後的音檔 |

> 規劃中的模組還沒有程式碼；做的時候照上面的規則建立資料夾與 README，並把狀態改成「可用」。

### 已有、之後可抽成模組的程式

這些目前寫在動態桌布裡；有第二個地方要用時，請先把它搬到 `public/modules/` 再 import，不要複製貼上：

- `public/wallpaper/js/sound.js`：Web Audio 合成的可愛音效（pop、bell、chirp…）、音樂播放、錄影時的混音。
- `public/wallpaper/js/effects.js`：動態主題、濾鏡、可愛元件的繪製。
- `public/wallpaper/js/i18n.js`：中英文切換（與官網共用 `ae-language`）。

---

## 2. 產品決定（避免重複討論）

- **AE 動態桌布不需要錄音或聲音功能**：iPhone 的桌布（包括原況照片）都不會發出聲音，也不能點擊互動。
  App 裡的音效只用在「互動模式（預覽）」和「錄成影片」。（2026-11-24 與 Owner 確認）
- 錄音、變聲、修音這類功能，以上面的模組形式另外做，需要的頁面再 import。

---

## 3. 其他協作提醒

- 官網的 VI、字型、深淺色切換（`ae-theme`）、中英文（`ae-language`）要一致；細節見 `RELEASE_GUARD.md`。
- `public/index.html`（首頁）是單行檔案，多人同時改一定會衝突；要改首頁前先和 Owner 確認有沒有人正在改。
