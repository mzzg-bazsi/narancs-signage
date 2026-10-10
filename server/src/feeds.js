// Külső adatforrások: iCal naptár, RSS hírfolyam, időjárás (Open-Meteo, kulcs nélkül)
import { all, run } from './db.js';
import { lang, tr } from './i18n.js';

const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  try {
    const value = await fn();
    cache.set(key, { value, until: Date.now() + ttlMs });
    return value;
  } catch (e) {
    if (hit) return hit.value; // hiba esetén a régi adatot adjuk vissza
    throw e;
  }
}

async function fetchText(url, timeout = 10000) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Csak http(s) URL engedélyezett');
  const r = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'User-Agent': 'NarancsSignage/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

// ---------- iCal ----------
function icalDate(v, params = '') {
  // 20261009T143000Z | 20261009T143000 | 20261009
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h) return { iso: `${y}-${mo}-${d}`, allDay: true };
  if (z) return { iso: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString(), allDay: false };
  // helyi idő (TZID-t egyszerűsítve a szerver időzónájaként kezeljük)
  return { iso: new Date(+y, +mo - 1, +d, +h, +mi, +s).toISOString(), allDay: false, params };
}

function unescapeIcal(s) {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

// Ismétlődő események (RRULE) kibontása: DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL,
// BYDAY (pl. MO,WE vagy havi 2TU, -1FR), BYMONTHDAY, BYMONTH; EXDATE kihagyás, RECURRENCE-ID felülírás.
const WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const pad2 = (n) => String(n).padStart(2, '0');
const toLocalDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseStart = (e) => (e.all_day ? new Date(`${e.start}T00:00:00`) : new Date(e.start));

export function expandRrule(ev, from, to) {
  const r = Object.fromEntries(ev.rrule.split(';').map((p) => p.split('=')));
  const freq = r.FREQ, interval = Math.max(1, +r.INTERVAL || 1);
  const count = +r.COUNT || Infinity;
  const u = r.UNTIL && icalDate(r.UNTIL);
  const until = !u ? Infinity : Date.parse(u.allDay ? `${u.iso}T23:59:59` : u.iso);
  const start = parseStart(ev);
  const dur = (ev.end ? parseStart({ ...ev, start: ev.end }) : start) - start;
  const byday = r.BYDAY ? r.BYDAY.split(',').map((x) => { const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(x); return m && { n: m[1] ? +m[1] : 0, wd: WD[m[2]] }; }).filter(Boolean) : null;
  const bymonthday = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null;
  const bymonth = r.BYMONTH ? r.BYMONTH.split(',').map(Number) : null;
  const at = (y, m, d) => new Date(y, m, d, start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());

  // egy időszak (nap / hét / hónap / év) jelölt időpontjai, időrendben
  function candidates(k) {
    if (freq === 'DAILY') return [at(start.getFullYear(), start.getMonth(), start.getDate() + k * interval)];
    if (freq === 'WEEKLY') {
      const wkStart = at(start.getFullYear(), start.getMonth(), start.getDate() - ((start.getDay() + 6) % 7) + k * 7 * interval); // hétfő
      const days = byday ? byday.map((b) => b.wd) : [start.getDay()];
      return days.map((wd) => at(wkStart.getFullYear(), wkStart.getMonth(), wkStart.getDate() + ((wd + 6) % 7))).sort((a, b) => a - b);
    }
    if (freq === 'MONTHLY' || freq === 'YEARLY') {
      const ym = freq === 'MONTHLY'
        ? [[start.getFullYear(), start.getMonth() + k * interval]]
        : (bymonth ? bymonth.map((x) => x - 1) : [start.getMonth()]).map((m) => [start.getFullYear() + k * interval, m]);
      const out = [];
      for (const [yy, mm] of ym) {
        const y = yy + Math.floor(mm / 12), m = mm % 12;
        const last = new Date(y, m + 1, 0).getDate();
        if (byday) {
          for (const b of byday) {
            const all = [];
            for (let d = 1; d <= last; d++) if (new Date(y, m, d).getDay() === b.wd) all.push(d);
            const pick = b.n === 0 ? all : [b.n > 0 ? all[b.n - 1] : all[all.length + b.n]];
            for (const d of pick) if (d) out.push(at(y, m, d));
          }
        } else {
          for (const md of bymonthday || [start.getDate()]) { const d = md < 0 ? last + md + 1 : md; if (d >= 1 && d <= last) out.push(at(y, m, d)); }
        }
      }
      return out.sort((a, b) => a - b);
    }
    return [];
  }

  const ex = new Set((ev.exdates || []).map((x) => (x.length === 10 ? x : String(Date.parse(x)))));
  const isEx = (d) => ex.has(ev.all_day ? toLocalDate(d) : String(d.getTime()));
  const out = [];
  let n = 0;
  // régi kezdetű, darabszám nélküli sorozatnál az ablak elejéhez ugrunk (ne fogyjon el a 5000-es keret)
  let k0 = 0;
  if (count === Infinity && from > start) {
    const days = (from - start) / 864e5;
    k0 = Math.max(0, Math.floor({ DAILY: days, WEEKLY: days / 7, MONTHLY: days / 31, YEARLY: days / 366 }[freq] / interval) - 1);
  }
  for (let k = k0; k < k0 + 5000 && n < count; k++) {
    const list = candidates(k);
    if (list.length && list[0] > to) break;
    for (const d of list) {
      if (d < start || n >= count) continue;
      if (d.getTime() > until) return out;
      n++;
      if (isEx(d) || d.getTime() + dur < from || d > to) continue;
      const end = new Date(d.getTime() + dur);
      out.push({ ...ev, start: ev.all_day ? toLocalDate(d) : d.toISOString(), end: ev.all_day ? toLocalDate(end) : end.toISOString() });
    }
  }
  return out;
}

export function parseIcal(text, from = Date.now() - 30 * 864e5, to = Date.now() + 365 * 864e5) {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let ev = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') {
      if (ev?.start) events.push(ev);
      ev = null; continue;
    }
    if (!ev) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const [name, ...params] = line.slice(0, idx).split(';');
    const value = line.slice(idx + 1);
    switch (name) {
      case 'UID': ev.uid = value; break;
      case 'SUMMARY': ev.title = unescapeIcal(value); break;
      case 'DESCRIPTION': ev.description = unescapeIcal(value); break;
      case 'LOCATION': ev.location = unescapeIcal(value); break;
      case 'RRULE': ev.rrule = value; break;
      case 'EXDATE': (ev.exdates ||= []).push(...value.split(',').map((v) => icalDate(v)?.iso).filter(Boolean)); break;
      case 'RECURRENCE-ID': ev.recurrenceId = icalDate(value)?.iso; break;
      case 'DTSTART': { const d = icalDate(value, params.join(';')); if (d) { ev.start = d.iso; ev.all_day = d.allDay ? 1 : 0; } break; }
      case 'DTEND': {
        const d = icalDate(value);
        if (!d) break;
        // iCal-ban az egész napos esemény vége kizárólagos → az előző napot tároljuk (befoglaló)
        if (d.allDay) { const t = new Date(d.iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); ev.end = t.toISOString().slice(0, 10); } else ev.end = d.iso;
        break;
      }
    }
  }
  // a RECURRENCE-ID-s példányok felülírják a sorozat adott előfordulását
  const overridden = new Set(events.filter((e) => e.recurrenceId && e.uid).map((e) => `${e.uid}|${e.recurrenceId}`));
  const out = [];
  for (const e of events) {
    if (!e.rrule || e.recurrenceId) { out.push(e); continue; }
    for (const o of expandRrule(e, from, to)) if (!overridden.has(`${e.uid}|${o.start}`)) out.push(o);
  }
  return out.map((e) => ({ title: e.title || tr('(névtelen)'), description: e.description || '', location: e.location || '', start: e.start, end: e.end || e.start, all_day: e.all_day }));
}

export async function refreshIcal(calendar) {
  if (!calendar.ical_url) return;
  try {
    // csak a -30..+365 nap közötti eseményeket tároljuk (az ismétlődőket ebben az ablakban bontjuk ki)
    const from = Date.now() - 30 * 864e5, to = Date.now() + 365 * 864e5;
    const events = parseIcal(await fetchText(calendar.ical_url, 20000), from, to);
    const keep = events.filter((e) => { const t = Date.parse(e.start); return t >= from && t <= to; });
    run('UPDATE calendars SET ical_cache = ?, ical_fetched = ? WHERE id = ?', JSON.stringify(keep), Date.now(), calendar.id);
  } catch (e) {
    console.warn(`[ical] ${calendar.name}: ${e.message}`);
  }
}

export async function refreshAllIcal() {
  for (const c of all("SELECT * FROM calendars WHERE ical_url != ''")) await refreshIcal(c);
}

// ---------- RSS / Atom ----------
function decodeEntities(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
}
const stripTags = (s) => decodeEntities(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (block, name) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(block); return m ? m[1] : ''; };

export function fetchRss(url) {
  return cached('rss:' + url, 10 * 60e3, async () => {
    const xml = await fetchText(url);
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
    const feedTitle = stripTags(tag(xml.replace(/<item[\s\S]*$/i, ''), 'title'));
    const items = blocks.slice(0, 30).map((b) => {
      const img = /<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i.exec(b) || /<enclosure[^>]*url="([^"]+)"[^>]*type="image/i.exec(b) || /<img[^>]*src="([^"]+)"/i.exec(decodeEntities(b));
      return {
        title: stripTags(tag(b, 'title')),
        summary: stripTags(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content')).slice(0, 400),
        date: stripTags(tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published')),
        image: img ? decodeEntities(img[1]) : null,
      };
    });
    return { title: feedTitle, items };
  });
}

// ---------- Időjárás ----------
export function fetchWeather(lat, lon) {
  const key = `wx:${(+lat).toFixed(2)},${(+lon).toFixed(2)}`;
  return cached(key, 15 * 60e3, async () => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${+lat}&longitude=${+lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
    return JSON.parse(await fetchText(url));
  });
}

export function geocode(q) {
  return cached(`geo:${lang()}:` + q.toLowerCase(), 24 * 3600e3, async () => {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${lang()}&format=json`;
    const j = JSON.parse(await fetchText(url));
    return (j.results || []).map((r) => ({ name: r.name, country: r.country, admin: r.admin1, lat: r.latitude, lon: r.longitude }));
  });
}
