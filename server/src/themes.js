// Saját (importált / megosztott) arculati témák ellenőrzése – a színek CSS-be kerülnek, ezért csak szigorú formátum mehet át
import { HttpError } from './http.js';

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}(\.\d+)?%?\s*(,\s*\d{1,3}(\.\d+)?%?\s*){2}(,\s*(0|1|0?\.\d+)\s*)?\)|color-mix\(in srgb, #[0-9a-f]{3,8} \d{1,3}%, transparent\))$/i;
const COLOR_KEYS = ['accent', 'accent_fg', 'bg', 'bg2', 'fg', 'surface', 'muted'];
const word = (v) => typeof v === 'string' && /^[a-z]{2,20}$/.test(v);
const KEY = /^my_[a-z0-9]{4,24}$/;

export function cleanTheme(t) {
  const bad = () => new HttpError(400, 'Érvénytelen téma');
  if (!t || typeof t !== 'object' || Array.isArray(t)) throw bad();
  const name = String(t.name || '').trim().slice(0, 60);
  if (!name) throw bad();
  const out = { name, desc: String(t.desc || '').trim().slice(0, 140), mode: t.mode === 'light' ? 'light' : 'dark' };
  out.font = word(t.font) ? t.font : 'system';
  out.head_font = word(t.head_font) ? t.head_font : out.font;
  out.radius = word(t.radius) ? t.radius : 'round';
  for (const m of ['dark', 'light']) {
    const c = t[m];
    if (!c || typeof c !== 'object') throw bad();
    out[m] = {};
    for (const k of COLOR_KEYS) {
      if (!COLOR.test(String(c[k] ?? ''))) throw bad();
      out[m][k] = c[k];
    }
  }
  return out;
}

export function cleanThemes(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new HttpError(400, 'Érvénytelen téma');
  const entries = Object.entries(map);
  if (entries.length > 50) throw new HttpError(400, 'Legfeljebb 50 saját téma lehet');
  return Object.fromEntries(entries.map(([k, t]) => {
    if (!KEY.test(k)) throw new HttpError(400, 'Érvénytelen téma');
    return [k, cleanTheme(t)];
  }));
}
