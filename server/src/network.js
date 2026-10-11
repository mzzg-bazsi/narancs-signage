// A szerver hálózati beállításai (csak Raspberry Pi-n, ahol a telepítő a signage-network segédet is feltette).
// A szerver nem rootként fut: a kérést a <adat>/network/request.json fájlba írja, egy systemd path egység
// root jogon futtatja a signage-network szkriptet, ami újra ellenőriz és a NetworkManagerrel alkalmazza.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db.js';
import { HttpError } from './http.js';

const NET_DIR = path.join(DATA_DIR, 'network');
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(NET_DIR, f), 'utf8')); } catch { return null; } };
const IP4 = String.raw`((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`;
export const isIp = (v) => new RegExp(`^${IP4}$`).test(String(v));
export const isCidr = (v) => new RegExp(`^${IP4}/([0-9]|[12]\\d|3[0-2])$`).test(String(v));

// a telepítő hozza létre az „enabled” jelzőt, ha Raspberry Pi-n NetworkManager van
export const networkSupported = () => fs.existsSync(path.join(NET_DIR, 'enabled'));

export function networkState() {
  return { supported: networkSupported(), status: read('status.json'), result: read('result.json') };
}

function writeRequest(req) {
  const file = path.join(NET_DIR, 'request.json');
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(req));
  fs.renameSync(`${file}.tmp`, file); // egyben jelenjen meg: a path egység a változásra indul
}

export function requestNetworkStatus() {
  if (networkSupported()) writeRequest({ action: 'status', id: String(Date.now()) });
}

export function requestNetworkChange(body) {
  if (!networkSupported()) throw new HttpError(400, 'A hálózat ezen a rendszeren nem állítható');
  const id = String(Date.now());
  if (body.mode === 'dhcp') { writeRequest({ mode: 'dhcp', id }); return { id }; }
  if (body.mode !== 'static') throw new HttpError(400, 'Érvénytelen mód');
  const dns = (Array.isArray(body.dns) ? body.dns : String(body.dns || '').split(/[\s,]+/)).map((d) => String(d).trim()).filter(Boolean);
  if (!isCidr(body.address)) throw new HttpError(400, 'Érvénytelen IP cím (formátum: 192.168.1.50/24)');
  if (!isIp(body.gateway)) throw new HttpError(400, 'Érvénytelen átjáró');
  if (!dns.length || dns.length > 3 || !dns.every(isIp)) throw new HttpError(400, 'Adj meg 1–3 érvényes DNS szervert');
  writeRequest({ mode: 'static', address: String(body.address), gateway: String(body.gateway), dns, id });
  return { id };
}
