// A signage-network segéd (root) ellenőrzése ál-nmcli/ip parancsokkal: helyes parancsok, rossz bemenet elutasítása.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SCRIPT = path.resolve(import.meta.dirname, '../../install/signage-network.sh');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'nettest-'));
const bin = path.join(T, 'bin'), data = path.join(T, 'data'), log = path.join(T, 'nm.log');
fs.mkdirSync(bin); fs.mkdirSync(path.join(data, 'network'), { recursive: true });
const stub = (name, body) => fs.writeFileSync(path.join(bin, name), `#!/bin/bash\n${body}\n`, { mode: 0o755 });
stub('ip', 'echo "default via 192.168.1.1 dev wlan0 proto dhcp metric 600"');
stub('chown', 'exit 0');
stub('nmcli', `echo "$*" >> "${log}"
case "$*" in
  "-g GENERAL.CONNECTION device show wlan0") echo "wifi-home" ;;
  "-g ipv4.method connection show wifi-home") echo "auto" ;;
  "-g IP4.ADDRESS device show wlan0") echo "192.168.1.23/24" ;;
esac`);

function apply(req) {
  fs.writeFileSync(path.join(data, 'network', 'request.json'), JSON.stringify(req));
  fs.writeFileSync(log, '');
  execFileSync('bash', [SCRIPT, 'apply'], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SIGNAGE_DATA: data } });
  const calls = fs.readFileSync(log, 'utf8').split('\n').filter((l) => l && !l.startsWith('-g '));
  return { calls, result: JSON.parse(fs.readFileSync(path.join(data, 'network', 'result.json'), 'utf8')) };
}

test('statikus cím: a NetworkManager parancsai', () => {
  const { calls, result } = apply({ mode: 'static', address: '192.168.1.50/24', gateway: '192.168.1.1', dns: ['1.1.1.1', '8.8.8.8'], id: '1' });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['connection modify wifi-home ipv4.method manual ipv4.addresses 192.168.1.50/24 ipv4.gateway 192.168.1.1 ipv4.dns 1.1.1.1 8.8.8.8', 'connection up wifi-home']);
});

test('DHCP', () => {
  const { calls, result } = apply({ mode: 'dhcp', id: '2' });
  assert.equal(result.ok, true);
  assert.match(calls[0], /^connection modify wifi-home ipv4\.method auto/);
});

test('rossz vagy rosszindulatú bemenet: nincs nmcli módosítás', () => {
  for (const req of [
    { mode: 'static', address: '192.168.1.50/24; reboot', gateway: '192.168.1.1', dns: ['1.1.1.1'] },
    { mode: 'static', address: '192.168.1.50', gateway: '192.168.1.1', dns: ['1.1.1.1'] },
    { mode: 'static', address: '192.168.1.50/24', gateway: '', dns: ['1.1.1.1'] },
    { mode: 'static', address: '192.168.1.50/24', gateway: '192.168.1.1', dns: ['1.1.1.1', '$(id)'] },
    { mode: 'static', address: '256.1.1.1/24', gateway: '192.168.1.1', dns: ['1.1.1.1'] },
    { mode: 'other' },
  ]) {
    const { calls, result } = apply({ ...req, id: '3' });
    assert.equal(result.ok, false, JSON.stringify(req));
    assert.deepEqual(calls, []);
  }
});

test('a szerver oldali ellenőrzés', async () => {
  const { isIp, isCidr } = await import('../src/network.js');
  assert.ok(isCidr('10.0.0.5/8') && !isCidr('10.0.0.5') && !isCidr('10.0.0.5/33') && !isCidr('1.2.3.4/24 x'));
  assert.ok(isIp('192.168.1.1') && !isIp('192.168.1.256') && !isIp('1.2.3'));
});
