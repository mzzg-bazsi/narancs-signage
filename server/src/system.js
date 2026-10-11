// Rendszer információk a Beállítások → Rendszer kártyához: min fut a szerver (Docker, Raspberry Pi, VM, saját gép), erőforrások
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DATA_DIR } from './db.js';
import { installType } from './updates.js';

const read = (f) => { try { return fs.readFileSync(f, 'utf8').replace(/\0/g, '').trim(); } catch { return ''; } };
const run = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

// a környezet ritkán változik, elég egyszer megállapítani
let host = null;
function hostInfo() {
  if (host) return host;
  const linux = process.platform === 'linux';
  const model = linux ? read('/proc/device-tree/model') : '';
  const osName = linux ? (read('/etc/os-release').match(/^PRETTY_NAME="?([^"\n]*)/m)?.[1] || 'Linux')
    : process.platform === 'darwin' ? `macOS ${run('sw_vers', ['-productVersion'])}`.trim() : process.platform === 'win32' ? `${os.version()} (${os.release()})` : `${os.type()} ${os.release()}`;
  let platform = 'bare-metal', virt = '';
  if (fs.existsSync('/.dockerenv') || /docker|containerd|kubepods/.test(read('/proc/1/cgroup'))) platform = 'docker';
  else if (/raspberry pi/i.test(model)) platform = 'raspberry-pi';
  else if (linux) {
    virt = run('systemd-detect-virt', []);
    if (virt && virt !== 'none') platform = 'vm';
    else if (/hypervisor/.test(read('/proc/cpuinfo'))) { platform = 'vm'; virt = ''; }
  } else if (process.platform === 'darwin') platform = 'mac';
  else if (process.platform === 'win32') platform = 'windows';
  host = { platform, virt: virt === 'none' ? '' : virt, model, os: osName, hostname: os.hostname(), arch: os.arch(), cpu: os.cpus()[0]?.model?.trim() || '', cores: os.cpus().length };
  return host;
}

export function systemInfo() {
  const h = hostInfo();
  let disk = null;
  try { const s = fs.statfsSync(DATA_DIR); disk = { total: s.blocks * s.bsize, free: s.bavail * s.bsize }; } catch { /* */ }
  let dbSize = 0;
  for (const f of ['signage.db', 'signage.db-wal']) { try { dbSize += fs.statSync(path.join(DATA_DIR, f)).size; } catch { /* */ } }
  const temp = +read('/sys/class/thermal/thermal_zone0/temp');
  return {
    ...h,
    install: installType(),
    node: process.version,
    mem: { total: os.totalmem(), free: os.freemem() },
    load: os.loadavg()[0],
    sys_uptime: os.uptime(),
    uptime: process.uptime(),
    disk, db_size: dbSize,
    temp: temp ? Math.round(temp / 100) / 10 : null,
  };
}
