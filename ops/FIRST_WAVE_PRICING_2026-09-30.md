# First-wave pricing lock · Owner 2026-09-30

Digital goods only (not physical originals). Soft mysterious tone on site copy.

## SKU meaning (do not blur)

| Product | Price | Meaning |
|---|---|---|
| Eternal Sun single · 盛明單張 | NT$122 | **One** edition from the existing Eternal Sun four (original / gallery / phone / square), sold individually. Not “any wallpaper,” not a slice of 九張組 or 九宮格. |
| Eternal Sun 4-pack · 盛明四張組 | NT$444 | The **full** Eternal Sun four-pack. |
| 九張組 | normal NT$555 / promo NT$444 | A **separate** nine-wallpaper set — not Eternal Sun split into singles. |
| 花花世界心宇宙（九宮格） | NT$555 | One of the **two** nine-grid cosmos packs — not ES, not 九張組. |
| 暗夜繽紛美宇宙（九宮格） | NT$555 | The **other** nine-grid cosmos pack — not ES, not 花花世界心宇宙 split. |
| Bundle | 三件合購再九折 | **Only** Eternal Sun 4-pack + 花花世界心宇宙 + 暗夜繽紛美宇宙. Singles and 九張組 are outside this bundle. |

## Amount definitions (for later multi-SKU)
- Formal display / ES checkout list price: `FORMAL_LIST_PRICE_TWD = 444` in `api/payment/ecpay-v2/_lib.js` (and `LIST_PRICE = 444` in `checkout.html`) = **ES 4-pack only**.
- Stage sandbox amounts: `stageAmountForSku()` / `ECPAY_STAGE_AMOUNT_*` env — still Stage test amounts, not multi-SKU cart.
- Multi-SKU ECPay cart amounts: **not** implemented this pass — display + clear pricing copy only.

Do not invent typo product names. Use the locked names above.
