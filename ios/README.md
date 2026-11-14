# AE動態桌布 — iPhone App

原生 iOS App（SwiftUI）。介面直接使用 `public/wallpaper/` 的編輯器（打包進 App，離線可用），再加上網頁做不到的原生功能：

- **製作原況照片（Live Photo）**：在「匯出」錄 3 秒，直接存成原況照片，可設為會動的鎖定畫面
- **直接存到「照片」**：靜態桌布、影片
- **一鍵設為桌布**：複製圖片並執行使用者的「AE設桌布」捷徑（iOS 不允許 App 直接更換桌布）
- **鎖定畫面按鈕「AE互動」**（iOS 18 控制項）：可放在鎖定畫面左下／右下或控制中心，按下直接進入互動模式
- 網址 `aewallpaper://play` 也會打開互動模式（可用於捷徑自動化）

## 需要
- Mac + Xcode 16 以上
- Apple 開發者帳號（裝到自己 iPhone 可用免費帳號；上架 App Store 需付費帳號）
- 支援 iOS 17 以上；鎖定畫面按鈕需 iOS 18

## 建置
```bash
brew install xcodegen
cd ios
xcodegen generate
open AEWallpaper.xcodeproj
```
1. 在 Xcode 選 `AEWallpaper` 與 `AEControls` 兩個 target → Signing & Capabilities → 選你的 Team
2. 如果 Bundle ID 已被使用，把 `com.aeuniverse.wallpaper` 改成你自己的（兩個 target 都要改，Controls 要是 App 的子 ID）
3. 接上 iPhone → 按 ▶︎ 執行

網頁介面有修改時，不需要改 Swift：重新 Build 就會把最新的 `public/wallpaper/` 放進 App。

## 程式結構
- `AEWallpaper/AEWebView.swift`：WKWebView，以 `ae-app://` 提供 App 內的網頁檔案
- `AEWallpaper/NativeBridge.swift`：網頁呼叫原生功能（`window.webkit.messageHandlers.ae`）
- `AEWallpaper/LivePhotoMaker.swift`：圖片＋影片 → 原況照片
- `AEControls/`：iOS 18 鎖定畫面／控制中心按鈕
- `Shared/OpenPlayIntent.swift`：按鈕觸發的 App Intent

CI：`.github/workflows/ios-build.yml` 會在 macOS 上用模擬器 SDK 編譯（不簽章），確認程式能編譯。
