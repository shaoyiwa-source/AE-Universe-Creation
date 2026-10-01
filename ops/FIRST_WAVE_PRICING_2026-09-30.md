# First-wave pricing lock · Owner (updated 2026-10-01)

Digital goods only (not physical originals). Soft mysterious tone on site copy.
Public product copy: short positive what-it-is + price — avoid “不是…／不是…” disclaimer habit.

**Owner locks:**
- Eternal Sun single · 盛明單張 removed from public listings.
- Only **two** nine-grid products: 花花世界心宇宙 + 暗夜繽紛美宇宙 (remove duplicate 「九張組」 card).

| Product | Price | What it is | Ko-fi |
|---|---|---|---|
| Eternal Sun 4-pack · 盛明四張組 | NT$444 | The full Eternal Sun four-pack. | https://ko-fi.com/s/e3991964e5 |
| 花花世界心宇宙（九宮格） | NT$555 | Nine-grid cosmos pack — flower & heart. | https://ko-fi.com/s/9b9703d58b (AE Heart Universe | 9-Piece) |
| 暗夜繽紛美宇宙（九宮格） | NT$555 | Nine-grid cosmos pack — night bloom. | https://ko-fi.com/s/f68079f3cc (AE Color Universe | 9 Fragments) |
| Bundle | 三件合購再九折 | Eternal Sun 4-pack + 花花世界心宇宙 + 暗夜繽紛美宇宙. | *(hub until bundle page)* |

## Amount definitions (for later multi-SKU)
- Formal display / ES checkout list price: `FORMAL_LIST_PRICE_TWD = 444` in `api/payment/ecpay-v2/_lib.js` (and `LIST_PRICE = 444` in `checkout.html`) = ES 4-pack.
- Stage sandbox amounts: `stageAmountForSku()` / `ECPAY_STAGE_AMOUNT_*` env — Stage test amounts, not multi-SKU cart.
- Multi-SKU ECPay cart amounts: not implemented this pass — display + clear pricing copy only.

## Ko-fi deep links
See `ops/KOFI_PRODUCT_URLS_2026-09-30.md`.

Do not invent typo product names. Use the locked names above.
