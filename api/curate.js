// /api/curate — AE 策展平台 V1 JSON API (apply, admin, login, exhibitions, images).
// All POSTs require header x-curate: 1 (blocks simple cross-site form posts). Passwords are hashed with scrypt; temp passwords are returned once to the admin UI only.
'use strict';
const L = require('./_curate-lib.js');
const { send, clean, LIMITS } = L;
const USER_RE = /^[a-z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,}$/;
const DAY = 86400;
const wait = ms => new Promise(r => setTimeout(r, ms));

function pubUser(u) { return u && { username: u.username, name: u.name, can_curate: !!u.can_curate, can_publish_public: !!u.can_publish_public, disabled: !!u.disabled, must_change: !!u.must_change, createdAt: u.createdAt }; }
function exOut(e) { return { ...e, url: '/ex/' + e.id }; }
function normWorks(list, prev) {
  const prevImgs = new Set((prev || []).map(w => w.image && w.image.kind === 'blob' ? w.image.id : null).filter(Boolean));
  const out = [];
  for (const w of (Array.isArray(list) ? list : []).slice(0, L.MAX_WORKS)) {
    const title = clean(w && w.title, LIMITS.workTitle); if (!title) continue;
    let image = null; const im = w.image || {};
    if (im.kind === 'blob' && /^[A-Za-z0-9_-]{10,40}$/.test(im.id || '')) image = { kind: 'blob', id: im.id };
    else if (im.kind === 'url') { const u = clean(im.url, LIMITS.url); if (/^https:\/\/[^\s"'<>]+$/i.test(u)) image = { kind: 'url', url: u }; }
    out.push({ id: /^[A-Za-z0-9_-]{6,24}$/.test(w.id || '') ? w.id : L.token(6), title, story: clean(w.story, LIMITS.story), image });
  }
  return out;
}

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const a = url.searchParams.get('a') || '';
  try {
    if (req.method === 'GET') {
      if (a === 'img') {
        const id = url.searchParams.get('id') || '';
        if (!/^[A-Za-z0-9_-]{10,40}$/.test(id)) return send(res, 400, { error: 'bad id' });
        const img = await L.getImage(id);
        if (!img) return send(res, 404, { error: 'not found' });
        res.statusCode = 200; res.setHeader('Content-Type', img.type); res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (img.buf) return res.end(img.buf);
        return res.end(Buffer.from(await new Response(img.stream).arrayBuffer()));
      }
      if (a === 'status') {
        const u = await L.currentUser(req).catch(() => null);
        return send(res, 200, { storage: L.storageName(), sessionReady: !!L.secret(), adminConfigured: L.adminConfigured(), admin: L.isAdmin(req), me: pubUser(u), templates: L.TEMPLATES, limits: { imageBytes: L.MAX_IMG, works: L.MAX_WORKS } });
      }
      if (a === 'admin-list') {
        if (!L.isAdmin(req)) return send(res, 401, { error: '請先以管理者身分登入' });
        const [apps, users] = await Promise.all([L.listJSON('apps/'), L.listJSON('users/')]);
        apps.sort((x, y) => y.createdAt - x.createdAt); users.sort((x, y) => y.createdAt - x.createdAt);
        return send(res, 200, { apps, users: users.map(pubUser) });
      }
      if (a === 'my-ex' || a === 'ex-get') {
        const u = await L.currentUser(req);
        if (!u) return send(res, 401, { error: '請先登入' });
        if (a === 'ex-get') {
          const e = await L.getJSON('ex/' + String(url.searchParams.get('id') || '').replace(/[^A-Za-z0-9_-]/g, '') + '.json');
          if (!e || e.owner !== u.username) return send(res, 404, { error: '找不到這個展覽' });
          return send(res, 200, { ex: exOut(e) });
        }
        const all = (await L.listJSON('ex/')).filter(e => e.owner === u.username).sort((x, y) => y.updatedAt - x.updatedAt);
        return send(res, 200, { items: all.map(e => ({ id: e.id, title: e.title, visibility: e.visibility, status: e.status, template: e.template, works: e.works.length, updatedAt: e.updatedAt, url: '/ex/' + e.id })) });
      }
      return send(res, 400, { error: 'unknown action' });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method' });
    if (req.headers['x-curate'] !== '1') return send(res, 403, { error: 'forbidden' });
    const b = await L.readBody(req);

    if (a === 'apply') {
      const app = { name: clean(b.name, LIMITS.name), email: clean(b.email, LIMITS.email).toLowerCase(), intro: clean(b.intro, LIMITS.intro), username: clean(b.username, LIMITS.username).toLowerCase() };
      if (!app.name || !EMAIL_RE.test(app.email) || !app.intro) return send(res, 400, { error: '請填寫名字、Email 與簡短介紹' });
      if (!USER_RE.test(app.username)) return send(res, 400, { error: '帳號名稱請用 3–24 個英文小寫、數字或底線' });
      if (await L.getJSON('users/' + app.username + '.json')) return send(res, 409, { error: '這個帳號名稱已經有人使用，換一個試試' });
      const id = L.token(12);
      await L.putJSON('apps/' + id + '.json', { id, ...app, status: 'pending', createdAt: Date.now() });
      return send(res, 200, { ok: true });
    }
    if (a === 'admin-login') {
      if (!L.adminConfigured()) return send(res, 503, { error: 'not configured', notConfigured: true });
      if (!b.password || !L.safeEq(b.password, process.env.CURATE_ADMIN_PASSWORD)) { await wait(700); return send(res, 401, { error: '密碼不正確' }); }
      L.setCookie(res, req, L.ADMIN, L.sign({ t: 'a', exp: Date.now() + 8 * 3600e3 }), 8 * 3600);
      return send(res, 200, { ok: true });
    }
    if (a === 'admin-logout') { L.setCookie(res, req, L.ADMIN, '', 0); return send(res, 200, { ok: true }); }
    if (a === 'approve' || a === 'reject' || a === 'set-perms' || a === 'reset-password') {
      if (!L.isAdmin(req)) return send(res, 401, { error: '請先以管理者身分登入' });
      if (a === 'set-perms' || a === 'reset-password') {
        const un = String(b.username || '').toLowerCase();
        const u = USER_RE.test(un) && await L.getJSON('users/' + un + '.json');
        if (!u) return send(res, 404, { error: '找不到帳號' });
        let temp = null;
        if (a === 'set-perms') { for (const k of ['can_curate', 'can_publish_public', 'disabled']) if (typeof b[k] === 'boolean') u[k] = b[k]; if (u.disabled) u.pwv = (u.pwv || 0) + 1; }
        else { temp = L.tempPassword(); u.hash = L.hashPassword(temp); u.must_change = true; u.pwv = (u.pwv || 0) + 1; }
        u.updatedAt = Date.now();
        await L.putJSON('users/' + un + '.json', u);
        return send(res, 200, { ok: true, user: pubUser(u), tempPassword: temp || undefined });
      }
      const id = String(b.id || '').replace(/[^A-Za-z0-9_-]/g, '');
      const app = id && await L.getJSON('apps/' + id + '.json');
      if (!app || app.status !== 'pending') return send(res, 404, { error: '找不到待審申請' });
      if (a === 'reject') { app.status = 'rejected'; app.decidedAt = Date.now(); await L.putJSON('apps/' + id + '.json', app); return send(res, 200, { ok: true }); }
      if (await L.getJSON('users/' + app.username + '.json')) return send(res, 409, { error: '帳號名稱已存在' });
      const temp = L.tempPassword();
      const u = { username: app.username, name: app.name, email: app.email, hash: L.hashPassword(temp), must_change: true, pwv: 1, can_curate: true, can_publish_public: false, disabled: false, createdAt: Date.now(), fromApp: id };
      await L.putJSON('users/' + u.username + '.json', u);
      app.status = 'approved'; app.decidedAt = Date.now(); await L.putJSON('apps/' + id + '.json', app);
      return send(res, 200, { ok: true, user: pubUser(u), tempPassword: temp });
    }
    if (a === 'login') {
      if (!L.secret()) return send(res, 503, { error: '登入功能尚未設定完成' });
      const un = String(b.username || '').trim().toLowerCase();
      const u = USER_RE.test(un) && await L.getJSON('users/' + un + '.json');
      if (!u || !L.verifyPassword(b.password || '', u.hash)) { await wait(600); return send(res, 401, { error: '帳號或密碼不正確' }); }
      if (u.disabled) return send(res, 403, { error: '這個帳號目前已停用' });
      L.setCookie(res, req, L.SESSION, L.sign({ t: 'u', u: u.username, v: u.pwv, exp: Date.now() + 14 * DAY * 1000 }), 14 * DAY);
      return send(res, 200, { ok: true, me: pubUser(u) });
    }
    if (a === 'logout') { L.setCookie(res, req, L.SESSION, '', 0); return send(res, 200, { ok: true }); }

    const u = await L.currentUser(req);
    if (!u) return send(res, 401, { error: '請先登入' });
    if (a === 'change-password') {
      if (!L.verifyPassword(b.current || '', u.hash)) { await wait(500); return send(res, 401, { error: '目前密碼不正確' }); }
      const np = String(b.next || '');
      if (np.length < 10 || np.length > 128) return send(res, 400, { error: '新密碼請至少 10 個字元' });
      if (L.verifyPassword(np, u.hash)) return send(res, 400, { error: '新密碼不能和臨時密碼相同' });
      u.hash = L.hashPassword(np); u.must_change = false; u.pwv = (u.pwv || 0) + 1; u.updatedAt = Date.now();
      await L.putJSON('users/' + u.username + '.json', u);
      L.setCookie(res, req, L.SESSION, L.sign({ t: 'u', u: u.username, v: u.pwv, exp: Date.now() + 14 * DAY * 1000 }), 14 * DAY);
      return send(res, 200, { ok: true, me: pubUser(u) });
    }
    if (u.must_change) return send(res, 403, { error: '請先更改臨時密碼', mustChange: true });
    if (!u.can_curate) return send(res, 403, { error: '這個帳號還沒有策展權限' });

    if (a === 'upload-img') {
      const type = String(b.type || '');
      if (!/^image\/(jpeg|png|webp)$/.test(type)) return send(res, 400, { error: '請上傳 JPG、PNG 或 WebP 圖片' });
      const buf = Buffer.from(String(b.data || ''), 'base64');
      if (!buf.length) return send(res, 400, { error: '圖片是空的' });
      if (buf.length > L.MAX_IMG) return send(res, 413, { error: '圖片請小於 3 MB' });
      const sig = buf.subarray(0, 12).toString('hex');
      const ok = (type === 'image/jpeg' && sig.startsWith('ffd8ff')) || (type === 'image/png' && sig.startsWith('89504e47')) || (type === 'image/webp' && sig.startsWith('52494646') && sig.slice(16, 24) === '57454250');
      if (!ok) return send(res, 400, { error: '檔案內容不是有效的圖片' });
      const id = L.token(16);
      await L.putImage(id, buf, type); // stored byte-for-byte, never re-encoded
      return send(res, 200, { ok: true, image: { kind: 'blob', id } });
    }
    if (a === 'ex-delete') {
      const id = String(b.id || '').replace(/[^A-Za-z0-9_-]/g, '');
      const e = id && await L.getJSON('ex/' + id + '.json');
      if (!e || e.owner !== u.username) return send(res, 404, { error: '找不到這個展覽' });
      for (const w of e.works || []) if (w.image && w.image.kind === 'blob') await L.delKey('img/' + w.image.id);
      await L.delKey('ex/' + id + '.json');
      return send(res, 200, { ok: true });
    }
    if (a === 'ex-save') {
      const id = String(b.id || '').replace(/[^A-Za-z0-9_-]/g, '');
      let prev = null;
      if (id) { prev = await L.getJSON('ex/' + id + '.json'); if (!prev || prev.owner !== u.username) return send(res, 404, { error: '找不到這個展覽' }); }
      const tpl = L.TEMPLATES.find(t => t.id === b.template && t.ready) ? b.template : 'ae-light';
      let visibility = b.visibility === 'public' ? 'public' : 'private';
      if (visibility === 'public' && !u.can_publish_public) return send(res, 403, { error: '這個帳號目前只能建立不公開連結的展覽；公開刊登需要管理者開啟權限' });
      const e = {
        id: prev ? prev.id : L.token(12), owner: u.username, curatorName: u.name,
        title: clean(b.title, LIMITS.title), curatorIntro: clean(b.curatorIntro, LIMITS.curatorIntro), description: clean(b.description, LIMITS.description),
        openingDate: /^\d{4}-\d{2}-\d{2}$/.test(b.openingDate || '') ? b.openingDate : '',
        template: tpl, visibility, status: b.status === 'published' ? 'published' : 'draft',
        works: normWorks(b.works, prev && prev.works), createdAt: prev ? prev.createdAt : Date.now(), updatedAt: Date.now()
      };
      if (!e.title) return send(res, 400, { error: '請幫展覽取一個名字' });
      if (e.status === 'published' && !e.works.length) return send(res, 400, { error: '發布前請至少加入一件作品' });
      await L.putJSON('ex/' + e.id + '.json', e);
      return send(res, 200, { ok: true, ex: exOut(e) });
    }
    return send(res, 400, { error: 'unknown action' });
  } catch (e) {
    const st = e && e.status || 500;
    return send(res, st, { error: st === 503 ? '儲存空間尚未設定' : (st === 413 ? '資料太大' : '系統暫時出了點問題，請稍後再試') });
  }
};
