# 色彩瞬間 · Color Moment · Preview 2026-10-01

Route: `/color-moment` → `color-moment.html` (also `public/color-moment.html`).
Preview only on `new9-public-media`. Soft interactive bloom — not hard-sell.

## Flow (v2429)
1. Each session **draws 3–4 questions** from a **12-question pool** (shuffled order + shuffled choices). Replay redraws a new subset.
2. Answers add soft tag weights + **affinity bleed** (related tags reinforce each other) → mood/palette.
3. Canvas blooms in that palette; richer result card fades in after first bloom.
4. **Feel again** resets and redraws questions; soft links to Experience / Shop.

## Result card (richer)
- Poetic mood title (ZH + soft EN)
- Short personal reading (2–3 lines)
- Named hue chips for the mood
- “Tonight’s soft invitation” / tiny ritual line
- Soft discover line to Experience / Shop (no hard sell)

## Scoring (under the hood — not shown on UI)
- Primary tags from each choice (+1)
- `TAG_AFFINITY` partial weights for related moods (fuzzy, not brittle exact-only)
- Near-tie soft random among top moods

## Files
- `color-moment.html` / `public/color-moment.html` — `QUESTION_POOL`, `TAG_AFFINITY`, `MOODS`, bloom + card UI
- `vercel.json` — `/color-moment` rewrite
- `experience.html` — soft discovery link back to Color Moment

## Tone
Mysterious, soft. 朝軒宇宙創造. Collecting is optional. Not quiz-game jargon on the UI.
