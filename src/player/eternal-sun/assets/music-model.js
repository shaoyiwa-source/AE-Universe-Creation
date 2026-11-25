(function (root) {
  'use strict';

  // Canonical nanosecond arithmetic prevents 0.1 + 0.2 from creating a
  // microscopic, unintended boundary gap. This is a model precision, not an
  // assertion about browser/audio-device scheduling accuracy.
  const seconds = value => Number(value.toFixed(9));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function number(value, label, minimum = -Infinity, maximum = Infinity) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
      throw new TypeError(`${label} must be a finite number in [${minimum}, ${maximum}]`);
    }
    return value;
  }
  function identifier(value, label) {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a nonempty string`);
    return value;
  }
  const optional = (object, key, fallback) => object[key] === undefined ? fallback : object[key];

  function buildMusic(clips, assetsById, options = {}) {
    if (!Array.isArray(clips)) throw new TypeError('clips must be an array');
    if (!assetsById || typeof assetsById !== 'object' || Array.isArray(assetsById)) throw new TypeError('assetsById registry is required');
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('options must be an object');
    const offset = seconds(number(optional(options, 'offset', 0), 'offset', 0));
    let cursor = offset;
    const ids = new Set();
    // Build into new local storage. A rejected input cannot change the previous
    // model, registry, clips or partially publish a replacement schedule.
    const segments = clips.map((clip, index) => {
      if (!clip || typeof clip !== 'object' || Array.isArray(clip)) throw new TypeError(`clip ${index} must be an object`);
      const clipId = identifier(clip.id, `clip ${index} id`);
      if (ids.has(clipId)) throw new TypeError(`duplicate clip id: ${clipId}`);
      ids.add(clipId);
      const assetId = identifier(clip.assetId, `clip ${clipId} assetId`);
      if (!own(assetsById, assetId) || !assetsById[assetId] || typeof assetsById[assetId] !== 'object') throw new TypeError(`missing asset: ${assetId}`);
      const sourceDuration = number(assetsById[assetId].duration, `asset ${assetId} duration`, 0);
      if (sourceDuration <= 0) throw new TypeError(`asset ${assetId} duration must be positive`);
      const trimIn = number(optional(clip, 'trimIn', 0), `clip ${clipId} trimIn`, 0, sourceDuration);
      const trimOut = number(optional(clip, 'trimOut', sourceDuration), `clip ${clipId} trimOut`, 0, sourceDuration);
      if (trimOut <= trimIn) throw new TypeError(`clip ${clipId} trimOut must be greater than trimIn`);
      const duration = seconds(trimOut - trimIn);
      if (duration <= 0) throw new TypeError(`clip ${clipId} duration is below model time precision`);
      const gapBefore = seconds(number(optional(clip, 'gapBefore', 0), `clip ${clipId} gapBefore`, 0));
      const volume = number(optional(clip, 'volume', 1), `clip ${clipId} volume`, 0, 1);
      const analysisOffset = number(optional(clip, 'analysisOffset', 0), `clip ${clipId} analysisOffset`);
      const start = seconds(number(cursor + gapBefore, `clip ${clipId} start`, 0));
      const end = seconds(number(start + duration, `clip ${clipId} end`, 0));
      if (end <= start) throw new TypeError(`clip ${clipId} time range cannot be represented`);
      cursor = end;
      return Object.freeze({ index, clipId, assetId, sourceDuration, trimIn, trimOut, duration, gapBefore, volume, analysisOffset, start, end });
    });
    return Object.freeze({ segments: Object.freeze(segments), offset, total: segments.length ? cursor : 0 });
  }

  function locateMusic(model, programTime) {
    const time = number(programTime, 'programTime');
    if (!model || !Array.isArray(model.segments)) throw new TypeError('model must be produced by buildMusic');
    const segments = model.segments;
    let active = null, next = null, phase = 'ended';
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      if (time < segment.start) { next = segment; phase = index === 0 ? 'before' : 'gap'; break; }
      if (time < segment.end) { active = segment; next = segments[index + 1] || null; phase = 'active'; break; }
    }
    if (!active) return Object.freeze({ phase, index: -1, segment: null, clipId: null, assetId: null, sourceTime: null, elapsed: null, remaining: 0, next, ended: phase === 'ended' });
    const elapsed = Math.max(0, time - active.start);
    // Never return source time beyond the validated trim, including fractional
    // source durations that are not exact decimal model boundaries.
    const sourceTime = Math.min(active.trimOut, Math.max(active.trimIn, seconds(active.trimIn + elapsed)));
    return Object.freeze({ phase, index: active.index, segment: active, clipId: active.clipId, assetId: active.assetId, sourceTime, elapsed: seconds(elapsed), remaining: Math.max(0, seconds(active.end - time)), next, ended: false });
  }

  function createClockAnchor({ programTime, contextTime, rate = 1 } = {}) {
    number(programTime, 'programTime', 0); number(contextTime, 'contextTime', 0); number(rate, 'rate', 0);
    if (rate <= 0) throw new TypeError('rate must be positive');
    return Object.freeze({ programTime, contextTime, rate });
  }
  function validateAnchor(anchor) {
    if (!anchor || typeof anchor !== 'object') throw new TypeError('clock anchor is required');
    number(anchor.programTime, 'anchor.programTime', 0); number(anchor.contextTime, 'anchor.contextTime', 0); number(anchor.rate, 'anchor.rate', 0);
    if (anchor.rate <= 0) throw new TypeError('anchor.rate must be positive');
  }
  function programTimeAt(anchor, contextTime) {
    validateAnchor(anchor); number(contextTime, 'contextTime');
    return seconds(number(anchor.programTime + (contextTime - anchor.contextTime) * anchor.rate, 'mapped programTime'));
  }
  function contextTimeAt(anchor, programTime) {
    validateAnchor(anchor); number(programTime, 'programTime');
    return seconds(number(anchor.contextTime + (programTime - anchor.programTime) / anchor.rate, 'mapped contextTime'));
  }

  const api = Object.freeze({ buildMusic, locateMusic, createClockAnchor, programTimeAt, contextTimeAt });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ArtMusicModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
