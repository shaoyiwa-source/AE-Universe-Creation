const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_RE = /^LP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
const HAND_RE = /^h[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;
const SYMBOLS = ['♥', '∞', '☾', '✦', '❀', '☁', '◌', '⌁'];
const MARK_RE = /^m[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
const FRESH_MS = 10000;
const MAX_MARKS = 40;
const MAX_HANDS = 6;

const memory = new Map();
let cacheClient;

function blobReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID));
}

function cache() {
  if (cacheClient !== undefined) return cacheClient;
  try {
    const { getCache } = require('@vercel/functions');
    cacheClient = getCache({ namespace: 'ae-together' });
  } catch (error) {
    cacheClient = null;
  }
  return cacheClient;
}

function emptyRoom(code) {
  return { code, hands: {}, marks: [], rev: 0 };
}

function mergeRooms(a, b) {
  if (!a) return b ? { ...b, hands: { ...(b.hands || {}) }, marks: [...(b.marks || [])] } : null;
  if (!b) return { ...a, hands: { ...(a.hands || {}) }, marks: [...(a.marks || [])] };
  const hands = { ...(a.hands || {}) };
  for (const [id, seen] of Object.entries(b.hands || {})) {
    hands[id] = Math.max(hands[id] || 0, seen || 0);
  }
  const marks = new Map();
  for (const mark of [...(a.marks || []), ...(b.marks || [])]) {
    if (mark && mark.id) marks.set(mark.id, mark);
  }
  return {
    code: a.code || b.code,
    hands,
    marks: [...marks.values()].slice(-MAX_MARKS),
    rev: Math.max(a.rev || 0, b.rev || 0),
  };
}

async function readBlob(code) {
  if (!blobReady()) return null;
  try {
    const { get } = await import('@vercel/blob');
    const result = await get(`ae-together/${code}.json`, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

async function writeBlob(room) {
  if (!blobReady()) return false;
  try {
    const { put } = await import('@vercel/blob');
    await put(`ae-together/${room.code}.json`, JSON.stringify(room), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function readCache(code) {
  const client = cache();
  if (!client) return null;
  try {
    return (await client.get(code)) || null;
  } catch (error) {
    return null;
  }
}

async function writeCache(room) {
  const client = cache();
  if (!client) return false;
  try {
    await client.set(room.code, room, { ttl: 60 * 30, tags: ['ae-together'] });
    return true;
  } catch (error) {
    return false;
  }
}

async function readRoom(code) {
  const merged = mergeRooms(mergeRooms(memory.get(code), await readCache(code)), await readBlob(code));
  return merged || emptyRoom(code);
}

async function writeRoom(room) {
  const current = mergeRooms(await readRoom(room.code), room);
  current.rev = Math.max(current.rev || 0, room.rev || 0);
  memory.set(current.code, current);
  const cacheOk = await writeCache(current);
  const blobOk = await writeBlob(current);
  return { room: current, shared: cacheOk || blobOk };
}

function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).json(body);
}

function view(room, hand, shared) {
  const now = Date.now();
  const others = Object.entries(room.hands || {}).filter(([id, seen]) => id !== hand && now - seen < FRESH_MS).length;
  return {
    code: room.code,
    shared: Boolean(shared),
    others,
    marks: (room.marks || []).map((mark) => ({
      id: mark.id,
      art: mark.art,
      symbol: mark.symbol,
      yours: mark.hand === hand,
    })),
  };
}

function touch(room, hand) {
  const now = Date.now();
  const ids = Object.keys(room.hands || {});
  if (!room.hands[hand] && ids.length >= MAX_HANDS) return false;
  room.hands[hand] = now;
  for (const id of ids) {
    if (now - room.hands[id] > 10 * 60 * 1000) delete room.hands[id];
  }
  return true;
}

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const code = String(req.query.code || '');
      const hand = String(req.query.hand || '');
      if (!CODE_RE.test(code) || !HAND_RE.test(hand)) return send(res, 400, { error: 'BAD_ROOM' });
      let room = await readRoom(code);
      const prev = room.hands[hand] || 0;
      if (!touch(room, hand)) return send(res, 429, { error: 'ROOM_FULL' });
      if (Date.now() - prev < 3000) return send(res, 200, view(room, hand, Boolean(blobReady() || cache())));
      room.rev = (room.rev || 0) + 1;
      const saved = await writeRoom(room);
      return send(res, 200, view(saved.room, hand, saved.shared));
    }
    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const code = String(body.code || '');
      const hand = String(body.hand || '');
      const art = Number(body.art);
      const symbol = String(body.symbol || '');
      const id = String(body.id || '');
      if (!CODE_RE.test(code) || !HAND_RE.test(hand) || !MARK_RE.test(id)) return send(res, 400, { error: 'BAD_ROOM' });
      if (!Number.isInteger(art) || art < 0 || art > 8 || !SYMBOLS.includes(symbol)) return send(res, 400, { error: 'BAD_MARK' });
      let room = await readRoom(code);
      if (!touch(room, hand)) return send(res, 429, { error: 'ROOM_FULL' });
      if (!room.marks.some((mark) => mark.id === id)) {
        room.marks.push({ id, hand, art, symbol, at: Date.now() });
        room.marks = room.marks.slice(-MAX_MARKS);
      }
      room.rev = (room.rev || 0) + 1;
      const saved = await writeRoom(room);
      const seen = saved.room.marks.some((mark) => mark.id === id);
      if (!seen) {
        saved.room.marks.push({ id, hand, art, symbol, at: Date.now() });
        saved.room.marks = saved.room.marks.slice(-MAX_MARKS);
        const again = await writeRoom(saved.room);
        return send(res, 200, view(again.room, hand, again.shared));
      }
      return send(res, 200, view(saved.room, hand, saved.shared));
    }
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    console.error('together', error && error.message);
    return send(res, 500, { error: 'TOGETHER_FAILED' });
  }
}

module.exports = handler;
module.exports.ALPHABET = ALPHABET;
module.exports._memory = memory;
module.exports._reset = () => memory.clear();
