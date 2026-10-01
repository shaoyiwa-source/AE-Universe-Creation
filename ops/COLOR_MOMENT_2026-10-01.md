# 色彩瞬間 · Color Moment · Preview 2026-10-01

Route: `/color-moment` → `color-moment.html` (also `public/color-moment.html`).
Preview only on `new9-public-media`. Soft interactive bloom — not hard-sell.

## Flow (v2430)
1. Each session **draws 3–4 questions** from a **12-question pool** (shuffled). Replay redraws.
2. Soft tag weights + affinity bleed → mood/palette.
3. Canvas blooms; richer **art-backed result card** fades in.
4. Card text prioritizes **《盛明》**試寫／觀看筆記 lines (not 宇宙進化 / AI男友).
5. Soft links to Experience / Shop.

## Result card
- Owner artwork background (mood-mapped from Website_Selected + selected-works webp pool)
- Poetic mood title (ZH + soft EN)
- 《盛明》 short reading (2–3 lines)
- Named hue chips
- Tonight’s soft invitation (盛明-toned)
- Soft discover line

## Art pools
- **Ready now:** 8 Website_Selected webp + extra `assets/selected-works-v2/*` mapped by mood
- **Deferred:** grade_v1 JPG (IMG_5046–5055 skip 5050) — Drive binary download unavailable in-agent this pass
- **Deferred:** RAW_333 / Pictures_upload HEIC convert (~333) — too heavy for this Preview ship

## Scoring (under the hood)
Primary tags + `TAG_AFFINITY` fuzzy bleed; near-tie soft random among top moods.

## Tone
Mysterious, soft. 朝軒宇宙創造 / 盛明. Collecting optional. No quiz jargon on UI.


## v2435 (2026-10-01)
- Remove hue dots from on-screen card + exported PNG (Owner: 色點拿掉若視覺更好就拿掉).
- Canvas export: CJK-capable font stack (`Noto Serif TC` / `PingFang TC` / …) + load Noto Serif TC; fixes iPhone Safari `Arial`/`Georgia` missing Chinese in saved PNG.
- Dynamic canvas height from text layout (no `maxLines=3` / `ritualY` clip).
- Center-zoom card art (~1.24) so artwork edge titles fight UI text less.
