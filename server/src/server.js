// Narancs Signage – szerver belépési pont
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  db, all, get, run, DATA_DIR, MEDIA_DIR, Slides, Playlists, Calendars, Events, Forms, Screens, getSetting, setSetting,
} from './db.js';
import { Router, HttpError, send, readBody, serveFile, serveStatic, MIME } from './http.js';
import { createUser, login, sessionCookie, currentUser, requireAuth, userCount, listUsers, verifyPassword, hashPassword } from './auth.js';
import { fetchRss, fetchWeather, geocode, refreshIcal, refreshAllIcal } from './feeds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_UPLOAD = (+process.env.MAX_UPLOAD_MB || 2048) * 1024 * 1024;
const VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')).version;

const r = new Router();
const now = () => Date.now();
const id = (req) => +req.params.id;

// =====================================================================
//  Valós idejű kapcsolat a lejátszókkal (Server-Sent Events)
// =====================================================================
const streams = new Map(); // device_id -> Set<res>  (böngésző lejátszók)
const agents = new Map();  // device_id -> Set<res>  (kijelző ügynök: lejátszó/eszköz újraindítás)
// Ezeket a parancsokat az eszközön futó ügynök hajtja végre, nem a böngésző
const AGENT_COMMANDS = ['restart', 'reboot'];

function pushTo(deviceId, event, data = {}, map = streams) {
  for (const res of map.get(deviceId) || []) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
function pushAll(event, data = {}) {
  for (const devId of streams.keys()) pushTo(devId, event, data);
}
let refreshTimer = null;
function notifyChange() {
  // több gyors módosítást egybefogunk
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => pushAll('refresh'), 400);
}
setInterval(() => {
  for (const map of [streams, agents]) for (const set of map.values()) for (const res of set) res.write(': ping\n\n');
}, 25000);

// =====================================================================
//  Lejátszó konfiguráció összeállítása
// =====================================================================
function mediaMap(ids) {
  const out = {};
  const list = [...new Set(ids.filter(Boolean).map(Number))];
  if (!list.length) return out;
  for (const m of all(`SELECT * FROM media WHERE id IN (${list.map(() => '?').join(',')})`, ...list)) {
    out[m.id] = { id: m.id, url: `/media/${m.filename}`, mime: m.mime, name: m.name };
  }
  return out;
}

function collectMediaIds(slide) {
  const d = slide.data || {};
  const ids = [];
  if (Array.isArray(d.media_ids)) ids.push(...d.media_ids);
  if (d.media_id) ids.push(d.media_id);
  if (d.bg_media_id) ids.push(d.bg_media_id);
  if (d.logo_media_id) ids.push(d.logo_media_id);
  for (const c of d.cards || []) if (c.media_id) ids.push(c.media_id);
  for (const b of d.buttons || []) if (b.media_id) ids.push(b.media_id);
  return ids;
}

function slideTargets(slide) {
  const d = slide.data || {};
  return [...(d.cards || []), ...(d.buttons || [])].map((x) => +x.target_slide).filter(Boolean);
}

function calendarEvents(calIds, daysBack = 1, daysAhead = 120) {
  const from = now() - daysBack * 864e5, to = now() + daysAhead * 864e5;
  const out = [];
  for (const cid of calIds) {
    const cal = Calendars.get(cid);
    if (!cal) continue;
    const manual = all('SELECT * FROM events WHERE calendar_id = ?', cid);
    for (const e of [...manual, ...(cal.ical_cache || [])]) {
      const s = Date.parse(e.start), en = Date.parse(e.end || e.start);
      if (en >= from && s <= to) out.push({ title: e.title, description: e.description, location: e.location, start: e.start, end: e.end, all_day: !!e.all_day, color: cal.color, calendar: cal.name });
    }
  }
  return out.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

function activeAlerts(screenId) {
  return all('SELECT * FROM alerts WHERE expires_at IS NULL OR expires_at > ? ORDER BY id DESC', now())
    .filter((a) => !a.screen_ids || !a.screen_ids.length || (screenId && a.screen_ids.includes(screenId)))
    .map((a) => ({ id: a.id, title: a.title, message: a.message, level: a.level, expires_at: a.expires_at }));
}

function buildBundle(playlistIds, extraSlideIds = []) {
  const playlists = {};
  const slideIds = new Set(extraSlideIds.map(Number));
  for (const pid of new Set(playlistIds.filter(Boolean).map(Number))) {
    const p = Playlists.get(pid);
    if (!p) continue;
    playlists[pid] = { id: p.id, name: p.name, transition: p.transition, items: p.items };
    for (const it of p.items) slideIds.add(+it.slide_id);
  }
  // interaktív hivatkozások bejárása (kártyák/menük célja)
  const slides = {};
  const queue = [...slideIds];
  while (queue.length) {
    const sid = queue.shift();
    if (slides[sid]) continue;
    const s = Slides.get(sid);
    if (!s) continue;
    slides[sid] = s;
    for (const t of slideTargets(s)) if (!slides[t]) queue.push(t);
  }
  const mediaIds = [], calIds = new Set(), formIds = new Set();
  for (const s of Object.values(slides)) {
    mediaIds.push(...collectMediaIds(s));
    if (s.type === 'calendar') for (const c of s.data.calendar_ids || []) calIds.add(+c);
    if (s.type === 'form' && s.data.form_id) formIds.add(+s.data.form_id);
  }
  const forms = {};
  for (const fid of formIds) {
    const f = Forms.get(fid);
    if (f) forms[fid] = { id: f.id, title: f.title || f.name, intro: f.intro, fields: f.fields, submit_text: f.submit_text, thanks_text: f.thanks_text };
  }
  const calendars = {};
  for (const cid of calIds) calendars[cid] = calendarEvents([cid]);
  const logoId = getSetting('logo_media_id');
  if (logoId) mediaIds.push(logoId);
  return { playlists, slides, media: mediaMap(mediaIds), forms, calendars };
}

// Szervezet és arculat (logó, színek, betűk, fejléc) – a lejátszó ebből építi fel a megjelenést
function orgInfo() {
  return {
    name: getSetting('org_name', 'Narancs Signage'),
    slogan: getSetting('slogan', ''),
    logo_media_id: getSetting('logo_media_id'),
    branding: getSetting('branding', { preset: 'narancs' }),
  };
}

function playerConfig(screen) {
  const schedule = screen.schedule || [];
  const bundle = buildBundle([screen.playlist_id, ...schedule.map((s) => s.playlist_id)]);
  const org = orgInfo();
  const cfg = {
    screen: { id: screen.id, name: screen.name, playlist_id: screen.playlist_id, schedule, settings: screen.settings || {} },
    org, ...bundle,
  };
  cfg.version = crypto.createHash('sha1').update(JSON.stringify(cfg)).digest('hex').slice(0, 12);
  cfg.alerts = activeAlerts(screen.id); // a riasztások külön kezelendők, nem részei a verziónak
  return cfg;
}

function screenByDevice(deviceId) {
  if (!deviceId || !/^[\w-]{8,64}$/.test(deviceId)) throw new HttpError(400, 'Érvénytelen eszközazonosító');
  return get('SELECT * FROM screens WHERE device_id = ?', deviceId);
}

function newPairCode() {
  for (;;) {
    const code = String(crypto.randomInt(100000, 999999));
    if (!get('SELECT id FROM screens WHERE code = ? AND approved = 0', code)) return code;
  }
}

// =====================================================================
//  Lejátszó API (nyilvános, eszközazonosítóval)
// =====================================================================
r.post('/api/player/hello', async (req, res) => {
  const body = await readBody(req);
  let s = screenByDevice(body.device);
  const info = JSON.stringify(body.info || {});
  if (!s) {
    run('INSERT INTO screens (device_id, code, info, last_seen, created_at, settings) VALUES (?, ?, ?, ?, ?, ?)',
      body.device, newPairCode(), info, now(), now(), JSON.stringify({ orientation: 'landscape', show_clock: false, idle_return: 45 }));
    s = screenByDevice(body.device);
  } else {
    run('UPDATE screens SET info = ?, last_seen = ? WHERE id = ?', info, now(), s.id);
  }
  send(res, 200, { paired: !!s.approved, code: s.code, name: s.name, server_version: VERSION });
});

r.get('/api/player/config', (req, res) => {
  const s = screenByDevice(req.query.get('device'));
  if (!s) throw new HttpError(404, 'Ismeretlen eszköz');
  run('UPDATE screens SET last_seen = ? WHERE id = ?', now(), s.id);
  if (!s.approved) return send(res, 200, { paired: false, code: s.code });
  send(res, 200, { paired: true, ...playerConfig(s) });
});

r.get('/api/player/stream', (req, res) => {
  const deviceId = req.query.get('device');
  const s = screenByDevice(deviceId);
  if (!s) throw new HttpError(404, 'Ismeretlen eszköz');
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 5000\n\nevent: hello\ndata: {}\n\n');
  const map = req.query.get('agent') === '1' ? agents : streams;
  if (!map.has(deviceId)) map.set(deviceId, new Set());
  map.get(deviceId).add(res);
  run('UPDATE screens SET last_seen = ? WHERE id = ?', now(), s.id);
  req.on('close', () => {
    const set = map.get(deviceId);
    set?.delete(res);
    if (set && !set.size) map.delete(deviceId);
  });
});

r.post('/api/player/heartbeat', async (req, res) => {
  const body = await readBody(req);
  const s = screenByDevice(body.device);
  if (!s) throw new HttpError(404, 'Ismeretlen eszköz');
  // az ügynök is küld heartbeatet (current nélkül) – ilyenkor a futó tartalom adata megmarad
  const info = { ...(s.info || {}), ...(body.info || {}), current: 'current' in body ? body.current || null : s.info?.current || null };
  run('UPDATE screens SET last_seen = ?, info = ? WHERE id = ?', now(), JSON.stringify(info), s.id);
  if (Array.isArray(body.stats)) {
    const ins = db.prepare('INSERT INTO stats (screen_id, slide_id, kind, created_at) VALUES (?, ?, ?, ?)');
    for (const st of body.stats.slice(0, 500)) {
      if (['view', 'touch'].includes(st.kind)) ins.run(s.id, +st.slide_id || null, st.kind, +st.t || now());
    }
  }
  send(res, 200, { ok: true });
});

r.post('/api/player/forms/:id', async (req, res) => {
  const body = await readBody(req, 256 * 1024);
  const form = Forms.get(id(req));
  if (!form) throw new HttpError(404, 'Ismeretlen űrlap');
  const s = body.device ? screenByDevice(body.device) : null;
  const clean = {};
  for (const f of form.fields) {
    let v = body.data?.[f.key];
    if (f.type === 'checkbox') v = !!v;
    else if (v != null) v = String(v).slice(0, 5000);
    if (f.required && (v === undefined || v === '' || v === false || v === null)) throw new HttpError(400, `Kötelező mező: ${f.label}`);
    if (f.type === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) throw new HttpError(400, `Érvénytelen e-mail: ${f.label}`);
    clean[f.key] = v ?? '';
  }
  run('INSERT INTO submissions (form_id, screen_id, data, created_at) VALUES (?, ?, ?, ?)', form.id, s?.id || null, JSON.stringify(clean), now());
  send(res, 200, { ok: true, message: form.thanks_text });
});

// A hírfolyam proxy csak olyan URL-t enged, ami valamelyik dián szerepel (SSRF védelem)
r.get('/api/player/rss', async (req, res) => {
  const url = req.query.get('url') || '';
  const allowed = all("SELECT data FROM slides WHERE type = 'rss'").some((s) => s.data.url === url);
  if (!allowed) throw new HttpError(403, 'Nem engedélyezett hírfolyam');
  send(res, 200, await fetchRss(url));
});

r.get('/api/player/weather', async (req, res) => {
  const lat = parseFloat(req.query.get('lat')), lon = parseFloat(req.query.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new HttpError(400, 'Hiányzó koordináták');
  send(res, 200, await fetchWeather(lat, lon));
});

// Arculat bemutató: minta tartalmak témaszínekkel (nincs saját háttér, így a téma látszik)
function brandDemo() {
  const t = new Date();
  const at = (d, h, m = 0) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + d, h, m).toISOString();
  const org = orgInfo();
  const slides = {
    [-1]: { id: -1, name: 'Hirdetmény', type: 'text', duration: 6, data: { kicker: 'Közlemény', title: org.name || 'Üdvözlünk!', body: org.slogan || 'Így néz ki egy hirdetmény az új arculattal. A színek, a betűtípus és a logó mindenhol egységes.', bg: 'linear-gradient(135deg, var(--bg2), var(--bg))', show_logo: true } },
    [-2]: { id: -2, name: 'Kártyák', type: 'cards', duration: 6, data: { title: 'Szolgáltatásaink', subtitle: 'Minta kártyák az arculat színeivel', columns: 3, cards: [{ icon: '☕', title: 'Kávézó', text: 'Földszint, 7:00–18:00', badge: 'ÚJ' }, { icon: '📚', title: 'Könyvtár', text: '2. emelet' }, { icon: '🏋️', title: 'Edzőterem', text: '-1. szint' }] } },
    [-3]: { id: -3, name: 'Menü', type: 'menu', duration: 6, data: { title: 'Miben segíthetünk?', subtitle: 'Érintsd meg a témát', columns: 3, buttons: [{ icon: '🗺️', label: 'Térkép' }, { icon: '📅', label: 'Programok' }, { icon: '✍️', label: 'Visszajelzés' }] } },
    [-4]: { id: -4, name: 'Naptár', type: 'calendar', duration: 6, data: { title: 'Közelgő események', calendar_ids: [-1], view: 'list' } },
    [-5]: { id: -5, name: 'Óra', type: 'clock', duration: 6, data: { style: 'digital', show_weather: false, title: org.slogan || '' } },
  };
  return {
    screen: { id: 0, name: 'Arculat előnézet', playlist_id: 0, schedule: [], settings: { idle_return: 30 } },
    org, slides, forms: {}, alerts: [], version: String(now()),
    playlists: { 0: { id: 0, name: 'Arculat', transition: 'fade', items: Object.keys(slides).map((k) => ({ slide_id: +k })) } },
    calendars: { [-1]: [
      { title: 'Csapatmegbeszélés', location: 'Tárgyaló 2', start: at(0, t.getHours(), 0), end: at(0, t.getHours() + 1), color: null, all_day: false },
      { title: 'Workshop', location: 'Aula', start: at(1, 10), end: at(1, 12), color: null, all_day: false },
      { title: 'Családi nap', location: 'Park', start: at(3, 9), end: at(3, 17), color: null, all_day: false },
    ] },
    media: mediaMap([org.logo_media_id]),
  };
}

// Előnézet az admin felületről (bejelentkezés szükséges)
r.get('/api/preview', (req, res) => {
  requireAuth(req);
  const slideId = +req.query.get('slide') || null;
  const playlistId = +req.query.get('playlist') || null;
  const screenId = +req.query.get('screen') || null;
  let cfg;
  if (req.query.get('brand')) {
    cfg = brandDemo();
  } else if (screenId) {
    const s = Screens.get(screenId);
    if (!s) throw new HttpError(404, 'Nincs ilyen képernyő');
    cfg = playerConfig(s);
  } else {
    const bundle = buildBundle(playlistId ? [playlistId] : [], slideId ? [slideId] : []);
    if (slideId) bundle.playlists[0] = { id: 0, name: 'Előnézet', transition: 'fade', items: [{ slide_id: slideId }] };
    cfg = {
      screen: { id: 0, name: 'Előnézet', playlist_id: playlistId || 0, schedule: [], settings: { idle_return: 30 } },
      org: orgInfo(),
      ...bundle, alerts: [], version: String(now()),
    };
  }
  send(res, 200, { paired: true, preview: true, ...cfg });
});

// =====================================================================
//  Hitelesítés
// =====================================================================
r.get('/api/auth/state', (req, res) => {
  const u = currentUser(req);
  send(res, 200, { setup: userCount() === 0, user: u ? { id: u.id, username: u.username } : null, version: VERSION });
});

r.post('/api/auth/setup', async (req, res) => {
  if (userCount() > 0) throw new HttpError(403, 'A rendszer már be van állítva');
  const { username, password, org_name } = await readBody(req);
  createUser(username, password);
  if (org_name) setSetting('org_name', String(org_name).slice(0, 80));
  const token = login(username, password);
  send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token, req) });
});

const loginAttempts = new Map();
r.post('/api/auth/login', async (req, res) => {
  const ip = req.socket.remoteAddress;
  const a = loginAttempts.get(ip) || { n: 0, until: 0 };
  if (a.until > now()) throw new HttpError(429, 'Túl sok próbálkozás, várj egy percet');
  const { username, password } = await readBody(req);
  try {
    const token = login(username, password);
    loginAttempts.delete(ip);
    send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(token, req) });
  } catch (e) {
    a.n++;
    if (a.n >= 5) { a.until = now() + 60e3; a.n = 0; }
    loginAttempts.set(ip, a);
    throw e;
  }
});

r.post('/api/auth/logout', (req, res) => {
  const u = currentUser(req);
  if (u) run('DELETE FROM sessions WHERE token = ?', u.token);
  send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', req) });
});

// =====================================================================
//  Admin API – minden alábbi útvonal bejelentkezést igényel
// =====================================================================
const A = requireAuth;

function isOnline(s) { return streams.has(s.device_id) || (s.last_seen && now() - s.last_seen < 90e3); }
function screenOut(s) {
  const { device_id, ...rest } = s;
  return { ...rest, online: isOnline(s), agent_online: agents.has(device_id), device_short: device_id.slice(0, 8) };
}

r.get('/api/dashboard', A, (req, res) => {
  const screens = all('SELECT * FROM screens WHERE approved = 1');
  const weekAgo = now() - 7 * 864e5;
  send(res, 200, {
    counts: {
      screens: screens.length,
      online: screens.filter(isOnline).length,
      pending: get('SELECT COUNT(*) n FROM screens WHERE approved = 0 AND last_seen > ?', now() - 600e3).n,
      slides: get('SELECT COUNT(*) n FROM slides').n,
      playlists: get('SELECT COUNT(*) n FROM playlists').n,
      media: get('SELECT COUNT(*) n, COALESCE(SUM(size),0) s FROM media'),
      submissions_week: get('SELECT COUNT(*) n FROM submissions WHERE created_at > ?', weekAgo).n,
      touches_week: get("SELECT COUNT(*) n FROM stats WHERE kind = 'touch' AND created_at > ?", weekAgo).n,
      views_week: get("SELECT COUNT(*) n FROM stats WHERE kind = 'view' AND created_at > ?", weekAgo).n,
    },
    screens: screens.map(screenOut),
    top_slides: all(`SELECT s.id, s.name, s.type, COUNT(*) views FROM stats st JOIN slides s ON s.id = st.slide_id
      WHERE st.kind = 'view' AND st.created_at > ? GROUP BY s.id ORDER BY views DESC LIMIT 6`, weekAgo),
    daily: all(`SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch', 'localtime') day,
      SUM(kind='view') views, SUM(kind='touch') touches FROM stats WHERE created_at > ? GROUP BY day ORDER BY day`, weekAgo),
    recent_submissions: all(`SELECT sub.id, sub.created_at, f.name form_name, f.id form_id FROM submissions sub JOIN forms f ON f.id = sub.form_id ORDER BY sub.id DESC LIMIT 6`),
    alerts: activeAlerts(null),
    storage: diskUsage(),
  });
});

function diskUsage() {
  try {
    const st = fs.statfsSync(DATA_DIR);
    return { total: st.blocks * st.bsize, free: st.bavail * st.bsize };
  } catch { return null; }
}

// ---------- Média ----------
r.get('/api/media', A, (req, res) => send(res, 200, all('SELECT * FROM media ORDER BY id DESC').map((m) => ({ ...m, url: `/media/${m.filename}` }))));

r.post('/api/media', A, (req, res) => new Promise((resolve, reject) => {
  const name = decodeURIComponent(req.headers['x-filename'] || 'feltoltes').slice(0, 200);
  const ext = path.extname(name).toLowerCase();
  const mime = MIME[ext] || req.headers['content-type'] || 'application/octet-stream';
  if (!/^(image|video|audio)\/|application\/pdf/.test(mime)) return reject(new HttpError(415, 'Csak kép, videó, hang vagy PDF tölthető fel'));
  const filename = crypto.randomBytes(12).toString('hex') + ext;
  const dest = path.join(MEDIA_DIR, filename);
  const out = fs.createWriteStream(dest);
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_UPLOAD) { req.destroy(); out.destroy(); fs.rmSync(dest, { force: true }); reject(new HttpError(413, 'A fájl túl nagy')); }
  });
  req.pipe(out);
  out.on('finish', () => {
    if (size > MAX_UPLOAD) return;
    const ins = run('INSERT INTO media (name, filename, mime, size, created_at) VALUES (?, ?, ?, ?, ?)', name, filename, mime, size, now());
    const m = get('SELECT * FROM media WHERE id = ?', Number(ins.lastInsertRowid));
    send(res, 200, { ...m, url: `/media/${m.filename}` });
    resolve();
  });
  out.on('error', reject);
}));

r.put('/api/media/:id', A, async (req, res) => {
  const { name } = await readBody(req);
  run('UPDATE media SET name = ? WHERE id = ?', String(name || '').slice(0, 200), id(req));
  send(res, 200, get('SELECT * FROM media WHERE id = ?', id(req)));
});

r.del('/api/media/:id', A, (req, res) => {
  const m = get('SELECT * FROM media WHERE id = ?', id(req));
  if (!m) throw new HttpError(404, 'Nincs ilyen fájl');
  fs.rmSync(path.join(MEDIA_DIR, m.filename), { force: true });
  run('DELETE FROM media WHERE id = ?', m.id);
  notifyChange();
  send(res, 200, { ok: true });
});

// ---------- Általános CRUD útvonalak ----------
function crudRoutes(base, model, { validate = (x) => x, order } = {}) {
  r.get(`/api/${base}`, A, (req, res) => send(res, 200, model.list(order)));
  r.get(`/api/${base}/:id`, A, (req, res) => {
    const x = model.get(id(req));
    if (!x) throw new HttpError(404, 'Nem található');
    send(res, 200, x);
  });
  r.post(`/api/${base}`, A, async (req, res) => { const x = model.create(validate(await readBody(req), true)); notifyChange(); send(res, 200, x); });
  r.put(`/api/${base}/:id`, A, async (req, res) => {
    if (!model.get(id(req))) throw new HttpError(404, 'Nem található');
    const x = model.update(id(req), validate(await readBody(req), false));
    notifyChange();
    send(res, 200, x);
  });
  r.del(`/api/${base}/:id`, A, (req, res) => { model.remove(id(req)); notifyChange(); send(res, 200, { ok: true }); });
}

const SLIDE_TYPES = ['image', 'video', 'web', 'text', 'cards', 'calendar', 'form', 'menu', 'clock', 'rss', 'countdown', 'html', 'qr', 'pdf'];
crudRoutes('slides', Slides, {
  order: 'updated_at DESC',
  validate(b, isNew) {
    if (isNew && !SLIDE_TYPES.includes(b.type)) throw new HttpError(400, 'Ismeretlen tartalomtípus');
    if (isNew && !b.name) throw new HttpError(400, 'Adj nevet a tartalomnak');
    if (b.duration !== undefined) b.duration = Math.max(0, Math.min(86400, +b.duration || 0));
    return b;
  },
});
r.post('/api/slides/:id/duplicate', A, (req, res) => {
  const s = Slides.get(id(req));
  if (!s) throw new HttpError(404, 'Nem található');
  send(res, 200, Slides.create({ ...s, name: s.name + ' (másolat)' }));
});

crudRoutes('playlists', Playlists, {
  order: 'name',
  validate(b, isNew) {
    if (isNew && !b.name) throw new HttpError(400, 'Adj nevet a listának');
    if (b.items) b.items = b.items.map((i) => ({ slide_id: +i.slide_id, duration: i.duration ? +i.duration : null, enabled: i.enabled !== false, valid_from: i.valid_from || null, valid_to: i.valid_to || null }));
    return b;
  },
});
// Tartalmak átszínezése az arculat szerint: az egyedi színek helyett a téma színei érvényesülnek
const THEME_GRADIENT = 'linear-gradient(135deg, var(--bg2), var(--bg))';
function brandifyData(type, data) {
  const d = { ...data };
  delete d.color;
  if (['text', 'countdown'].includes(type)) d.bg = THEME_GRADIENT; else delete d.bg;
  for (const k of ['cards', 'buttons']) {
    if (Array.isArray(d[k])) d[k] = d[k].map(({ color, text_color, ...rest }) => rest);
  }
  return d;
}
r.post('/api/slides/brandify', A, async (req, res) => {
  const { ids } = await readBody(req);
  const list = Array.isArray(ids) && ids.length ? ids.map((i) => Slides.get(+i)).filter(Boolean) : Slides.list();
  let changed = 0;
  for (const sl of list) {
    const nd = brandifyData(sl.type, sl.data || {});
    if (JSON.stringify(nd) !== JSON.stringify(sl.data)) { Slides.update(sl.id, { data: nd }); changed++; }
  }
  notifyChange();
  send(res, 200, { ok: true, changed, total: list.length });
});
r.get('/api/slides/:id/usage', A, (req, res) => {
  send(res, 200, Playlists.list().filter((p) => p.items.some((i) => i.slide_id === id(req))).map((p) => ({ id: p.id, name: p.name })));
});

crudRoutes('calendars', Calendars, { order: 'name' });
r.post('/api/calendars/:id/refresh', A, async (req, res) => {
  const c = Calendars.get(id(req));
  if (!c) throw new HttpError(404, 'Nem található');
  await refreshIcal(c);
  notifyChange();
  send(res, 200, Calendars.get(c.id));
});
r.get('/api/events', A, (req, res) => {
  const cid = +req.query.get('calendar_id');
  send(res, 200, cid ? all('SELECT * FROM events WHERE calendar_id = ? ORDER BY start', cid) : all('SELECT * FROM events ORDER BY start'));
});
r.post('/api/events', A, async (req, res) => { const e = Events.create(await readBody(req)); notifyChange(); send(res, 200, e); });
r.put('/api/events/:id', A, async (req, res) => { const e = Events.update(id(req), await readBody(req)); notifyChange(); send(res, 200, e); });
r.del('/api/events/:id', A, (req, res) => { Events.remove(id(req)); notifyChange(); send(res, 200, { ok: true }); });

crudRoutes('forms', Forms, {
  order: 'name',
  validate(b) {
    if (b.fields) {
      const keys = new Set();
      b.fields = b.fields.map((f, i) => {
        let key = (f.key || f.label || `mezo${i}`).toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `mezo${i}`;
        while (keys.has(key)) key += '_';
        keys.add(key);
        return { ...f, key };
      });
    }
    return b;
  },
});
r.get('/api/forms/:id/submissions', A, (req, res) => {
  send(res, 200, all(`SELECT sub.*, sc.name screen_name FROM submissions sub LEFT JOIN screens sc ON sc.id = sub.screen_id WHERE form_id = ? ORDER BY sub.id DESC`, id(req)));
});
r.get('/api/forms/:id/export.csv', A, (req, res) => {
  const f = Forms.get(id(req));
  if (!f) throw new HttpError(404, 'Nem található');
  const subs = all('SELECT sub.*, sc.name screen_name FROM submissions sub LEFT JOIN screens sc ON sc.id = sub.screen_id WHERE form_id = ? ORDER BY sub.id', f.id);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Időpont', 'Képernyő', ...f.fields.map((x) => x.label)];
  const rows = subs.map((s) => [new Date(s.created_at).toLocaleString('hu-HU'), s.screen_name || '', ...f.fields.map((x) => (typeof s.data[x.key] === 'boolean' ? (s.data[x.key] ? 'igen' : 'nem') : s.data[x.key]))]);
  const csv = '﻿' + [head, ...rows].map((row) => row.map(esc).join(';')).join('\r\n');
  send(res, 200, csv, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="urlap-${f.id}.csv"` });
});
r.del('/api/submissions/:id', A, (req, res) => { run('DELETE FROM submissions WHERE id = ?', id(req)); send(res, 200, { ok: true }); });

// ---------- Képernyők ----------
r.get('/api/screens', A, (req, res) => {
  send(res, 200, {
    screens: all('SELECT * FROM screens WHERE approved = 1 ORDER BY name').map(screenOut),
    pending: all('SELECT * FROM screens WHERE approved = 0 AND last_seen > ? ORDER BY last_seen DESC', now() - 600e3).map(screenOut),
  });
});
r.post('/api/screens/pair', A, async (req, res) => {
  const { code, name, playlist_id } = await readBody(req);
  const s = get('SELECT * FROM screens WHERE code = ? AND approved = 0', String(code || '').replace(/\D/g, ''));
  if (!s) throw new HttpError(404, 'Nincs ilyen párosító kód. Ellenőrizd a képernyőn megjelenő számot.');
  run('UPDATE screens SET approved = 1, name = ?, playlist_id = ? WHERE id = ?', name || 'Képernyő ' + s.id, playlist_id || null, s.id);
  pushTo(s.device_id, 'refresh');
  send(res, 200, screenOut(get('SELECT * FROM screens WHERE id = ?', s.id)));
});
r.put('/api/screens/:id', A, async (req, res) => {
  const s = Screens.get(id(req));
  if (!s) throw new HttpError(404, 'Nem található');
  const b = await readBody(req);
  Screens.update(s.id, { name: b.name, playlist_id: b.playlist_id === '' ? null : b.playlist_id, schedule: b.schedule, settings: b.settings });
  pushTo(s.device_id, 'refresh');
  send(res, 200, screenOut(Screens.get(s.id)));
});
r.del('/api/screens/:id', A, (req, res) => {
  const s = Screens.get(id(req));
  if (s) { pushTo(s.device_id, 'unpaired'); run('DELETE FROM screens WHERE id = ?', s.id); }
  send(res, 200, { ok: true });
});
r.post('/api/screens/:id/command', A, async (req, res) => {
  const s = Screens.get(id(req));
  if (!s) throw new HttpError(404, 'Nem található');
  const { command, args } = await readBody(req);
  if (!['reload', 'identify', 'next', 'prev', 'goto', 'refresh', 'clear-cache', 'diag', ...AGENT_COMMANDS].includes(command)) throw new HttpError(400, 'Ismeretlen parancs');
  const map = AGENT_COMMANDS.includes(command) ? agents : streams;
  pushTo(s.device_id, 'command', { command, args }, map);
  if (AGENT_COMMANDS.includes(command)) console.log(`[parancs] ${command} → ${s.name} (${req.user.username})`);
  send(res, 200, { ok: true, delivered: map.has(s.device_id) });
});
r.post('/api/screens/broadcast', A, async (req, res) => {
  const { command } = await readBody(req);
  if (!['reload', 'refresh', 'identify', ...AGENT_COMMANDS].includes(command)) throw new HttpError(400, 'Ismeretlen parancs');
  const map = AGENT_COMMANDS.includes(command) ? agents : streams;
  for (const devId of map.keys()) pushTo(devId, 'command', { command }, map);
  if (AGENT_COMMANDS.includes(command)) console.log(`[parancs] ${command} → minden képernyő (${req.user.username})`);
  send(res, 200, { ok: true, count: map.size });
});

// ---------- Vészjelzések / közlemények ----------
r.get('/api/alerts', A, (req, res) => send(res, 200, all('SELECT * FROM alerts ORDER BY id DESC LIMIT 50')));
r.post('/api/alerts', A, async (req, res) => {
  const b = await readBody(req);
  if (!b.message) throw new HttpError(400, 'Az üzenet nem lehet üres');
  const minutes = +b.minutes || 0;
  run('INSERT INTO alerts (title, message, level, screen_ids, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    b.title || '', b.message, ['info', 'warning', 'danger', 'success'].includes(b.level) ? b.level : 'info',
    b.screen_ids?.length ? JSON.stringify(b.screen_ids.map(Number)) : null, minutes ? now() + minutes * 60e3 : null, now());
  pushAll('alerts');
  send(res, 200, { ok: true });
});
r.del('/api/alerts/:id', A, (req, res) => {
  run('UPDATE alerts SET expires_at = ? WHERE id = ?', now() - 1, id(req));
  pushAll('alerts');
  send(res, 200, { ok: true });
});

// ---------- Beállítások, felhasználók, mentés ----------
r.get('/api/settings', A, (req, res) => send(res, 200, {
  org_name: getSetting('org_name', 'Narancs Signage'), logo_media_id: getSetting('logo_media_id'),
  slogan: getSetting('slogan', ''), branding: getSetting('branding', { preset: 'narancs' }),
  logo_url: mediaMap([getSetting('logo_media_id')])[getSetting('logo_media_id')]?.url || null,
  default_lat: getSetting('default_lat', 47.4979), default_lon: getSetting('default_lon', 19.0402), default_city: getSetting('default_city', 'Budapest'),
  version: VERSION, data_dir: DATA_DIR, node: process.version, uptime: process.uptime(),
}));
r.put('/api/settings', A, async (req, res) => {
  const b = await readBody(req);
  for (const k of ['org_name', 'logo_media_id', 'default_lat', 'default_lon', 'default_city', 'slogan']) if (b[k] !== undefined) setSetting(k, b[k]);
  if (b.branding !== undefined) {
    if (typeof b.branding !== 'object' || Array.isArray(b.branding) || JSON.stringify(b.branding).length > 20000) throw new HttpError(400, 'Érvénytelen arculat');
    setSetting('branding', b.branding);
  }
  notifyChange();
  send(res, 200, { ok: true });
});
r.get('/api/users', A, (req, res) => send(res, 200, listUsers()));
r.post('/api/users', A, async (req, res) => { const b = await readBody(req); createUser(b.username, b.password); send(res, 200, listUsers()); });
r.del('/api/users/:id', A, (req, res) => {
  if (id(req) === req.user.id) throw new HttpError(400, 'Saját magadat nem törölheted');
  run('DELETE FROM users WHERE id = ?', id(req));
  send(res, 200, listUsers());
});
r.post('/api/account/password', A, async (req, res) => {
  const { current, password } = await readBody(req);
  const u = get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!verifyPassword(current || '', u.pass_hash)) throw new HttpError(400, 'A jelenlegi jelszó hibás');
  if (!password || password.length < 6) throw new HttpError(400, 'Az új jelszó legalább 6 karakter legyen');
  run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(password), u.id);
  run('DELETE FROM sessions WHERE user_id = ? AND token != ?', u.id, req.user.token);
  send(res, 200, { ok: true });
});
r.get('/api/backup', A, (req, res) => {
  const tmp = path.join(DATA_DIR, `backup-${now()}.db`);
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  const buf = fs.readFileSync(tmp);
  fs.rmSync(tmp, { force: true });
  send(res, 200, buf, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="signage-${new Date().toISOString().slice(0, 10)}.db"` });
});
r.get('/api/geocode', A, async (req, res) => send(res, 200, await geocode(req.query.get('q') || '')));
r.get('/api/rss-test', A, async (req, res) => send(res, 200, await fetchRss(req.query.get('url') || '')));

// =====================================================================
//  HTTP szerver
// =====================================================================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  req.query = url.searchParams;
  const p = url.pathname;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (p.startsWith('/api/')) {
      const m = r.match(req.method, p);
      if (!m) throw new HttpError(404, 'Ismeretlen végpont');
      req.params = m.params;
      for (const h of m.handlers) {
        await h(req, res);
        if (res.headersSent || res.writableEnded) break;
      }
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Nem engedélyezett');
    if (p === '/') { res.writeHead(302, { Location: '/admin/' }); return res.end(); }
    if (p === '/healthz') return send(res, 200, { ok: true, version: VERSION });
    if (p === '/install-player.sh') {
      // a lejátszó telepítő a szerver saját címével kitöltve: curl … | sudo bash
      const script = fs.readFileSync(path.resolve(__dirname, '..', '..', 'install', 'install-player.sh'), 'utf8');
      const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const origin = `${proto}://${String(req.headers.host || `localhost:${PORT}`).replace(/[^\w.:\-[\]]/g, '')}`;
      return send(res, 200, script.replace('__SIGNAGE_SERVER__', origin), { 'Content-Type': 'text/x-shellscript; charset=utf-8' });
    }
    if (p.startsWith('/media/')) {
      const name = path.basename(p);
      if (serveFile(req, res, path.join(MEDIA_DIR, name), { cache: 'public, max-age=31536000, immutable' })) return;
      throw new HttpError(404, 'Nincs ilyen fájl');
    }
    if (p === '/admin' || p === '/player') { res.writeHead(301, { Location: p + '/' }); return res.end(); }
    if (serveStatic(req, res, PUBLIC_DIR, p)) return;
    // SPA visszaesés az admin felülethez
    if (p.startsWith('/admin/') && serveFile(req, res, path.join(PUBLIC_DIR, 'admin', 'index.html'))) return;
    throw new HttpError(404, 'Nem található');
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    send(res, status, { error: e.message || 'Szerverhiba' });
  }
});
server.requestTimeout = 0; // nagy feltöltések és SSE miatt
server.headersTimeout = 60000;

server.listen(PORT, HOST, () => {
  console.log(`Narancs Signage v${VERSION} fut: http://${HOST}:${PORT}  (adatok: ${DATA_DIR})`);
});

// iCal naptárak frissítése 15 percenként
setTimeout(refreshAllIcal, 5000);
setInterval(async () => { await refreshAllIcal(); notifyChange(); }, 15 * 60e3);
// régi statisztikák törlése (90 nap)
setInterval(() => run('DELETE FROM stats WHERE created_at < ?', now() - 90 * 864e5), 6 * 3600e3);
// lejárt riasztások után frissítés
setInterval(() => {
  const expired = get('SELECT COUNT(*) n FROM alerts WHERE expires_at BETWEEN ? AND ?', now() - 30e3, now()).n;
  if (expired) pushAll('alerts');
}, 30e3);

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.close(); db.close(); process.exit(0); });
