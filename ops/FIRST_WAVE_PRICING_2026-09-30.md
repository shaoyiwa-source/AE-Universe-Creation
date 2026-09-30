# First-wave pricing lock · Owner 2026-09-30

Digital goods only (not physical originals). Soft mysterious tone on site copy.
Public product copy: short positive what-it-is + price — avoid “不是…／不是…” disclaimer habit.

| Product | Price | What it is |
|---|---|---|
| Eternal Sun single · 盛明單張 | NT$122 | One edition from the Eternal Sun four (original / gallery / phone / square). |
| Eternal Sun 4-pack · 盛明四張組 | NT$444 | The full Eternal Sun four-pack. |
| 九張組 | normal NT$555 / promo NT$444 | Nine hand-painted wallpapers. |
| 花花世界心宇宙（九宮格） | NT$555 | Nine-grid cosmos pack — flower & heart. |
| 暗夜繽紛美宇宙（九宮格） | NT$555 | Nine-grid cosmos pack — night bloom. |
| Bundle | 三件合購再九折 | Eternal Sun 4-pack + 花花世界心宇宙 + 暗夜繽紛美宇宙. |

## Amount definitions (for later multi-SKU)
- Formal display / ES checkout list price: `FORMAL_LIST_PRICE_TWD = 444` in `api/payment/ecpay-v2/_lib.js` (and `LIST_PRICE = 444` in `checkout.html`) = ES 4-pack.
- Stage sandbox amounts: `stageAmountForSku()` / `ECPAY_STAGE_AMOUNT_*` env — Stage test amounts, not multi-SKU cart.
- Multi-SKU ECPay cart amounts: not implemented this pass — display + clear pricing copy only.

Do not invent typo product names. Use the locked names above.

## Ko-fi deep links
See `ops/KOFI_PRODUCT_URLS_2026-09-30.md` for per-SKU buy URLs (hub only where no product page).
