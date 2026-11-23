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
//   0:52 the first build: lasers gather on the eyes of Infinity Nature
//   1:05 drop: the dark works glow like neon — lasers on the brushwork, LED light around the painting, an orbiting camera
//   1:38 a breath: Infinity Core, soft light and ribbons
//   1:57 the second build, 2:09 the second drop
//   2:40 the close: Eternal Sunshine in calm golden light; then it begins again
// Every work hangs as a precious object: a frame chosen for it, a picture light, light on the wall. The painting's face
// stays clean; the life is around it — LEDs dancing on the frame, light floating near and far — and only the drops
// bring the lasers onto the work.
const FRAME = (style, extra = {}) => ({ id: 'frame', p: { style, width: 0.03, wash: 0.6, halo: 'warm', lamp: true, music: true, ...extra } });
const BEAT_FRAME = (style) => FRAME(style, { halo: 'beat', lamp: false, wash: 0.75 });
// LEDs on the frame, dancing to the music: the painting's own colours (with taste); full rainbow only at the drops
const DANCE = { layout: 'frame', around: 'work', pattern: 'dance', colors: 'painting', count: 50, size: 4, glow: 0.45, speed: 0.6, bright: 0.72, sound: true, stage: 'with' };
const DROP = { ...DANCE, colors: 'rainbow', bright: 0.9, glow: 0.6, size: 5 };
// light floating near and far around the painting
const FLOAT = (drift, color = 'painting', count = 140) => ({ id: 'depth', p: { drift, color, count, speed: 0.3, glow: 0.65 } });

export const SHOWCASES = {
  eternal: {
    title: { zh: '盛明 · 永恆之光', en: 'Eternal · A Light Without End' },
    subtitle: { zh: 'AE Universe Creation · 13th Aurelia', en: 'AE Universe Creation · 13th Aurelia' },
    note: { zh: '外在沉靜，內在綻放', en: 'Outer Calm · Inner Bloom' },
    hang: 0.11, // works hang a little smaller, with room for the frame and its picture light
    settings: {
      mode: 'dream', music: 'eternal', volume: 0.85, intensity: 4, advance: 'auto', transition: 'random', interval: 14,
      effects: { innerbloom: true, lumiere: true, echo: true, breath: false, stardust: true, aurora: false, petals: false, lasers: false, neon: false },
      interact: { alive: true, tray: false, ripple: true, chime: false, lumi: false, seeds: true, cute: false, listen: false },
      display: { intro: true, captions: true, label: false, camera: false, mat: false, drift: false, shuffle: false, loop: true },
    },
    // works chosen for this show (13th Aurelia), beside the built-in ones
    works: [
      { id: 'sc-heart', src: 'assets/showcase/heart.webp', title: { en: 'Heart Reborn', zh: '' } },
      { id: 'sc-abundant-number', src: 'assets/showcase/abundant-number.webp', title: { en: 'Abundant Number', zh: '' } },
      { id: 'sc-infinity-nature', src: 'assets/showcase/infinity-nature.webp', title: { en: 'Infinity Nature', zh: '' } },
      { id: 'sc-infinity-core-flower', src: 'assets/showcase/infinity-core-flower.webp', title: { en: 'Infinity Core', zh: '' } },
      { id: 'sc-love-energy', src: 'assets/showcase/love-energy.webp', title: { en: 'Love Energy', zh: '' } },
      { id: 'sc-infinity-core-ribbons', src: 'assets/showcase/infinity-core-ribbons.webp', title: { en: 'Infinity Core', zh: '' } },
      { id: 'sc-eternal-sunshine', src: 'assets/showcase/eternal-sunshine.webp', title: { en: 'Eternal Sunshine', zh: '' } },
    ],
    // act 1: the room's sound plays the painting — the LEDs dance to every voice, clap and song in the room
    intro: {
      seconds: 40,
      hint: { zh: '對它說話、拍手、彈指 — 看它回應你', en: 'Speak, clap, snap — and watch it answer' },
      items: [
        { id: 'sc-heart', duration: 20, fx: [FRAME('gold'), { id: 'led', p: { ...DROP, bright: 0.95 } }, { id: 'laser', p: { colors: 'prism', hits: true, sun: true, bolts: true, beams: 5 } }, FLOAT('breathe')] },
        { id: 'sc-abundant-number', duration: 20, fx: [FRAME('black'), { id: 'led', p: { ...DROP, bright: 0.95 } }, { id: 'laser', p: { colors: 'prism', hits: true, sun: true, bolts: true, beams: 5 } }, FLOAT('toward')],
          tr: { id: 'zoom', p: { glow: true } }, cam: { id: 'cam-approach', p: {} } },
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
      // ---- intro: the signature work, gilded, under its picture light; heavenly light, light floating towards you ----
      { id: 'ae01', at: 0, fx: [FRAME('gold'), { id: 'light', p: { intensity: 0.55, rays: 6, tone: 'gold', sweep: true, every: 9 } }, FLOAT('toward', 'gold')],
        cam: { id: 'cam-approach', p: {} } },
      { id: 'sc-infinity-core-flower', at: 17, fx: [FRAME('white'), { id: 'ribbons', p: { count: 4, opacity: 0.7, color: 'painting' } }, FLOAT('breathe')],
        tr: { id: 'zoom', p: { glow: true } }, cam: { id: 'cam-gaze', p: {} } },
      { id: 'sc-love-energy', at: 33, fx: [FRAME('gold'), { id: 'led', p: DANCE }, { id: 'wind', p: { strength: 0.5, petals: 12, color: 'painting' } }, FLOAT('away')],
        tr: { id: 'fly', p: { depth: true } }, cam: { id: 'cam-tour', p: {} } },
      // ---- first build: the eyes in walnut; the wall light starts to change with the beat; the lasers gather ----
      { id: 'sc-infinity-nature', at: 51, fx: [BEAT_FRAME('walnut'), { id: 'led', p: DANCE }, { id: 'laser', p: { colors: 'prism', sun: true, beams: 4, power: 0.75 } }, FLOAT('breathe')],
        tr: { id: 'curtain', p: {} }, cam: { id: 'cam-gaze', p: {} } },
      // ---- first drop: a dark work in black lacquer — every laser, the frame's LEDs in full colour, light rushing at you ----
      { id: 'ae14', at: 61.2, fx: [BEAT_FRAME('black'), { id: 'led', p: DROP }, { id: 'laser', p: { colors: 'prism', sun: true, bolts: true, pools: true, beams: 8, power: 1 } }, FLOAT('toward', 'painting', 170)],
        tr: { id: 'zoom', p: { glow: true, duration: 1.4 } }, cam: { id: 'cam-orbit', p: {} } },
      { id: 'ae22', at: 80, fx: [BEAT_FRAME('black'), { id: 'led', p: DANCE }, { id: 'laser', p: { colors: 'prism', bolts: true, beams: 5 } }, { id: 'wind', p: { strength: 0.6, color: 'painting' } }],
        tr: { id: 'flip', p: {} }, cam: { id: 'cam-documentary', p: {} } },
      // ---- a breath: a white float frame under its lamp, ribbons, light drifting away ----
      { id: 'sc-infinity-core-ribbons', at: 97, fx: [FRAME('white'), { id: 'ribbons', p: { count: 4, color: 'painting' } }, FLOAT('away', 'gold')],
        tr: { id: 'fly', p: {} }, cam: { id: 'cam-approach', p: {} } },
      // ---- second build ----
      { id: 'ae08', at: 116, fx: [BEAT_FRAME('black'), { id: 'led', p: DANCE }, { id: 'laser', p: { colors: 'prism', sun: true, beams: 4, power: 0.75 } }, FLOAT('breathe')],
        tr: { id: 'curtain', p: {} }, cam: { id: 'cam-gaze', p: {} } },
      // ---- second drop ----
      { id: 'ae21', at: 125.7, fx: [BEAT_FRAME('black'), { id: 'led', p: DROP }, { id: 'laser', p: { colors: 'prism', sun: true, bolts: true, pools: true, beams: 8, power: 1 } }, FLOAT('toward', 'painting', 170)],
        tr: { id: 'zoom', p: { glow: true, duration: 1.4 } }, cam: { id: 'cam-orbit', p: {} } },
      { id: 'ae13', at: 145, fx: [FRAME('gold', { halo: 'beat' }), { id: 'led', p: DANCE }, { id: 'laser', p: { colors: 'painting', bolts: true, beams: 4 } }],
        tr: { id: 'flip', p: {} }, cam: { id: 'cam-documentary', p: {} } },
      // ---- the close: Eternal Sunshine, gilded, in calm golden light, light breathing near and far ----
      { id: 'sc-eternal-sunshine', at: 161, fx: [FRAME('gold'), { id: 'light', p: { intensity: 0.55, tone: 'gold', rays: 7, sweep: true, every: 10 } }, FLOAT('breathe', 'gold')],
        tr: { id: 'fly', p: { depth: true } }, cam: { id: 'cam-gaze', p: {} } },
    ],
  },
};
