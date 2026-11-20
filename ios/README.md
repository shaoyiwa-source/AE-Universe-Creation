# AE動態桌布 — iPhone App（原生 SwiftUI）

完全原生的 iOS App，功能與網頁版 `/wallpaper/` 相同，並加上原生功能：

- 匯入照片當底圖、手寫字、手畫光紋、文字方塊、可愛符號庫、匯入可愛圖片；拖曳、雙指縮放旋轉、復原
- 動態可愛元件 ×3（雲朵寶寶、跳跳星、果凍愛心），可愛音效 ×3（即時合成），每種元件可自選聲音
- 動態濾鏡 ×3（蜜桃奶霜、夢幻紫霧、復古底片）、動態主題 ×3（夜店雷射、微風流動、閃閃發光），可跟著音樂節奏
- 匯入音樂（從「檔案」App）
- 互動模式：全螢幕、鎖定畫面時鐘預覽、可隱藏的 AE 互動按鈕
- **製作原況照片（Live Photo）**：錄 3 秒，直接存成可設為鎖定畫面的原況照片
- 存靜態桌布（PNG）、錄製影片（含音樂與錄影時點元件的音效）
- **一鍵設為桌布**：透過「AE設桌布」捷徑（iOS 不允許 App 直接更換桌布）
- **鎖定畫面按鈕「AE互動」**（iOS 18 控制項），也可放在控制中心；`aewallpaper://play` 直接開啟互動模式
- 桌布更新頻率：每 N 小時／天從收藏輪播
- 介面採用 AE Universe Creation VI（紙白／深綠、Cormorant Garamond、Three Rings、深色模式）

支援 iOS 17 以上；鎖定畫面按鈕需 iOS 18。

## 程式結構
| 資料夾 | 內容 |
| --- | --- |
| `AEWallpaper/App` | App 進入點、深層連結 |
| `AEWallpaper/Model` | 場景資料、設定、本機儲存、編輯器狀態 |
| `AEWallpaper/Render` | 繪圖引擎：元件、粒子、濾鏡、主題 |
| `AEWallpaper/Audio` | 音效合成、音樂播放、節奏偵測、匯出混音 |
| `AEWallpaper/Export` | 靜態圖、影片、原況照片、存到「照片」 |
| `AEWallpaper/Views` | 畫面：編輯器、面板、互動模式、匯出、說明 |
| `AEWallpaper/Style` | VI 顏色、字型、按鈕樣式 |
| `AEControls` | iOS 18 鎖定畫面／控制中心按鈕 |
| `Shared` | 按鈕觸發的 App Intent |

## 建置
專案檔由 [XcodeGen](https://github.com/yonaskolb/XcodeGen) 從 `project.yml` 產生。

**有 Mac：**
```bash
brew install xcodegen
cd ios && xcodegen generate && open AEWallpaper.xcodeproj
```
在 Xcode 兩個 target 的 Signing & Capabilities 選你的 Team，接上 iPhone 按 ▶︎。

**沒有 Mac：** GitHub Actions 的 `iOS build` 會在雲端 Mac 上編譯檢查；之後可設定自動上傳 TestFlight（需要 Apple 開發者帳號）。

Bundle ID 預設 `com.aeuniverse.wallpaper`（按鈕為 `com.aeuniverse.wallpaper.controls`），被占用時兩個都要改。

字型 Cormorant Garamond 以 SIL Open Font License 1.1 授權內建。

## 自動上傳 TestFlight（不需要 Mac）
`.github/workflows/ios-testflight.yml` 會在雲端 Mac 上打包，並用 Xcode 雲端自動簽章上傳 TestFlight。
在 GitHub 專案 → Settings → Secrets and variables → Actions 加入：

| Secret | 內容 |
| --- | --- |
| `APPLE_TEAM_ID` | 開發者團隊 ID（developer.apple.com → Account → Membership details） |
| `ASC_KEY_ID` | App Store Connect API 金鑰 ID |
| `ASC_ISSUER_ID` | API 金鑰頁面上方的 Issuer ID |
| `ASC_KEY_P8` | 下載的 `AuthKey_XXXX.p8` 檔案全文 |

API 金鑰在 App Store Connect → 使用者與存取權限 → 整合 → App Store Connect API 建立，存取權限選「管理」（Admin），才能自動建立憑證與描述檔。
另外要先在 App Store Connect 建立 App（套裝 ID `com.aeuniverse.wallpaper`）。
