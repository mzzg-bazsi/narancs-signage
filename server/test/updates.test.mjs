import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newer, installType, updateCommand } from '../src/updates.js';

test('verzió összehasonlítás', () => {
  assert.equal(newer('1.10.0', '1.9.9'), true);
  assert.equal(newer('v1.21.0', '1.21.0'), false);
  assert.equal(newer('1.21.0', '1.21.1'), false);
  assert.equal(newer('2.0.0', '1.99.99'), true);
});

test('telepítés módja és parancs', () => {
  if (!process.env.DOCKER) {
    assert.equal(installType('/opt/narancs-signage'), 'linux');
    assert.equal(installType('/Users/x/Library/Application Support/Narancs Signage'), 'macos');
    assert.equal(installType('/home/x/narancs-signage'), 'manual');
  }
  assert.match(updateCommand('macos', 8080), /install\.sh \| bash$/);
  assert.match(updateCommand('macos', 8099), /\| bash -s -- --port 8099/);
  assert.equal(updateCommand('docker', 8080), 'docker compose pull && docker compose up -d');
});
