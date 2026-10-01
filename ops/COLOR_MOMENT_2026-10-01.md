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

## v2443 — iPhone Safari playable UX (2026-10-01)
Preview only on `new9-public-media`. Production untouched.

### Fixes
- **No scroll-while-drawing:** `touch-action:none`, non-passive `touchmove` preventDefault, body overflow lock while fingers on canvas.
- **Visible 「收光」:** sticky/fixed primary hold control on mobile (safe-area), bilingual `收光` / `收光 · Seal`, hold ~1.3s, early release = cancel, no seconds text.
- **Layout:** compact heading while blooming; canvas full-width on iPhone; seal dock always findable without scrolling away from canvas.
- **Soft coalesce:** whole-trail soft re-stamp only — **no hard mid press-spot / center bloom blob**.
- **Mist / multi-touch (optional, not mandated):** single finger gets clearer trail + light ambient mist; several contacts deepen a soft full-paper fog. Soft discoverability hint only.
- Dual-card (meaning + Lightprint trail memorial): **noted for follow-up**, not shipped this deploy.

## v2444 — unique memorial + answer echo + stronger mist (2026-10-01)
Preview only on `new9-public-media`. Production untouched.

### A) Explicit unique memorial
- Result card + PNG: `獨一無二紀念 · 光紋記住你如何存在於這一刻` / `One-of-a-kind memorial · Lightprint keeps how you existed here`
- Memorial img alt ZH `獨一無二紀念光痕`; seal toast `光已收好 · 獨一無二紀念` / `Light sealed · a one-of-a-kind memorial`
- Discover line soft-mentions unique memorial when Lightprint present (no shop-binding)

### B) Answer echo
- Soft on-card echo of up to 2 last choice phrases (`你剛才靠近的是——「…」` / `You leaned toward — “…"`)
- PNG echo skipped this pass (height kept clean for longer memorial caption)

### C) Stronger mist / bloom feel
- `.cm-mist.is-soft` opacity ~.72 + richer soft gradients; `.is-rich` ~.93 full-paper fog
- Single-finger bloom count/radius/alpha slightly stronger; 收光 coalesce still soft whole-trail (no hard mid press-spot)

### D) Question pool
- +4 soft body/senses/closeness questions (ZH+EN); shuffle draw 3–4 unchanged

## v2445 — ruthless Solo progressive disclosure (2026-10-01)
Preview only on `new9-public-media`. Production untouched. One Preview deploy.

### Problem
Owner (iPhone Safari): still hard to operate / doesn’t know what to do — too many competing cues (intro, mist tip, hold hint, residue, shop links, early 收光).

### Simplify (one step at a time)
1. **Ask** — only question + 1-line coach `輕輕選一個` / `Pick one that fits`. Long Lightprint intro gone. Residue banner off. Progress shortened to `1 / 3`.
2. **Touch** — only canvas + coach/hint `自由觸碰` / `Touch freely`. 「收光」 hidden. Shop/Experience links hidden.
3. **Seal** — after a short real touch (≈4 path points, or ~1.4s after first paint): big sticky 「收光」 + 1-line `按住「收光」` / `Hold 收光`. Mist multi-finger tip removed from UI (mist still works). Hold-hint line visually hidden (aria kept).
4. **Done** — card + memorial copy unchanged; after-links return.

### Kept
- No scroll-on-draw, soft coalesce (no press-spot), multi-touch optional mist, unique memorial copy, hold-to-seal / early release = cancel.


## v2446 — restore soft grade_v1 feel (Owner feedback) (2026-10-01)
Preview only on `new9-public-media`. Production untouched. One Preview deploy.

### Owner feedback (~v2445)
Prefers feel BEFORE Lightprint/GPT TRIAD — better animation/quality. Current: text too big, feels cheap, cards more complex but not better. Questions may feel fixed; hold 收光 selects button text (iOS).

### Restored
- Softer bloom quality (pre-Lightprint count/radius/spread + tick alpha 0.55)
- Softer typography (question/coach/hint/title/ritual; less giant coach)
- Softer mist opacity
- Slim result card: memorial image kept; answer-echo off; short memorial caption; one soft discover line (no memorial copy pile)
- Random question pool hardened (crypto shuffle, copy-safe draw every play/replay) + soft intro line

### Kept
- Hold-to-coalesce 「收光」 (~1.3s ring; early release = cancel)
- No scroll-while-drawing
- Soft whole-trail coalesce (no hard mid press-spot)
- Progressive Solo phases (ask → touch → seal → done)
- Quiet LP corner mark; grade_v1 art pools

### Fixed
- 「收光」: `-webkit-user-select:none`, `user-select:none`, `-webkit-touch-callout:none` on button + label; prevent selectstart/contextmenu

