import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.SIGNAGE_DATA ||= fs.mkdtempSync(path.join(os.tmpdir(), 'ns-sys-'));
const { systemInfo } = await import('../src/system.js');

test('rendszer információk', () => {
  const s = systemInfo();
  assert.ok(['docker', 'raspberry-pi', 'vm', 'mac', 'bare-metal'].includes(s.platform));
  assert.ok(s.os && s.cores > 0 && s.mem.total > s.mem.free);
  assert.ok(s.disk.total > 0);
  assert.ok(['docker', 'linux', 'macos', 'manual'].includes(s.install));
});
