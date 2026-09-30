# First-wave pricing lock · Owner 2026-09-30

Digital goods only (not physical originals). Soft mysterious tone on site copy.

| Product | Price |
|---|---|
| Single wallpaper · 單張桌布 | NT$122 |
| Eternal Sun 4-pack · 盛明四張組 | NT$444 |
| 九張組 | normal NT$555 / promo NT$444 |
| 花花世界心宇宙（九宮格） | NT$555 |
| 暗夜繽紛美宇宙（九宮格） | NT$555 |
| Bundle: Eternal Sun + 花花世界心宇宙 + 暗夜繽紛美宇宙 | 三件合購再九折 |

## Amount definitions (for later multi-SKU)
- Formal display / ES checkout list price: `FORMAL_LIST_PRICE_TWD = 444` in `api/payment/ecpay-v2/_lib.js` (and `LIST_PRICE = 444` in `checkout.html`).
- Stage sandbox amounts: `stageAmountForSku()` / `ECPAY_STAGE_AMOUNT_*` env — still Stage test amounts, not multi-SKU cart.
- Multi-SKU ECPay cart amounts: **not** implemented this pass — display + clear pricing copy only.

Do not invent typo product names. Use the locked names above.
