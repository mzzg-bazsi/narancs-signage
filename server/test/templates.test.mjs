// Sablonok: a beépítettek importálhatók, az export visszaimportálható, a hibás fájl elutasítódik
// (ideiglenes adatkönyvtárral fut, lásd package.json "test")
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplate, importTemplate, exportTemplate, templatePreview } from '../src/templates.js';
import { BUILTIN_TEMPLATES } from '../src/builtin-templates.js';
import { Slides, Playlists, Forms, Calendars, get } from '../src/db.js';

test('minden beépített sablon érvényes, importálható és előnézhető', () => {
  for (const b of BUILTIN_TEMPLATES) {
    validateTemplate(b.template);
    const r = importTemplate(b.template);
    assert.ok(r.playlist_id, b.id);
    const pl = Playlists.get(r.playlist_id);
    assert.equal(pl.items.length, b.template.playlist.items.length, b.id);
    for (const sid of r.slide_ids) {
      const s = Slides.get(sid);
      assert.ok(s, `${b.id}: tartalom`);
      assert.doesNotMatch(JSON.stringify(s.data), /"(en|hu)":|\{\{/, `${b.id}: feloldatlan szöveg vagy helyőrző`);
      // minden hivatkozás létező elemre mutat
      for (const t of [...(s.data.cards || []), ...(s.data.buttons || [])]) if (t.target_slide) assert.ok(Slides.get(t.target_slide), `${b.id}: cél`);
      for (const z of s.data.zones || []) for (const it of z.items) assert.ok(Slides.get(it.slide_id), `${b.id}: zóna`);
      if (s.data.form_id) assert.ok(Forms.get(s.data.form_id), `${b.id}: űrlap`);
      for (const c of s.data.calendar_ids || []) assert.ok(Calendars.get(c), `${b.id}: naptár`);
      if (s.type === 'clock') assert.ok(s.data.lat, `${b.id}: óra helye`);
    }
    const cfg = templatePreview(b.template, {});
    assert.ok(Object.keys(cfg.slides).length === b.template.slides.length, `${b.id}: előnézet`);
  }
});

test('export → import körút megtartja a tartalmat és a hivatkozásokat', () => {
  const r = importTemplate(BUILTIN_TEMPLATES.find((b) => b.id === 'office').template);
  const t = exportTemplate({ playlistId: r.playlist_id, meta: { name: 'Teszt export', category: 'office' } }, 'test');
  assert.equal(t.format, 'narancs-template');
  assert.ok(t.slides.every((s) => /^s\d+$/.test(s.ref)));
  assert.equal(t.calendars[0].events.length, 0, 'a saját események nem kerülnek exportba');
  const r2 = importTemplate(JSON.parse(JSON.stringify(t)));
  assert.equal(Playlists.get(r2.playlist_id).items.length, Playlists.get(r.playlist_id).items.length);
  const menu = r2.slide_ids.map((id) => Slides.get(id)).find((s) => s.type === 'menu');
  assert.ok(menu.data.buttons.every((b) => Slides.get(b.target_slide)), 'a menü gombjai az új tartalmakra mutatnak');
});

test('hibás sablon elutasítva, és nem marad utána semmi', () => {
  const before = get('SELECT COUNT(*) n FROM slides').n;
  const ok = BUILTIN_TEMPLATES[0].template;
  assert.throws(() => importTemplate({ format: 'valami' }), /nem Narancs Signage sablon/);
  assert.throws(() => importTemplate({ ...ok, version: 9 }), /verzió/);
  assert.throws(() => importTemplate({ ...ok, slides: [{ ref: 's1', type: 'exe', data: {} }] }), /Hibás sablon/);
  assert.throws(() => importTemplate({ ...ok, slides: [{ ref: 's1', type: 'menu', data: { buttons: [{ target_slide: 's9' }] } }], playlist: null }), /Hibás sablon/);
  assert.throws(() => importTemplate({ ...ok, media: [{ ref: 'm1', mime: 'text/html', data: 'PGI+' }] }), /Hibás sablon/);
  assert.equal(get('SELECT COUNT(*) n FROM slides').n, before);
});
