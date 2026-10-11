// Frissítések keresése: a GitHub legfrissebb kiadása, és a telepítés módjához illő frissítő parancs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from './db.js';
import { HttpError } from './http.js';

const REPO = 'mzzg-bazsi/narancs-signage';
const INSTALL = `https://github.com/${REPO}/releases/latest/download/install.sh`;
const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let cache = null;

// '1.10.0' > '1.9.9' – számonként hasonlít
export function newer(a, b) {
  const x = String(a).replace(/^v/, '').split('.').map(Number), y = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}

// a telepítés módja a program helyéből (a már telepített rendszereken is módosítás nélkül működik)
export function installType(dir = APP_DIR) {
  if (fs.existsSync('/.dockerenv')) return 'docker';
  if (dir === '/opt/narancs-signage') return 'linux';
  if (dir.includes('/Library/Application Support/Narancs Signage')) return 'macos';
  return 'manual';
}

export function updateCommand(type, port) {
  const opts = [port && +port !== 8080 ? `--port ${+port}` : '', DATA_DIR !== '/var/lib/narancs-signage' && type === 'linux' ? `--data ${DATA_DIR}` : ''].filter(Boolean).join(' ');
  const args = opts ? ` -s -- ${opts}` : '';
  return {
    linux: `curl -fsSL ${INSTALL} | sudo bash${args}`,
    macos: `curl -fsSL ${INSTALL} | bash${args}`,
    docker: 'docker compose pull && docker compose up -d',
    manual: 'git pull',
  }[type];
}

export async function checkUpdates(current, port) {
  if (!cache || cache.until < Date.now()) {
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { 'User-Agent': 'NarancsSignage', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      cache = { until: Date.now() + 30 * 60e3, latest: String(j.tag_name || '').replace(/^v/, ''), url: j.html_url, published_at: j.published_at };
    } catch (e) {
      console.warn('[frissítések]', e.message);
      throw new HttpError(502, 'Nem sikerült ellenőrizni a frissítéseket (van internet a szerveren?)');
    }
  }
  const type = installType();
  return { current, ...cache, until: undefined, update_available: newer(cache.latest, current), install_type: type, command: updateCommand(type, port), can_update: updateSupported() };
}

// „Frissítés most” gomb: csak a systemd-s Linux telepítésen (a telepítő teszi ki az update/enabled jelzőt)
const UP_DIR = path.join(DATA_DIR, 'update');
export const updateSupported = () => fs.existsSync(path.join(UP_DIR, 'enabled'));

export function requestUpdate() {
  if (!updateSupported()) throw new HttpError(400, 'Ezen a telepítésen a frissítés a parancssorból indítható');
  if (updateStatus().running) throw new HttpError(409, 'A frissítés már folyamatban van');
  fs.rmSync(path.join(UP_DIR, 'result.json'), { force: true });
  fs.writeFileSync(path.join(UP_DIR, 'request.json'), JSON.stringify({ at: Date.now() }));
}

export function updateStatus() {
  const read = (f) => { try { return fs.readFileSync(path.join(UP_DIR, f), 'utf8'); } catch { return null; } };
  let result = null;
  try { result = JSON.parse(read('result.json')); } catch { /* még nincs */ }
  return { running: read('running') !== null || read('request.json') !== null, result, log: (read('log.txt') || '').split('\n').slice(-15).join('\n') };
}
