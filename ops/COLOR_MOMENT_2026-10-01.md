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

## v2441 — Lightprint 光紋 v1.1 (2026-10-01)
- Soft bloom UX: keepsake framing (one-of-a-kind), not a cold code.
- On 收光: capture bloom/touch gesture as memorial image layer.
- Result card: soft memorial panel + caption; AE · LP-XXXXXXXX secondary.
- Exported PNG: memorial wash + soft panel; LP mark quieter.
- No shop-binding copy for Lightprint (unique to this person/card moment).
- Free-form touch + 收光/Seal CTA unchanged; 摘自《盛明》筆記 kept.

## v2442 — Lightprint Solo Color Moment prototype (2026-10-01)
- Hold-to-coalesce「收光」(~1.3s visual ring; **no seconds text**). Release early = cancel, not failure.
- Touch trail = primary creation; memorial panel + unique memorial copy.
- AE · LP-… secondary in corner (card + PNG).
- localStorage residue (`ae_lightprint_residue`): path + palette + mood + answers + LP code.
- Replay:「看光再走一次」re-animates the light path (card + residue banner).
- Soft Revisit (overlay new light on same moment): **stubbed / later** — Replay + card shipped.
- Pulse / Together: skipped this slice.
- Preview only on `new9-public-media`. Production untouched.

