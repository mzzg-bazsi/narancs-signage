// Tartalomsablonok: export (.narancs.json), ellenőrzött import, előnézet mentés nélkül.
// Formátum: { format: 'narancs-template', version: 1, meta, slides, playlist, forms, calendars, media }
// A hivatkozások (tartalom, űrlap, naptár, média) azonosítók helyett „ref” nevek (s1, f1, c1, m1).
// Kétnyelvű szöveg: { en: '…', hu: '…' } – importáláskor a rendszer nyelvén. Helyőrzők: {{org_name}}, {{city}}, {{date+N}}.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { get, run, MEDIA_DIR, Slides, Playlists, Calendars, Events, Forms, getSetting } from './db.js';
import { HttpError, MIME } from './http.js';
import { lang } from './i18n.js';

export const FORMAT = 'narancs-template';
export const SLIDE_TYPES = ['image', 'video', 'web', 'text', 'cards', 'calendar', 'form', 'menu', 'clock', 'rss', 'countdown', 'html', 'qr', 'pdf', 'zones'];
const MEDIA_MIME = /^(image\/(jpeg|png|webp|gif|svg\+xml)|video\/(mp4|webm)|application\/pdf)$/;
const LIMITS = { slides: 200, forms: 50, calendars: 50, events: 500, media: 100, mediaBytes: 40 * 1024 * 1024 };

// a tartalom adataiban hivatkozást tartalmazó kulcsok
const REF_KEYS = { target_slide: 'slide', slide_id: 'slide', form_id: 'form', calendar_ids: 'calendar', media_id: 'media', bg_media_id: 'media', logo_media_id: 'media', media_ids: 'media' };

// mélységi bejárás: minden hivatkozást a fn(kind, érték) eredményére cserél (a képváltó feliratai médiaazonosító kulcsúak)
function mapRefs(v, fn) {
  if (Array.isArray(v)) return v.map((x) => mapRefs(x, fn));
  if (!v || typeof v !== 'object') return v;
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    const kind = REF_KEYS[k];
    if (kind && x != null && x !== '') out[k] = Array.isArray(x) ? x.map((y) => fn(kind, y)).filter((y) => y != null) : fn(kind, x);
    else if (k === 'captions' && x && typeof x === 'object' && !Array.isArray(x)) out[k] = Object.fromEntries(Object.entries(x).map(([mk, c]) => [fn('media', mk), c]).filter(([mk]) => mk != null));
    else out[k] = mapRefs(x, fn);
  }
  return out;
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

// kétnyelvű szövegek és helyőrzők feloldása
function localize(v, ctx) {
  if (typeof v === 'string') {
    return v.replace(/\{\{org_name\}\}/g, ctx.org).replace(/\{\{city\}\}/g, ctx.city).replace(/\{\{date([+-]\d+)?\}\}/g, (_, n) => ymd(addDays(+(n || 0))));
  }
  if (Array.isArray(v)) return v.map((x) => localize(x, ctx));
  if (!v || typeof v !== 'object') return v;
  const keys = Object.keys(v);
  if (keys.length && keys.every((k) => k === 'en' || k === 'hu') && keys.every((k) => typeof v[k] === 'string')) return localize(v[ctx.lang] ?? v.en ?? v[keys[0]], ctx);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, localize(x, ctx)]));
}
// a sablon nyelve választható (kétnyelvű sablonoknál), alapból a rendszer nyelve
const LANGS = ['en', 'hu'];
const localCtx = (l) => ({ lang: LANGS.includes(l) ? l : lang(), org: getSetting('org_name', 'Narancs Signage'), city: getSetting('default_city', 'Budapest') });
export const localized = (v, l) => localize(v, localCtx(l));

// óra: ha a sablon nem ad meg helyet, az alapértelmezett város
function fillClock(slide) {
  if (slide.type !== 'clock' || slide.data?.lat) return slide;
  return { ...slide, data: { city: getSetting('default_city', 'Budapest'), lat: getSetting('default_lat', 47.4979), lon: getSetting('default_lon', 19.0402), ...slide.data } };
}

// relatív esemény (day: +N, start/end: 'ÓÓ:PP') → tárolható esemény
function eventFrom(e) {
  if (e.start && /^\d{4}-/.test(e.start)) return { title: e.title, description: e.description || '', location: e.location || '', start: e.start, end: e.end || e.start, all_day: e.all_day ? 1 : 0, rrule: e.rrule || '' };
  const day = addDays(+e.day || 0);
  if (e.all_day) return { title: e.title, description: e.description || '', location: e.location || '', start: ymd(day), end: ymd(day), all_day: 1, rrule: e.rrule || '' };
  const at = (hm) => { const [h, m] = String(hm || '09:00').split(':').map(Number); const d = new Date(day); d.setHours(h || 0, m || 0, 0, 0); return d.toISOString(); };
  return { title: e.title, description: e.description || '', location: e.location || '', start: at(e.start), end: at(e.end || e.start), all_day: 0, rrule: e.rrule || '' };
}

// ---------------------------------------------------------------------
//  Ellenőrzés (idegen fájl → csak ismert szerkezet, méretkorlátokkal)
// ---------------------------------------------------------------------
export function validateTemplate(t) {
  // a részlet technikai (mező- vagy hivatkozásnév), ezért nyelvtől független
  const bad = (detail) => { throw new HttpError(400, 'Hibás sablon: {detail}', { detail }); };
  if (!t || typeof t !== 'object' || t.format !== FORMAT) throw new HttpError(400, 'Ez a fájl nem Narancs Signage sablon');
  if (t.version !== 1) throw new HttpError(400, 'Nem támogatott sablon verzió: {v}', { v: String(t.version) });
  const arr = (k, max) => { const a = t[k] ?? []; if (!Array.isArray(a) || a.length > max) bad(k); return a; };
  const slides = arr('slides', LIMITS.slides), forms = arr('forms', LIMITS.forms), cals = arr('calendars', LIMITS.calendars), media = arr('media', LIMITS.media);
  if (!slides.length) bad('slides: 0');
  const refs = { slide: new Set(), form: new Set(), calendar: new Set(), media: new Set() };
  const ref = (kind, x) => { if (typeof x?.ref !== 'string' || !/^[\w-]{1,40}$/.test(x.ref) || refs[kind].has(x.ref)) bad(`${kind} ref ${x?.ref}`); refs[kind].add(x.ref); };
  for (const s of slides) {
    ref('slide', s);
    if (!SLIDE_TYPES.includes(s.type)) bad(`type ${s.type}`);
    if (s.data != null && (typeof s.data !== 'object' || Array.isArray(s.data))) bad(`${s.ref} data`);
  }
  for (const f of forms) { ref('form', f); if (!Array.isArray(f.fields ?? [])) bad(`${f.ref} fields`); }
  let events = 0;
  for (const c of cals) { ref('calendar', c); events += (c.events || []).length; }
  if (events > LIMITS.events) bad(`events > ${LIMITS.events}`);
  let bytes = 0;
  for (const m of media) {
    ref('media', m);
    if (!MEDIA_MIME.test(m.mime || '') || typeof m.data !== 'string') bad(`media ${m.ref} ${m.mime}`);
    bytes += m.data.length * 0.75;
  }
  if (bytes > LIMITS.mediaBytes) bad('media > 40 MB');
  // minden hivatkozás létező elemre mutasson
  for (const s of slides) mapRefs(s.data || {}, (kind, v) => { if (!refs[kind].has(String(v))) bad(`${s.ref} → ${kind} ${v}`); return v; });
  if (t.playlist && !Array.isArray(t.playlist.items)) bad('playlist items');
  for (const it of t.playlist?.items || []) if (!refs.slide.has(it.slide)) bad(`playlist → ${it.slide}`);
  return t;
}

// ---------------------------------------------------------------------
//  Export
// ---------------------------------------------------------------------
export function exportTemplate({ slideIds = [], playlistId = null, meta = {} }, version) {
  const pl = playlistId ? Playlists.get(playlistId) : null;
  if (playlistId && !pl) throw new HttpError(404, 'Nem található');
  // a tartalmak és mindaz, amire hivatkoznak (menü/kártya célok, zónák)
  const order = [], seen = new Set();
  const queue = [...(pl?.items || []).map((i) => +i.slide_id), ...slideIds.map(Number)];
  const used = { form: new Set(), calendar: new Set(), media: new Set() };
  while (queue.length) {
    const sid = queue.shift();
    if (seen.has(sid)) continue;
    const s = Slides.get(sid);
    if (!s) continue;
    seen.add(sid); order.push(s);
    mapRefs(s.data || {}, (kind, v) => { if (kind === 'slide') queue.push(+v); else used[kind].add(+v); return v; });
  }
  if (!order.length) throw new HttpError(400, 'Nincs exportálható tartalom');
  const refOf = { slide: new Map(), form: new Map(), calendar: new Map(), media: new Map() };
  order.forEach((s, i) => refOf.slide.set(s.id, `s${i + 1}`));
  [...used.form].forEach((id, i) => refOf.form.set(id, `f${i + 1}`));
  [...used.calendar].forEach((id, i) => refOf.calendar.set(id, `c${i + 1}`));
  [...used.media].forEach((id, i) => refOf.media.set(id, `m${i + 1}`));
  const toRef = (kind, v) => refOf[kind].get(+v) ?? null; // nem létező hivatkozás kimarad

  const media = [];
  let bytes = 0;
  for (const [id, ref] of refOf.media) {
    const m = get('SELECT * FROM media WHERE id = ?', id);
    const file = m && path.join(MEDIA_DIR, m.filename);
    if (!m || !fs.existsSync(file)) { refOf.media.delete(id); continue; }
    const buf = fs.readFileSync(file);
    bytes += buf.length;
    if (bytes > LIMITS.mediaBytes) throw new HttpError(413, 'A sablon médiafájljai együtt legfeljebb 40 MB-osak lehetnek');
    media.push({ ref, name: m.name, mime: m.mime, data: buf.toString('base64') });
  }
  return {
    format: FORMAT, version: 1,
    meta: { name: String(meta.name || pl?.name || order[0].name).slice(0, 120), description: String(meta.description || '').slice(0, 1000), category: String(meta.category || 'other').slice(0, 40), author: String(meta.author || getSetting('org_name', '')).slice(0, 120), license: meta.license || 'CC0-1.0', lang: lang(), app_version: version, created: new Date().toISOString() },
    slides: order.map((s) => ({ ref: refOf.slide.get(s.id), name: s.name, type: s.type, duration: s.duration, data: mapRefs(s.data || {}, toRef) })),
    playlist: pl ? { name: pl.name, transition: pl.transition, items: pl.items.filter((i) => refOf.slide.has(+i.slide_id)).map((i) => ({ slide: refOf.slide.get(+i.slide_id), duration: i.duration || null })) } : null,
    // a személyes adatok (beküldések, saját események, iCal linkek) nem kerülnek bele
    forms: [...refOf.form].map(([id, ref]) => { const f = Forms.get(id); return f && { ref, name: f.name, title: f.title, intro: f.intro, fields: f.fields, submit_text: f.submit_text, thanks_text: f.thanks_text }; }).filter(Boolean),
    calendars: [...refOf.calendar].map(([id, ref]) => { const c = Calendars.get(id); return c && { ref, name: c.name, color: c.color, events: [] }; }).filter(Boolean),
    media,
  };
}

// ---------------------------------------------------------------------
//  Import
// ---------------------------------------------------------------------
export function normalizeFormFields(fields = []) {
  const keys = new Set();
  return fields.map((f, i) => {
    let key = (f.key || f.label || `mezo${i}`).toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `mezo${i}`;
    while (keys.has(key)) key += '_';
    keys.add(key);
    return { ...f, key };
  });
}

export function importTemplate(raw, { lang: l } = {}) {
  const t = localize(validateTemplate(raw), localCtx(l));
  const ids = { slide: new Map(), form: new Map(), calendar: new Map(), media: new Map() };
  const written = [];
  try {
    db_tx(() => {
      for (const m of t.media || []) {
        const buf = Buffer.from(m.data, 'base64');
        const ext = Object.entries(MIME).find(([, v]) => v === m.mime)?.[0] || path.extname(m.name || '') || '';
        const filename = crypto.randomBytes(12).toString('hex') + ext;
        fs.writeFileSync(path.join(MEDIA_DIR, filename), buf);
        written.push(filename);
        const r = run('INSERT INTO media (name, filename, mime, size, created_at) VALUES (?, ?, ?, ?, ?)', String(m.name || filename).slice(0, 200), filename, m.mime, buf.length, Date.now());
        ids.media.set(m.ref, Number(r.lastInsertRowid));
      }
      for (const f of t.forms || []) {
        const x = Forms.create({ name: String(f.name || f.title || 'Űrlap').slice(0, 120), title: f.title || '', intro: f.intro || '', fields: normalizeFormFields(f.fields), submit_text: f.submit_text || 'Küldés', thanks_text: f.thanks_text || 'Köszönjük!' });
        ids.form.set(f.ref, x.id);
      }
      for (const c of t.calendars || []) {
        const x = Calendars.create({ name: String(c.name || 'Naptár').slice(0, 120), color: c.color || 'var(--accent)' });
        ids.calendar.set(c.ref, x.id);
        for (const e of c.events || []) Events.create({ calendar_id: x.id, ...eventFrom(e) });
      }
      // két lépés: előbb létrehozzuk a tartalmakat, aztán az adataikban a hivatkozásokat azonosítókra cseréljük
      for (const s of t.slides) ids.slide.set(s.ref, Slides.create({ name: String(s.name || s.type).slice(0, 120), type: s.type, duration: Math.max(0, Math.min(86400, +s.duration || 0)), data: {} }).id);
      const toId = (kind, v) => ids[kind].get(String(v)) ?? null;
      for (const s of t.slides) Slides.update(ids.slide.get(s.ref), { data: fillClock({ type: s.type, data: mapRefs(s.data || {}, toId) }).data });
      if (t.playlist) {
        const p = Playlists.create({ name: String(t.playlist.name || t.meta?.name || 'Sablon').slice(0, 120), transition: t.playlist.transition || 'fade',
          items: t.playlist.items.map((i) => ({ slide_id: ids.slide.get(i.slide), duration: i.duration ? +i.duration : null, enabled: true, valid_from: null, valid_to: null })) });
        ids.playlist = p.id;
      }
    });
  } catch (e) {
    for (const f of written) fs.rmSync(path.join(MEDIA_DIR, f), { force: true });
    throw e;
  }
  return { playlist_id: ids.playlist || null, slide_ids: [...ids.slide.values()], first_slide_id: ids.slide.get(t.slides[0].ref), counts: { slides: ids.slide.size, forms: ids.form.size, calendars: ids.calendar.size, media: ids.media.size } };
}

// tranzakció: hiba esetén semmi nem marad félkészen az adatbázisban
function db_tx(fn) {
  run('BEGIN');
  try { fn(); run('COMMIT'); } catch (e) { run('ROLLBACK'); throw e; }
}

// ---------------------------------------------------------------------
//  Előnézet mentés nélkül (negatív azonosítókkal)
// ---------------------------------------------------------------------
export function templatePreview(raw, org, { lang: l } = {}) {
  const ctx = localCtx(l);
  const t = localize(validateTemplate(raw), ctx);
  org = { ...org, lang: ctx.lang }; // a lejátszó feliratai (dátumok) is a sablon nyelvén
  const ids = { slide: new Map(), form: new Map(), calendar: new Map(), media: new Map() };
  for (const k of ['slide', 'form', 'calendar', 'media']) (k === 'slide' ? t.slides : t[`${k}s`] || []).forEach((x, i) => ids[k].set(x.ref, -(i + 1)));
  const toId = (kind, v) => ids[kind].get(String(v)) ?? null;
  const slides = Object.fromEntries(t.slides.map((s) => { const id = ids.slide.get(s.ref); return [id, fillClock({ id, name: s.name, type: s.type, duration: +s.duration || 0, data: mapRefs(s.data || {}, toId) })]; }));
  const media = Object.fromEntries((t.media || []).map((m) => { const id = ids.media.get(m.ref); return [id, { id, url: `data:${m.mime};base64,${m.data}`, mime: m.mime, name: m.name }]; }));
  const forms = Object.fromEntries((t.forms || []).map((f) => { const id = ids.form.get(f.ref); return [id, { id, title: f.title || f.name, intro: f.intro, fields: normalizeFormFields(f.fields), submit_text: f.submit_text, thanks_text: f.thanks_text }]; }));
  const calendars = Object.fromEntries((t.calendars || []).map((c) => [ids.calendar.get(c.ref), (c.events || []).map((e) => ({ ...eventFrom(e), all_day: !!e.all_day, color: c.color || 'var(--accent)', calendar: c.name }))]));
  let items = t.playlist ? t.playlist.items.map((i) => ({ slide_id: ids.slide.get(i.slide), duration: i.duration || null })) : [{ slide_id: -1 }];
  // a meta.preview tartalommal kezdünk (galéria előnézet)
  const start = items.findIndex((i) => i.slide_id === ids.slide.get(t.meta?.preview));
  if (start > 0) items = [...items.slice(start), ...items.slice(0, start)];
  return {
    screen: { id: 0, name: t.meta?.name || '', playlist_id: -1, schedule: [], settings: { idle_return: 30 } },
    org, playlists: { [-1]: { id: -1, name: t.meta?.name || '', transition: t.playlist?.transition || 'fade', items } },
    slides, media, forms, calendars, alerts: [], version: String(Date.now()),
  };
}
