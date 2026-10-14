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
