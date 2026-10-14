# AE-HOME-SOUNDLIGHT-15S-FIX-20261014-0817 (Preview only)

## Root cause (Owner path: ♫ during the 15 s opening → light lags after climax → pitch warp on resize/look away)
1. Two players, two clocks: the opening was a private 112 BPM WebAudio synth (AudioContext #1);
   the dock ♫ played the 148 BPM m4a through createMediaElementSource on AudioContext #2 with a
   different light system. Mid-opening ♫ killed #1 (suspended, never closed) and started #2 at 51.95 s.
2. Beat timeline late: every kick in ae-home-beats.js was the bass-RMS *peak*, measured median
   ~44 ms after the real attack (378 kicks, p10–p90 41–46 ms in the groove after the drop). After the
   drop the light switches to full-power kick pulses + bolts, so the lag becomes visible.
3. The m4a was routed through WebAudio (MediaElementSource → analyser → destination) with a second
   context alive; that path resamples in the page's audio graph and is the known trigger for
   pitch/speed distortion on Safari/iOS and for underrun warble under main-thread load.

## Fix (one player, one clock, one state machine) — window.aeHomePlayer in ae-home-light.js
- One <audio> element, played natively (no MediaElementSource; no AudioContext unless the optional
  tap sound is switched on). Opening = first 15 s of the same ♫ track from cue 58.30 s
  (snare-roll build → drop 64.87 → groove), hard stop at 73.30 s.
- Lights = pure function of the track clock + measured timeline; kicks re-timed to measured attacks.
- phase: idle → opening(audio|light|loading) → ended; music ⇄ paused.
  ♫ during opening = keep the same song playing (no seek/restart); ♫ in light-only opening = start
  sound+light together from the cue; ♫ after end/pause = continue from the last heard position;
  replay = cue, 15 s; ■ stop during opening; tab hidden / pagehide / hero scrolled away = pause, ♫ resumes.
- Audio first under load (screen recording / native window drag): when the light canvas frame time
  EMA > 33 ms it drops shadowBlur and prismatic rays (exit < 22 ms). Light stays on the track clock.
  Headful test (DISPLAY :2, ffmpeg x11grab 30 fps recording + xdotool window drag 5 s):
  old micoia71p frames 83 ms median, light lag 80 ms (p90 120), 2 AudioContexts + 1 MediaElementSource;
  new 16.7 ms median, light lag −1 ms (p90 56), 0 AudioContexts. No blur/visibility events on drag.

# AE-HOME-SOUNDLIGHT-CONTINUOUS-SYNC-20261014-0907 (Preview only)

Continuous playback from 「播放音樂」 was still open. The 15 s opening PASS does not close it.

## Root cause
The single native `<audio>` clock was already on the beat. Same-frame `trackTime()` vs `audio.currentTime` on the previous build stayed at 0 ms median across the whole file. What slipped was the paint:

1. Full-quality lasers (shadowBlur + prismatic rays) took ~66 ms/frame here, and the lite gate (`EMA > 33` on, `< 22` off) turned that path back on as soon as frames recovered. `dataset.musicTime` is written when the frame starts, so a later read of `audio.currentTime` shows the paint duration. The QA pair (~81.83 vs 80.89, then ~86.98 vs 85.99, lightLite flipping) is that staleness, not a second audio clock. After the drop every kick is full power, so a late frame is an obvious missed beat. The 15 s opening uses the cheaper opening canvas, which is why that slice passed.
2. The 20% currentTime blend plus the 300 ms stall could hold a stale media time on a coarse clock. It was not the 1 s gap in Chrome (currentTime updates every frame), and it is gone anyway.
3. The 148 BPM grid was checked against the real m4a (sha1 `c62a5003fb17b748d7d289b98b168c38d92075a9`, the Preview asset). Independent spectral-flux attacks: both groove halves are 148.00 BPM, residual std 1.6 ms. Timeline vs those attacks: median −6 ms across the file, including after both drops. The grid was not retimed.

## Fix (still one audio element, no MediaElementSource)
- Track clock re-anchors to `currentTime` on every change and bridges gaps at `playbackRate`. It does not run ahead until currentTime has actually moved after a seek, and it stops inventing time if the element goes silent for 500 ms.
- The drawn beat leads by about one frame and is clamped to 40 ms ahead of `currentTime`.
- Once a music frame misses (interval > 28 ms or EMA > 22 ms), shadowBlur and prism rays stay off for the rest of that playback. If frames are still slower than 45 ms, gradient pools and kick bolts drop too. `?lite=1` forces the cheap path.
- A cue seek that the metadata load resets to 0 is applied again on `seeked` (cold load / moov-at-end). On Vercel, range requests already keep the cue; this covers the reset.

## Measurement (headful Chrome, range-capable server, real m4a)
Desktop 1440×900, 「播放音樂」 from cue 58.30 through the loop (7896 frames, one wrap, end at 8.0 s into the next pass):

| point | audio s | track s | light s | light−audio | frame med / p90 |
| --- | --- | --- | --- | --- | --- |
| build before drop 1 | 58.3–64.8 | = audio | audio+16.6 ms | −16.6 ms | 16.7 / 16.7 |
| drop 1 + groove | 64.8–73.3 | = audio | audio+16.6 ms | −16.6 ms | 16.7 / 16.7 |
| QA zone after climax 1 | ~82.16 | 82.16 | 82.17 | −3.7 ms (outside the frame) | 16.7 / 16.7 |
| build before drop 2 | 116.8–129.3 | = audio | audio+16.6 ms | −16.6 ms | 16.7 / 16.7 |
| drop 2 | 129.3–136 | = audio | audio+16.6 ms | −16.6 ms | 16.7 / 16.7 |
| tail | 175–181.7 | = audio | audio+16.6 ms | −16.6 ms | 16.7 / 16.7 |
| loop seam | wraps to ~0–8 | = audio (p99 0) | one frame to −50 ms, then −16.6 | — | 16.7 / 16.7 |

Whole-track same-frame clock (`currentTime − trackTime`): median 0, p90 0, p99 0 ms. Displayed light (`currentTime − musicTime`): median −16.6 ms, p90 −16.2 ms (the one-frame lead). QA-style reads outside the frame: median −2.7 ms, p90 −0.5 ms, worst 17 ms (was ~935 ms). Rendered kick vs timeline event: median 8 ms before the event on the audio clock at paint, which is the frame that then displays on the kick. Timeline vs detected onsets remains median −6 ms.

Follow-up after the 40 ms clamp, through drop 1 (58.5→66.5 s): clock gap min/med/max 0; light gap median −16.6 ms, worst −17.1 ms.

Mobile 390×844, cue through both climaxes (to 138 s): frame 16.7 / 16.7, clock median 0, outside light gap median −7.9 ms (worst −10 ms). At 64.9 / 82 / 129.4 s the outside gap was −9.7 / −8.8 / −5.9 ms.

`?lite=1`, cue through 98 s (includes drop 1 and the 82 s zone): same 16.7 ms frames, clock 0, outside gap median −0.8 ms, worst −13.4 ms.

15 s opening: autostart at 58.49 s (build), hard stop at 15.2 s wall / audio 73.35 s, reason `complete`, track = audio. 「▶ 重播聲光」 restarts at the cue. Language, theme, and the nav drawer still toggle. No page errors. 0 AudioContexts.

Real-ear phone verification was not done.
