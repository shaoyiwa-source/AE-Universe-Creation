/* 萌創作品牆：把原本的 claude.use('db'|'assets'|'user') 接到 Supabase */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SB_URL = 'https://dmpakormfqazmjferaqs.supabase.co';
const SB_KEY = 'sb_publishable_2oTHk8viJNv8grnLMcbVKg_E8c4ASIG';
const BUCKET = 'onecreator';
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
window.ocSupabase = sb;

const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
function guestId() {
  try { let g = localStorage.getItem('oc_guest'); if (!g) { g = 'g_' + rid(); localStorage.setItem('oc_guest', g); } return g; }
  catch (e) { return 'g_' + rid(); }
}
function deepMerge(a, b) {
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) ? deepMerge(out[k], v) : v;
  }
  return out;
}
const snapOf = rows => ({ metadata: { fromCache: false }, docs: rows.map(r => ({ id: r.id, data: () => ({ ...r.data, _owner: r.owner || null }) })) });

let chanSeq = 0;
function collection(col, filters = []) {
  const api = {
    where(field, op, value) { return collection(col, [...filters, [field, op, value]]); },
    onSnapshot(cb, err) {
      let alive = true;
      const load = async () => {
        let q = sb.from('oc_docs').select('id,data,owner').eq('col', col);
        for (const [f, , v] of filters) q = q.eq('data->>' + f, String(v));
        const { data, error } = await q;
        if (!alive) return;
        if (error) { err && err({ code: error.code || 'error' }); return; }
        cb(snapOf(data || []));
      };
      load();
      let t = null;
      const ch = sb.channel('oc-' + col + '-' + (++chanSeq))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oc_docs', filter: 'col=eq.' + col },
          () => { clearTimeout(t); t = setTimeout(load, 120); })
        .subscribe();
      const poll = setInterval(load, 30000);
      return () => { alive = false; clearInterval(poll); sb.removeChannel(ch); };
    },
    doc(id) {
      id = id || rid();
      return {
        id,
        async set(data) {
          data = { ...data }; delete data._owner;
          const { data: u } = await sb.auth.getUser();
          const { error } = await sb.from('oc_docs').upsert({ col, id, data, owner: u?.user?.id || null, updated_at: new Date().toISOString() });
          if (error) throw error;
        },
        async update(patch) {
          patch = { ...patch }; delete patch._owner;
          const { data: cur, error: e1 } = await sb.from('oc_docs').select('data').eq('col', col).eq('id', id).maybeSingle();
          if (e1) throw e1;
          const { error } = await sb.from('oc_docs').update({ data: deepMerge(cur?.data, patch), updated_at: new Date().toISOString() }).eq('col', col).eq('id', id);
          if (error) throw error;
        },
        async delete() {
          const { error } = await sb.from('oc_docs').delete().eq('col', col).eq('id', id);
          if (error) throw error;
        }
      };
    },
    async add(data) { const d = api.doc(); await d.set(data); return { id: d.id }; }
  };
  return api;
}

const db = { collection: c => collection(c) };

const assets = {
  async upload(file) {
    const { data: u } = await sb.auth.getUser();
    const ext = (file.type && file.type.split('/')[1]) || 'jpg';
    const path = `${u?.user?.id || 'anon'}/${Date.now()}-${rid()}.${ext.replace('jpeg', 'jpg')}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
    if (error) throw error;
    return { id: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
  },
  async delete(id) {
    const mark = `/object/public/${BUCKET}/`;
    if (typeof id === 'string' && id.includes(mark)) await sb.storage.from(BUCKET).remove([id.split(mark)[1]]);
  }
};

async function rpcBool(fn) {
  const { data } = await sb.auth.getSession();
  if (!data?.session) return false;
  const { data: ok } = await sb.rpc(fn);
  return !!ok;
}
const isAdmin = () => rpcBool('oc_is_admin');
window.ocRole = async () => {
  const { data } = await sb.auth.getSession(); const u = data?.session?.user;
  if (!u) return { user: null, admin: false, write: false, status: null };
  const [admin, write] = await Promise.all([rpcBool('oc_is_admin'), rpcBool('oc_can_write')]);
  const { data: m } = await sb.from('oc_members').select('status').eq('user_id', u.id).maybeSingle();
  return { user: u, admin, write, status: m?.status || null };
};

const user = {
  async canEdit() { return rpcBool('oc_can_write'); },
  async id() { const { data } = await sb.auth.getSession(); return data?.session?.user?.id || guestId(); }
};

window.claude = { use: async k => ({ db, assets, user })[k] || null };
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') { if (window._ocBooted) location.reload(); } });
setTimeout(() => { window._ocBooted = true; }, 1500);
window.dispatchEvent(new Event('oc-ready'));
