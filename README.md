# AE Universe Creation official site — Production snapshot

This repository mirrors the official website **as it runs in Production**, taken from Vercel deployment `dpl_By4npMgbv7u44QhixovExZsjmk5n` (released 2026-11-19, Taipei). Production domains: `ae-universe-creation.vercel.app` and `ae-universe-creation-one.vercel.app`.

This repo is a baseline for future updates. It is **not** auto-deployed. Any Production deploy still needs our review and the Owner's yes.

One Production file is omitted: `api/ecpay/_lib.js`, because it contained a hardcoded non-public ECPay HashKey. Live payment credentials stay in Vercel environment variables and are not in this repository.

# 這份程式碼對應官網正式站

此倉庫對應 Vercel 正式部署 `dpl_By4npMgbv7u44QhixovExZsjmk5n`（2026-11-19 台北時間發布）。正式站域名：`ae-universe-creation.vercel.app`、`ae-universe-creation-one.vercel.app`。

這是後續更新的基準，**不會**自動上正式站。要上正式站，仍須經過我們審查，並得到 Owner 同意。

正式站檔案 `api/ecpay/_lib.js` 未放入本倉庫，因為其中有寫死的非公開綠界 HashKey。正式金鑰只存在 Vercel 環境變數，不在這個倉庫裡。
