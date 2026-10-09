// Külső adatforrások: iCal naptár, RSS hírfolyam, időjárás (Open-Meteo, kulcs nélkül)
import { all, run } from './db.js';

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

export function parseIcal(text) {
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
      case 'SUMMARY': ev.title = unescapeIcal(value); break;
      case 'DESCRIPTION': ev.description = unescapeIcal(value); break;
      case 'LOCATION': ev.location = unescapeIcal(value); break;
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
  return events.map((e) => ({ title: e.title || '(névtelen)', description: e.description || '', location: e.location || '', start: e.start, end: e.end || e.start, all_day: e.all_day }));
}

export async function refreshIcal(calendar) {
  if (!calendar.ical_url) return;
  try {
    const events = parseIcal(await fetchText(calendar.ical_url, 20000));
    // csak a -30..+365 nap közötti eseményeket tároljuk
    const from = Date.now() - 30 * 864e5, to = Date.now() + 365 * 864e5;
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
  return cached('geo:' + q.toLowerCase(), 24 * 3600e3, async () => {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=hu&format=json`;
    const j = JSON.parse(await fetchText(url));
    return (j.results || []).map((r) => ({ name: r.name, country: r.country, admin: r.admin1, lat: r.latitude, lon: r.longitude }));
  });
}
