(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./music-model.js'));
  else root.ArtMusicTransport = factory(root.ArtMusicModel);
})(typeof window !== 'undefined' ? window : globalThis, function (Model) {
  'use strict';
  const DEFAULT_MEMORY_BYTES = 128 * 1024 * 1024;
  const DEFAULT_MAX_CLIPS = 16;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function finite(value, label, min = -Infinity, max = Infinity) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new TypeError(`${label} must be finite and within ${min}–${max}`);
    return value;
  }
  function create({ context, onError = () => {}, memoryBudgetBytes = DEFAULT_MEMORY_BYTES, maxClips = DEFAULT_MAX_CLIPS, leadSeconds = .03 } = {}) {
    if (!Model) throw new Error('ArtMusicModel must load before ArtMusicTransport');
    if (!context || !['createGain','createAnalyser','createBufferSource','resume'].every(key => typeof context[key] === 'function') || !context.destination) throw new TypeError('A provided AudioContext is required');
    finite(context.currentTime, 'context.currentTime', 0); finite(memoryBudgetBytes, 'memoryBudgetBytes', 1); finite(maxClips, 'maxClips', 1); finite(leadSeconds, 'leadSeconds', 0, 1);
    if (!Number.isInteger(maxClips)) throw new TypeError('maxClips must be an integer');
    if (typeof onError !== 'function') throw new TypeError('onError must be a function');
    const masterGain = context.createGain(), analyser = context.createAnalyser();
    analyser.fftSize = 1024; analyser.smoothingTimeConstant = .82;
    masterGain.connect(analyser); analyser.connect(context.destination);
    let program = null, buffers = new Map(), memoryBytes = 0;
    let anchor = null, position = 0, playing = false, starting = false, disposed = false, generation = 0, volume = 1, muted = false;
    const nodes = new Set();
    function usable() { if (disposed) throw new Error('Music transport is disposed'); }
    function report(error) { try { onError(error); } catch {} }
    function currentTime() {
      if (!playing || !anchor) return position;
      return Math.max(position, Model.programTimeAt(anchor, finite(context.currentTime, 'context.currentTime', 0)));
    }
    function release(record, stop) {
      // Each closure owns only its own nodes; stale onended cannot detach a
      // newly scheduled generation's nodes or reset the program clock.
      if (record.released) return;
      record.released = true;
      if (stop) try { record.source.stop(); } catch {}
      try { record.source.disconnect(); } catch {}
      try { record.gain.disconnect(); } catch {}
      nodes.delete(record);
    }
    function stopNodes() { for (const record of [...nodes]) release(record, true); }
    function pause() {
      usable(); position = currentTime(); playing = false; starting = false; anchor = null; generation++; stopNodes(); return position;
    }
    function readBuffer(registry, assetId) {
      if (registry instanceof Map) return registry.get(assetId);
      return registry && typeof registry === 'object' && own(registry, assetId) ? registry[assetId] : undefined;
    }
    function validateProgram(model, decodedAssets) {
      if (!model || !Array.isArray(model.segments)) throw new TypeError('A music model is required');
      if (model.segments.length > maxClips) throw new RangeError(`Program exceeds ${maxClips} clips`);
      finite(model.total, 'model.total', 0);
      const copies = [], retained = new Map(), unique = new Set(), ids = new Set();
      let bytes = 0, previousEnd = 0;
      for (let index = 0; index < model.segments.length; index++) {
        const segment = model.segments[index];
        if (!segment || typeof segment.clipId !== 'string' || !segment.clipId || typeof segment.assetId !== 'string' || !segment.assetId) throw new TypeError('Invalid clip identity');
        if (ids.has(segment.clipId)) throw new TypeError('Duplicate clip identity'); ids.add(segment.clipId);
        for (const key of ['start','end','trimIn','trimOut']) finite(segment[key], `clip.${key}`, 0);
        finite(segment.volume, 'clip.volume', 0, 1);
        if (segment.start < previousEnd || segment.end <= segment.start || segment.trimOut <= segment.trimIn || Math.abs((segment.end - segment.start) - (segment.trimOut - segment.trimIn)) > 1e-7) throw new TypeError('Invalid clip time range or overlap');
        const buffer = readBuffer(decodedAssets, segment.assetId);
        if (!buffer || typeof buffer.getChannelData !== 'function') throw new TypeError(`Missing decoded buffer: ${segment.assetId}`);
        finite(buffer.duration, 'buffer.duration', Number.MIN_VALUE); finite(buffer.sampleRate, 'buffer.sampleRate', Number.MIN_VALUE);
        finite(buffer.length, 'buffer.length', 1); finite(buffer.numberOfChannels, 'buffer.numberOfChannels', 1);
        if (!Number.isInteger(buffer.length) || !Number.isInteger(buffer.numberOfChannels) || Math.abs(buffer.length / buffer.sampleRate - buffer.duration) > 1 / buffer.sampleRate + 1e-9) throw new TypeError('Invalid decoded buffer metadata');
        if (segment.trimOut > buffer.duration + 1e-9) throw new RangeError(`Clip trim exceeds decoded buffer duration: ${segment.clipId}`);
        if (!unique.has(buffer)) {
          const size = buffer.length * buffer.numberOfChannels * 4;
          finite(size, 'decoded memory size', 0); bytes += size;
          if (!Number.isSafeInteger(bytes) || bytes > memoryBudgetBytes) throw new RangeError(`Decoded buffer memory exceeds ${memoryBudgetBytes} bytes`);
          unique.add(buffer);
        }
        retained.set(segment.assetId, buffer); previousEnd = segment.end;
        copies.push(Object.freeze({ ...segment, index }));
      }
      if (Math.abs(model.total - previousEnd) > 1e-7) throw new TypeError('Program total does not match final clip end');
      return { model: Object.freeze({ ...model, segments: Object.freeze(copies) }), retained, bytes };
    }
    function setProgram(model, decodedAssets) {
      usable(); const valid = validateProgram(model, decodedAssets);
      // No side effects until every segment, source and budget check succeeds.
      pause(); program = valid.model; buffers = valid.retained; memoryBytes = valid.bytes; return getState();
    }
    async function play(programTime = currentTime()) {
      usable(); finite(programTime, 'programTime', 0);
      if (!program) throw new Error('Set a validated music program before playback');
      pause(); position = programTime; starting = true; const token = generation;
      try {
        await context.resume();
        if (disposed || token !== generation) return false;
        if (context.state !== 'running') throw new Error('AudioContext did not enter running state');
        // Prepare all remaining source/gain nodes before choosing the shared
        // anchor. Starting the next song never waits for onended or an rAF tick.
        const staged = [];
        for (const segment of program.segments) {
          if (segment.end <= programTime) continue;
          const source = context.createBufferSource(), gain = context.createGain();
          const record = { source, gain, released: false, segment };
          nodes.add(record); staged.push(record);
          source.buffer = buffers.get(segment.assetId); source.playbackRate.value = 1;
          gain.gain.value = segment.volume; source.connect(gain); gain.connect(masterGain);
          source.onended = () => release(record, false);
        }
        anchor = Model.createClockAnchor({ programTime, contextTime: context.currentTime + leadSeconds });
        for (const record of staged) {
          const segment = record.segment, begins = Math.max(programTime, segment.start);
          const sourceOffset = segment.trimIn + Math.max(0, programTime - segment.start);
          const sourceDuration = segment.trimOut - sourceOffset;
          record.source.start(Model.contextTimeAt(anchor, begins), sourceOffset, sourceDuration);
        }
        starting = false; playing = true; return true;
      } catch (error) {
        if (disposed || token !== generation) return false;
        playing = false; starting = false; anchor = null; generation++; stopNodes(); report(error); throw error;
      }
    }
    async function seek(programTime) {
      usable(); finite(programTime, 'programTime', 0);
      const resume = playing || starting;
      if (resume) return play(programTime);
      pause(); position = programTime; return false;
    }
    function locate() { return program ? Model.locateMusic(program, currentTime()) : null; }
    function getState() {
      const time = currentTime();
      return Object.freeze({ phase: disposed ? 'disposed' : starting ? 'starting' : playing ? 'playing' : program ? 'paused' : 'empty', playing, starting, programTime: time, active: program ? Model.locateMusic(program, time) : null, volume, muted, memoryBytes, nodeCount: nodes.size, generation });
    }
    function updateGain() { masterGain.gain.setValueAtTime(muted ? 0 : volume, context.currentTime); }
    function setVolume(value) { usable(); volume = finite(value, 'volume', 0, 1); updateGain(); }
    function setMuted(value) { usable(); if (typeof value !== 'boolean') throw new TypeError('muted must be boolean'); muted = value; updateGain(); }
    function destroy() {
      if (disposed) return;
      pause(); disposed = true; buffers.clear(); program = null; memoryBytes = 0;
      try { masterGain.disconnect(); } catch {} try { analyser.disconnect(); } catch {}
      // The caller owns and closes the provided AudioContext.
    }
    return Object.freeze({ setProgram, play, pause, seek, currentTime, locate, getState, setVolume, setMuted, destroy, analyser, masterGain });
  }
  return Object.freeze({ create, DEFAULT_MEMORY_BYTES, DEFAULT_MAX_CLIPS });
});
