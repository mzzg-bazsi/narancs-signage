import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanTheme, cleanThemes } from '../src/themes.js';

const pal = { accent: '#f59e5b', accent_fg: '#fff', bg: 'rgb(10, 20, 30)', bg2: '#3b2312', fg: '#ffffff', surface: 'rgba(255,255,255,0.08)', muted: 'color-mix(in srgb, #ffffff 70%, transparent)' };

test('saját téma: érvényes', () => {
  const t = cleanTheme({ name: ' Kávé ', mode: 'light', font: 'lora', radius: 'soft', dark: pal, light: pal, extra: 1 });
  assert.equal(t.name, 'Kávé');
  assert.equal(t.mode, 'light');
  assert.equal(t.head_font, 'lora');
  assert.equal(t.extra, undefined);
  assert.deepEqual(Object.keys(cleanThemes({ my_abcd1234: t })), ['my_abcd1234']);
});

test('saját téma: CSS befecskendezés és hiányos adat elutasítva', () => {
  assert.throws(() => cleanTheme({ name: 'x', dark: { ...pal, bg: 'red; background:url(//x)' }, light: pal }));
  assert.throws(() => cleanTheme({ name: 'x', dark: pal }));
  assert.throws(() => cleanTheme({ name: '', dark: pal, light: pal }));
  assert.throws(() => cleanThemes({ narancs: { name: 'x', dark: pal, light: pal } }));
  // ismeretlen betűtípus-név nem lehet CSS
  assert.equal(cleanTheme({ name: 'x', font: '"); x', dark: pal, light: pal }).font, 'system');
});
