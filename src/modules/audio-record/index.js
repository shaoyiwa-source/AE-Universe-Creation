// AE 共用模組：錄音（audio-record）
// 麥克風錄音、去頭尾靜音、變聲效果、輸出 WAV、播放。
// 不碰任何畫面；UI 由使用的頁面自己做。說明見同資料夾的 README.md。

/** 變聲效果清單（id 不要改，頁面會存起來） */
export const VOICE_EFFECTS = [
  { id: 'original', zh: '原聲', en: 'Original' },
  { id: 'chipmunk', zh: '小松鼠', en: 'Chipmunk' },
  { id: 'baby', zh: '小寶寶', en: 'Baby' },
  { id: 'monster', zh: '大怪獸', en: 'Monster' },
  { id: 'robot', zh: '機器人', en: 'Robot' },
  { id: 'echo', zh: '山谷回音', en: 'Echo' },
];

const AC = () => window.AudioContext || window.webkitAudioContext;
const OAC = () => window.OfflineAudioContext || window.webkitOfflineAudioContext;

/** 這個瀏覽器能不能錄音（需要 https） */
export function isRecordingSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && AC());
}

function pickMime() {
  const list = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  return list.find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
}

/**
 * 建立錄音器。
 * @param {{ maxSeconds?: number, onTick?: (seconds:number)=>void }} opts
 * @returns {{ start: () => Promise<void>, stop: () => Promise<Blob>, cancel: () => void, readonly recording: boolean }}
 */
export function createRecorder({ maxSeconds = 15, onTick } = {}) {
  let stream = null, rec = null, chunks = [], timer = null, startedAt = 0, done = null, prevSession = null;
  const cleanup = () => {
    clearInterval(timer); timer = null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    // iOS：錄完把音訊模式切回「播放」，聲音才會從喇叭出來、音量正常
    try { if (navigator.audioSession && prevSession) navigator.audioSession.type = prevSession; } catch (e) { /* ignore */ }
  };
  return {
    get recording() { return !!rec && rec.state === 'recording'; },
    async start() {
      if (rec && rec.state === 'recording') return;
      try {
        if (navigator.audioSession) { prevSession = navigator.audioSession.type || 'auto'; navigator.audioSession.type = 'play-and-record'; }
      } catch (e) { /* ignore */ }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = pickMime();
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      done = new Promise((resolve) => {
        rec.onstop = () => { cleanup(); resolve(new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] })); };
      });
      rec.start(200);
      startedAt = performance.now();
      timer = setInterval(() => {
        const s = (performance.now() - startedAt) / 1000;
        if (onTick) onTick(s);
        if (s >= maxSeconds && rec.state === 'recording') rec.stop();
      }, 200);
    },
    stop() {
      if (rec && rec.state === 'recording') rec.stop();
      return done || Promise.resolve(new Blob());
    },
    cancel() {
      if (rec && rec.state === 'recording') { rec.onstop = () => cleanup(); rec.stop(); } else cleanup();
    },
  };
}

/** Blob（錄音或音檔）→ AudioBuffer */
export async function decodeAudio(blob, context) {
  const ctx = context || new (AC())();
  const data = await blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);
    if (p && p.then) p.then(resolve, reject);
  });
}

/** 去掉開頭與結尾的靜音（讓點擊音效馬上出聲） */
export function trimSilence(buffer, { threshold = 0.02, padSeconds = 0.04 } = {}) {
  const ch = buffer.getChannelData(0);
  let a = 0, b = ch.length - 1;
  while (a < b && Math.abs(ch[a]) < threshold) a++;
  while (b > a && Math.abs(ch[b]) < threshold) b--;
  const pad = Math.floor(padSeconds * buffer.sampleRate);
  a = Math.max(0, a - pad); b = Math.min(ch.length - 1, b + pad);
  if (b - a < buffer.sampleRate * 0.05) return buffer;
  const out = new (OAC())(buffer.numberOfChannels, b - a + 1, buffer.sampleRate).createBuffer(buffer.numberOfChannels, b - a + 1, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) out.getChannelData(c).set(buffer.getChannelData(c).subarray(a, b + 1));
  return out;
}

/**
 * 套用變聲效果，回傳新的 AudioBuffer（原本的不會被改）。
 * @param {AudioBuffer} buffer
 * @param {string} effectId VOICE_EFFECTS 的 id
 */
export async function applyVoiceEffect(buffer, effectId = 'original') {
  if (effectId === 'original') return buffer;
  const rate = { chipmunk: 1.7, baby: 1.35, monster: 0.68 }[effectId] || 1;
  const tail = effectId === 'echo' ? 1.6 : 0.1;
  const len = Math.ceil((buffer.duration / rate + tail) * buffer.sampleRate);
  const ctx = new (OAC())(1, len, buffer.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  let node = src;
  const chain = (n) => { node.connect(n); node = n; return n; };

  if (effectId === 'chipmunk' || effectId === 'baby') {
    const hs = chain(ctx.createBiquadFilter());
    hs.type = 'highshelf'; hs.frequency.value = 3000; hs.gain.value = effectId === 'baby' ? 3 : 5;
  } else if (effectId === 'monster') {
    const ls = chain(ctx.createBiquadFilter());
    ls.type = 'lowshelf'; ls.frequency.value = 250; ls.gain.value = 6;
  } else if (effectId === 'robot') {
    // 環形調變＋短延遲，做出金屬感
    const rm = chain(ctx.createGain());
    rm.gain.value = 0;
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 55;
    osc.connect(rm.gain);
    osc.start();
    const dry = ctx.createGain(); dry.gain.value = 0.7;
    const d = ctx.createDelay(0.05); d.delayTime.value = 0.012;
    const fb = ctx.createGain(); fb.gain.value = 0.5;
    rm.connect(dry); rm.connect(d); d.connect(fb); fb.connect(d); d.connect(dry);
    node = dry;
  } else if (effectId === 'echo') {
    const out = ctx.createGain();
    const d = ctx.createDelay(1); d.delayTime.value = 0.28;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    node.connect(out); node.connect(d); d.connect(fb); fb.connect(d); d.connect(out);
    node = out;
  }
  // 最後壓一下，避免破音
  const comp = chain(ctx.createDynamicsCompressor());
  comp.threshold.value = -14; comp.ratio.value = 4;
  node.connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}

/** AudioBuffer → WAV 檔（每台裝置都能播） */
export function toWav(buffer) {
  const ch = Math.min(2, buffer.numberOfChannels), sr = buffer.sampleRate, n = buffer.length;
  const view = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true);
  view.setUint32(24, sr, true); view.setUint32(28, sr * ch * 2, true); view.setUint16(32, ch * 2, true);
  view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

/**
 * 播放 AudioBuffer。
 * @param {AudioBuffer} buffer
 * @param {{ context: AudioContext, destination?: AudioNode, gain?: number }} opts
 */
export function playBuffer(buffer, { context, destination, gain = 1 }) {
  const src = context.createBufferSource();
  src.buffer = buffer;
  const g = context.createGain();
  g.gain.value = gain;
  src.connect(g); g.connect(destination || context.destination);
  src.start();
  return src;
}
