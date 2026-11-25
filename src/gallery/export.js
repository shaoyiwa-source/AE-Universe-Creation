// AE Shinity — export an exhibition as a single, self-contained player file (客戶版 / NFT 版).
// Studio-only: loaded with import() from app.js. The output needs no server and makes no network requests.
const MODULES = ['store', 'beats-eternal', 'audio', 'fx', 'transitions', 'i18n', 'recorder', 'listen', 'alive', 'pack-wind', 'pack-light', 'pack-ribbons', 'pack-fly', 'pack-flip', 'pack-zoom', 'pack-curtain', 'pack-laser', 'pack-led', 'pack-depth', 'pack-frame', 'pack-cam-approach', 'pack-cam-tour', 'pack-cam-orbit', 'pack-cam-documentary', 'pack-cam-gaze', 'pack-glow', 'pack-coins', 'pack-sweep', 'packs', 'app']; // dependency order

const timeout = (ms) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
async function text(url, ms = 20000) { const r = await fetch(url, { cache: 'no-store', signal: timeout(ms) }); if (!r.ok) throw new Error(`${url} ${r.status}`); return r.text(); }
function blobToDataURL(b) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); }); }
async function urlToDataURL(url, ms = 60000) { const r = await fetch(url, { signal: timeout(ms) }); if (!r.ok) throw new Error(`${url} ${r.status}`); return blobToDataURL(await r.blob()); }
function canvasBlob(c, type, q) { return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encode')), type, q)); }

async function encodeImage(src, maxSide, quality) {
  const img = new Image(); img.decoding = 'async'; img.src = src;
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let b = await canvasBlob(c, 'image/webp', quality);
  if (b.type !== 'image/webp') b = await canvasBlob(c, 'image/jpeg', quality); // Safari without WebP encoding
  return blobToDataURL(b);
}

// Turn our ES modules into one inline module script: each module becomes a closure that returns its exports.
export function bundleModules(sources) {
  let out = '';
  for (const { name, code } of sources) {
    const exports = [];
    const v = (m) => '__ae_' + m.replace(/-/g, '_');
    let c = code.replace(/^import\s*\{([^}]+)\}\s*from\s*'\.\/([\w-]+)\.js';?[ \t]*$/gm, (_, names, mod) => `const {${names}} = ${v(mod)};`);
    c = c.replace(/^import\s+([A-Za-z_$][\w$]*)\s+from\s*'\.\/([\w-]+)\.js';?[ \t]*$/gm, (_, id, mod) => `const ${id} = ${v(mod)}.default;`);
    c = c.replace(/^export\s+(async\s+function|function|class|const|let)\s+([A-Za-z_$][\w$]*)/gm, (_, kw, id) => { exports.push(id); return `${kw} ${id}`; });
    let hasDefault = false;
    c = c.replace(/^export\s+default\s+/m, () => { hasDefault = true; return 'const __default = '; });
    if (hasDefault) exports.push('default: __default');
    out += `const ${v(name)} = (() => {\n${c}\nreturn { ${exports.join(', ')} };\n})();\n`;
  }
  return out.replace(/<\/script/gi, '<\\/script');
}

async function facesFrom(url, latinOnly) {
  const css = await text(url, 8000);
  const blocks = latinOnly
    ? [...css.matchAll(/\/\*\s*latin\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)].map(m => m[1])
    : [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(m => m[1]);
  const faces = [];
  for (const b of blocks) {
    const url2 = /url\(([^)]+)\)/.exec(b)?.[1]; if (!url2) continue;
    const data = await urlToDataURL(url2.replace(/['"]/g, ''), 8000);
    faces.push(`@font-face{${b.replace(/url\([^)]+\)/, `url(${data})`)}}`);
  }
  return faces.join('\n');
}
async function embedFonts() {
  const out = [];
  // Cormorant Garamond + Cinzel (Latin) and only the motto glyphs of Noto Serif TC 300 (a few KB)
  for (const [url, latin] of [
    ['https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap', true],
    ['https://fonts.googleapis.com/css2?family=Cinzel:wght@400&display=swap', true],
    [`https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300&text=${encodeURIComponent('外在沉靜內在綻放·')}&display=swap`, false],
  ]) { try { out.push(await facesFrom(url, latin)); } catch { /* falls back to the serif stack */ } }
  return out.join('\n');
}

async function sha256(str) {
  try {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

/**
 * @param {object} o  { meta:{titleZh,titleEn,noteZh,noteEn,artist,no,of,year,kind,quality}, works:[{...work, duration?, transition?}], mode, settings, base, onProgress }
 * @returns {Promise<{blob: Blob, filename: string, size: number}>}
 */
export async function exportEdition(o) {
  const base = o.base || new URL('.', location.href).href; // …/ (site root that holds gallery.html)
  const step = (msg) => o.onProgress && o.onProgress(msg);
  const max = o.meta.quality === 'high' ? 2560 : o.meta.quality === 'light' ? 1280 : 1600;
  const q = o.meta.quality === 'light' ? 0.8 : 0.9;

  step('page');
  const [html, css, ...mods] = await Promise.all([
    text(new URL('gallery.html', base)), text(new URL('gallery/gallery.css', base)),
    ...MODULES.map(m => text(new URL(`gallery/${m}.js`, base))),
  ]);
  const bundle = bundleModules(MODULES.map((name, i) => ({ name, code: mods[i] })));

  step('brand');
  const logo = await encodeImage(new URL('assets/ae-three-rings-transparent.webp', base).href, 520, 0.92);
  const fonts = await embedFonts();

  const works = [];
  for (let i = 0; i < o.works.length; i++) {
    const w = o.works[i];
    step(`work:${i + 1}/${o.works.length}`);
    const src = w.type === 'video' ? await urlToDataURL(new URL(w.src, base).href) : await encodeImage(new URL(w.src, base).href, max, q);
    const thumb = w.thumb ? await encodeImage(new URL(w.thumb, base).href, 480, 0.82) : '';
    works.push({
      id: w.id, no: i + 1, type: w.type || 'image', src, thumb,
      title: w.title, year: w.year || '', medium: w.medium || '', size: w.size || '', statement: w.statement || { zh: '', en: '' },
      ...(w.duration ? { duration: w.duration } : {}), ...(w.transition ? { transition: w.transition } : {}),
      ...(w.fx ? { fx: w.fx } : {}), ...(w.tr ? { tr: w.tr } : {}), ...(w.cam ? { cam: w.cam } : {}),
    });
  }

  step('seal');
  const m = o.meta;
  const fingerprint = await sha256(JSON.stringify({ t: [m.titleZh, m.titleEn], a: m.artist, e: [m.no, m.of], w: works.map(w => [w.src.length, w.src.slice(-64), w.title]) }));
  const edition = {
    v: 1, id: (fingerprint || String(Date.now())).slice(0, 16), kind: m.kind === 'nft' ? 'nft' : 'client',
    title: { zh: m.titleZh, en: m.titleEn }, note: { zh: m.noteZh || '', en: m.noteEn || '' },
    artist: m.artist || 'Aurelia & Elion', edition: m.kind === 'nft' ? { no: Number(m.no) || 1, of: Number(m.of) || 1 } : { no: 1, of: 1 }, year: m.year || String(new Date().getFullYear()),
    mode: o.mode, settings: o.settings, site: m.kind === 'nft' ? '' : 'https://ae-universe-creation.vercel.app/',
    fingerprint, exportedAt: new Date().toISOString(), works, packs: Array.isArray(o.packs) ? o.packs : [],
  };
  const manifest = JSON.stringify(edition).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

  step('pack');
  const titleTxt = (m.titleZh || m.titleEn || 'AE Universe Creation').replace(/[<&]/g, '');
  let page = html
    .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
    .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, '')
    .replace(/<link rel="(?:icon|apple-touch-icon)"[^>]*>\s*/g, '')
    .replace(/<link rel="stylesheet" href="gallery\/gallery\.css[^"]*">/, () => `<style>\n${fonts}\n${css}\n</style>\n<link rel="icon" href="${logo}">`)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${titleTxt} · AE Universe Creation</title>\n<meta name="ae-edition" content="${edition.kind} ${edition.edition.no}/${edition.edition.of} ${fingerprint.slice(0, 16)}">`)
    .replace(/src="assets\/ae-three-rings-transparent\.webp"/g, () => `src="${logo}"`)
    .replace(/<script type="module" src="gallery\/app\.js[^"]*"><\/script>/, () => `<script>window.__AE_EDITION__ = ${manifest};</script>\n<script type="module">\n${bundle}\n</script>`);
  const blob = new Blob([page], { type: 'text/html' });
  const slug = (m.titleEn || 'edition').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'edition';
  return { blob, size: blob.size, filename: `AE-Universe-Creation-${slug}-${edition.kind}${edition.kind === 'nft' && edition.edition.of > 1 ? `-${edition.edition.no}of${edition.edition.of}` : ''}.html` };
}
