// Közösségi sablongaléria: a GitHub Pages-en közzétett index.json és sablonfájlok (narancs-signage-templates repó).
// A szerver tölti le őket (rövid gyorsítótárral), így a böngészőnek nem kell külső oldalt elérnie.
import { HttpError } from './http.js';

export const GALLERY_URL = (process.env.SIGNAGE_GALLERY || 'https://mzzg-bazsi.github.io/narancs-signage-templates/').replace(/\/?$/, '/');
export const GALLERY_REPO = 'https://github.com/mzzg-bazsi/narancs-signage-templates';
const TTL = 10 * 60e3, MAX = 64 * 1024 * 1024;
const cache = new Map();

async function getJson(url) {
  const hit = cache.get(url);
  if (hit && hit.until > Date.now()) return hit.value;
  let value;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'NarancsSignage' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    if (+r.headers.get('content-length') > MAX) throw new Error('too large');
    const text = await r.text();
    if (text.length > MAX) throw new Error('too large');
    value = JSON.parse(text);
  } catch (e) {
    if (hit) return hit.value; // hálózati hiba esetén a korábbi adat
    console.warn(`[galéria] ${url}: ${e.message}`);
    throw new HttpError(502, 'A közösségi galéria most nem érhető el');
  }
  cache.set(url, { value, until: Date.now() + TTL });
  return value;
}

export const galleryIndex = () => getJson(`${GALLERY_URL}index.json`);

// egy sablon a galériából, az azonosítója alapján (az útvonalat az indexből vesszük, nem a kérésből)
export async function galleryTemplate(id) {
  if (!/^[a-z0-9-]{1,60}$/.test(id)) throw new HttpError(400, 'Érvénytelen azonosító');
  const entry = (await galleryIndex()).templates?.find((t) => t.id === id);
  if (!entry) throw new HttpError(404, 'Nem található');
  return { entry, template: await getJson(new URL(entry.file, GALLERY_URL).href) };
}
