// AE Lumina Wall — showcases: AE's finished shows, opened at /gallery?showcase=<name> (or /showcase).
// One tap, then the performance: no settings, no studio, no buttons. Each work carries its own choreography
// (effects, camera, transition) and the soundtrack's big moments fire bursts of light.
//
// "eternal" — 盛明 · Eternal, in two acts
// Act 1 — the room speaks (about 40 s, no music, the microphone listens): any sound — a voice, a clap, a snap, a knock —
//   lifts the painting from dim and soft to bright, saturated and contrasty, flashes the lasers, fills the LED meter
//   around the work and throws a burst of light. The louder, the bigger.
// Act 2 — the stage show: a three-minute arc on the theme track (148 BPM, ~181.6 s)
// Each work changes on the music's own clock (`at`, seconds into the track); the drops land on the dark works.
// The track starts at its cue (58.3 s, like the homepage show): the title card, the end of the first build, and the
// first drop about 6 seconds into act 2; then the whole arc follows and loops.
//   0:00 intro: the signature work wakes up in heavenly light, the camera walks in from afar
//   0:52 the first build: lasers gather on Marvellous Energy World
//   1:05 drop: the dark works glow like neon — lasers on the brushwork, LED light around the painting, an orbiting camera
//   1:38 a breath: love, soft light and ribbons
//   1:57 the second build, 2:09 the second drop
//   2:40 the close: Love Embrace in calm light; then it begins again
const DARK_LED = { layout: 'frame', around: 'work', pattern: 'rainbow', colors: 'painting', count: 46, size: 5, glow: 0.55, speed: 0.7, bright: 0.8, sound: true, stage: 'with' };

export const SHOWCASES = {
  eternal: {
    title: { zh: '盛明 · 永恆之光', en: 'Eternal · A Light Without End' },
    subtitle: { zh: 'AE Universe Creation · 13th Aurelia', en: 'AE Universe Creation · 13th Aurelia' },
    note: { zh: '外在沉靜，內在綻放', en: 'Outer Calm · Inner Bloom' },
    settings: {
      mode: 'dream', music: 'eternal', volume: 0.85, intensity: 4, advance: 'auto', transition: 'random', interval: 14,
      effects: { innerbloom: true, lumiere: true, echo: true, breath: false, stardust: true, aurora: true, petals: false, lasers: false, neon: false },
      interact: { alive: true, tray: false, ripple: true, chime: false, lumi: false, seeds: true, cute: false, listen: false },
      display: { intro: true, captions: true, label: false, camera: false, mat: false, drift: false, shuffle: false, loop: true },
    },
    // act 1: the room's sound plays the painting
    intro: {
      seconds: 40,
      hint: { zh: '對它說話、拍手、彈指 — 看它回應你', en: 'Speak, clap, snap — and watch it answer' },
      items: [
        { id: 'ae07', duration: 20, fx: [{ id: 'laser', p: { colors: 'prism', hits: true, sun: true, bolts: true } }, { id: 'led', p: { layout: 'frame', around: 'work', pattern: 'meter', colors: 'rainbow', count: 40, size: 6, glow: 0.7, speed: 1, bright: 0.95, sound: true, stage: 'with' } }, { id: 'ribbons', p: { count: 4, color: 'rainbow' } }] },
        { id: 'ae09', duration: 20, fx: [{ id: 'laser', p: { colors: 'prism', hits: true, sun: true, bolts: true } }, { id: 'led', p: { layout: 'frame', around: 'work', pattern: 'meter', colors: 'rainbow', count: 40, size: 6, glow: 0.7, speed: 1, bright: 0.95, sound: true, stage: 'with' } }, { id: 'wind', p: { strength: 0.6, petals: 14, color: 'painting' } }],
          tr: { id: 'zoom', p: { glow: true } } },
      ],
    },
    trackLength: 181.6,
    startAt: 58.3, // the track's own cue (see audio.js)
    // the soundtrack's drops: a burst of light at the exact moment
    moments: [
      { at: 64.87, fire: ['glow', 'sweep'] },
      { at: 129.38, fire: ['glow', 'sweep', 'coins'] },
    ],
    items: [
      // ---- intro ----
      { id: 'ae01', at: 0, fx: [{ id: 'light', p: { intensity: 0.75, rays: 6, tone: 'gold', sweep: true, every: 8 } }, { id: 'wind', p: { strength: 0.35, petals: 12, color: 'painting' } }],
        cam: { id: 'cam-approach', p: {} } },
      { id: 'ae02', at: 17, fx: [{ id: 'ribbons', p: { count: 5, opacity: 0.8, color: 'painting' } }, { id: 'light', p: { intensity: 0.5, tone: 'white' } }],
        tr: { id: 'zoom', p: { glow: true } }, cam: { id: 'cam-gaze', p: {} } },
      { id: 'ae20', at: 33, fx: [{ id: 'wind', p: { strength: 0.6, petals: 16, color: 'painting' } }, { id: 'ribbons', p: { count: 4, color: 'painting' } }],
        tr: { id: 'fly', p: { depth: true } }, cam: { id: 'cam-tour', p: {} } },
      // ---- first build ----
      { id: 'ae16', at: 51, fx: [{ id: 'laser', p: { colors: 'prism', sun: true } }, { id: 'light', p: { intensity: 0.45, sweep: true, every: 5 } }],
        tr: { id: 'curtain', p: {} }, cam: { id: 'cam-gaze', p: {} } },
      // ---- first drop: the dark works glow ----
      { id: 'ae14', at: 61.2, fx: [{ id: 'laser', p: { colors: 'prism', sun: true, bolts: true, pools: true, beams: 8, power: 1 } }, { id: 'led', p: DARK_LED }, { id: 'ribbons', p: { count: 3, color: 'painting' } }],
        tr: { id: 'zoom', p: { glow: true, duration: 1.4 } }, cam: { id: 'cam-orbit', p: {} } },
      { id: 'ae22', at: 80, fx: [{ id: 'laser', p: { colors: 'prism', bolts: true } }, { id: 'led', p: { ...DARK_LED, pattern: 'chase' } }, { id: 'wind', p: { strength: 0.7, color: 'painting' } }],
        tr: { id: 'flip', p: {} }, cam: { id: 'cam-documentary', p: {} } },
      // ---- a breath ----
      { id: 'ae12', at: 97, fx: [{ id: 'light', p: { intensity: 0.6, tone: 'gold', sweep: true } }, { id: 'ribbons', p: { count: 4, color: 'painting' } }],
        tr: { id: 'fly', p: {} }, cam: { id: 'cam-approach', p: {} } },
      // ---- second build ----
      { id: 'ae08', at: 116, fx: [{ id: 'laser', p: { colors: 'prism', sun: true } }, { id: 'led', p: { ...DARK_LED, pattern: 'twinkle' } }],
        tr: { id: 'curtain', p: {} }, cam: { id: 'cam-gaze', p: {} } },
      // ---- second drop ----
      { id: 'ae21', at: 125.7, fx: [{ id: 'laser', p: { colors: 'prism', sun: true, bolts: true, pools: true, beams: 8, power: 1 } }, { id: 'led', p: DARK_LED }, { id: 'wind', p: { strength: 0.5, color: 'painting' } }],
        tr: { id: 'zoom', p: { glow: true, duration: 1.4 } }, cam: { id: 'cam-orbit', p: {} } },
      { id: 'ae13', at: 145, fx: [{ id: 'laser', p: { colors: 'painting', bolts: true } }, { id: 'ribbons', p: { count: 5, color: 'painting' } }],
        tr: { id: 'flip', p: {} }, cam: { id: 'cam-documentary', p: {} } },
      // ---- the close ----
      { id: 'ae11', at: 161, fx: [{ id: 'light', p: { intensity: 0.7, tone: 'gold', rays: 7, sweep: true, every: 10 } }, { id: 'wind', p: { strength: 0.3, petals: 12, color: 'painting' } }],
        tr: { id: 'fly', p: { depth: true } }, cam: { id: 'cam-gaze', p: {} } },
    ],
  },
};
