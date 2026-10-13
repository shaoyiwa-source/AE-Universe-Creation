# AE-HOME-SOUNDLIGHT-15S-20261014-0730 — homepage 15 s sound-and-light opening (Preview only)

- Base: `cursor/fix-soulcard-touchmoment` @ 82629a1 (newest homepage with "Hand-painted art. Digital sensation.", v2475.8; contains a9e302e preview/20261013-fullsite-card-lang).
- Source prototype: `AE_Feel_the_Flow_Interactive_Preview.html` (sha256 e4a6ecfb9d7343fa2d04b6a21a8b8e97a5b9a04429f8541b9fdaf8d8fe2a14a9).
  - Its embedded JPEG (997,091 bytes, sha256 5df21a98…7e95, 1110×1536) is byte-identical to `src/assets/eternal-sun-canonical-1110x1536.jpg`, which the homepage hero already uses; it is committed here unchanged (no re-encode) instead of inlining 1.3 MB.
  - Light (sun glow, pulsing ellipse ring, corner lasers, beat specks) and WebAudio rhythm (112 BPM sine kick + triangle bass 55/65.41/73.42/49 Hz) are reused from the prototype in `src/ae-home-opening.js`.
- One clock: `AudioContext.currentTime` (minus output latency for the light) when sound runs; `performance.now()` when the browser blocks sound. Hard stop at 15.0 s (rAF cancelled, scheduler cleared, oscillators stopped, AudioContext suspended, canvas cleared).
- Autoplay blocked → light runs alone + side button「🔊 點一下開啟聲音」; tap restarts the 15 s from 0 with sound + light together.
- After the end → side button「▶ 重播聲光」+「想再感受一次？點這裡重播聲光」(EN: "▶ Replay light & sound" / "Want to feel it again? Tap here to replay").
- `prefers-reduced-motion`: no automatic opening; replay button offered, gentle glow only.
- `?opening=off` skips the automatic opening (QA / other agents).
- The opening yields if the visitor starts the existing ♫ music dock, and pauses the dock music when the opening/replay starts.
- Production: not touched.
