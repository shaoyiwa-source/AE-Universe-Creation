# AE Universe Creation — 所有工作對話的共同規則（長期記憶）

## 正式站（Production）：只有 Grok 能上（Owner 2026-11-24）
- `ae-universe-creation.vercel.app` 的正式部署，**只有 Grok 負責**。除了 Grok，任何對話或代理都**不可以**：
  - 部署、提升（promote）或回滾正式站；
  - 修改正式站的網域、別名或環境設定；
  - 推送任何可能觸發正式部署的分支（例如 `main`）。
  這包括 Claude、GPT 和其他所有代理。
- 要上正式站的東西：放在自己的分支或預覽版完成並測試，再把整合說明交給 Grok（範例：`ops/SYNC_FOR_GROK.md`）。由 Grok 上線，並回報 commit SHA 與部署 ID。
- 正式站目前的原始碼不完全在 git 裡：正式版是手動部署的，與任何分支都不完全相同。所以**不要從 git 重建正式站**，那會把線上內容退回舊版。

## 其他長期規則（Owner）
- **回覆語言**：與 Owner 用中文溝通。
- **審查**：每輪交付前交給 3 個獨立審查員測試。
  - 發現 **bug**：核實後直接修。
  - **修改規格**：先和 Owner 討論，Owner 同意後才改。
- **作品**：畫作本身絕不變形，只能在上面加光與元素。
- **商業原則**：賣的是藝術，不是軟體。客戶不能新增、上傳或下載作品。
- **機密**：不提交任何機密。密碼與金鑰只放在 Vercel 環境變數，由 Owner 設定。

## 這個分支（`claude/digital-art-gallery-platform-0cg114`）
- 內容：AE Shinity（AE 耀盛）展演程式（`/gallery`）和展示頁（`/showcase`）。
- 開發日誌：`ops/LUMINA_WALL.md`。
- 測試案例：`ops/LUMINA_TEST_CASES.md`。
- 自動測試：`tests/*.test.mjs`。
