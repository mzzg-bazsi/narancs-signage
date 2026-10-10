// Az iCal ismétlődés kibontás ellenőrzése: node --test (a package.json "test" szkriptje ideiglenes adatkönyvtárral futtatja)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIcal } from '../src/feeds.js';

const cal = (body) => `BEGIN:VCALENDAR\nBEGIN:VEVENT\n${body}\nEND:VEVENT\nEND:VCALENDAR`;
const FROM = Date.parse('2026-01-01T00:00:00Z'), TO = Date.parse('2026-03-01T00:00:00Z');
const days = (evs) => evs.map((e) => e.start.slice(0, 10));

test('heti ismétlődés BYDAY-jel és COUNT-tal', () => {
  const ev = parseIcal(cal('UID:a\nSUMMARY:Meeting\nDTSTART:20260105T090000Z\nDTEND:20260105T100000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4'), FROM, TO);
  assert.equal(ev.length, 4);
  assert.deepEqual(days(ev), ['2026-01-05', '2026-01-07', '2026-01-12', '2026-01-14']);
  assert.equal(Date.parse(ev[0].end) - Date.parse(ev[0].start), 3600e3);
});

test('napi ismétlődés UNTIL-lal és EXDATE kihagyással', () => {
  const ev = parseIcal(cal('UID:b\nDTSTART;VALUE=DATE:20260110\nDTEND;VALUE=DATE:20260111\nRRULE:FREQ=DAILY;UNTIL=20260114\nEXDATE;VALUE=DATE:20260112'), FROM, TO);
  assert.deepEqual(days(ev), ['2026-01-10', '2026-01-11', '2026-01-13', '2026-01-14']);
  assert.equal(ev[0].all_day, 1);
});

test('havi: a hónap utolsó péntekje', () => {
  const ev = parseIcal(cal('UID:c\nDTSTART:20260130T120000Z\nRRULE:FREQ=MONTHLY;BYDAY=-1FR'), FROM, TO);
  assert.deepEqual(days(ev), ['2026-01-30', '2026-02-27']);
});

test('régi kezdetű sorozat is megjelenik az ablakban, RECURRENCE-ID felülír', () => {
  const text = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:d\nSUMMARY:Napi\nDTSTART;VALUE=DATE:20000101\nRRULE:FREQ=DAILY\nEND:VEVENT\n'
    + 'BEGIN:VEVENT\nUID:d\nSUMMARY:Áthelyezve\nRECURRENCE-ID;VALUE=DATE:20260115\nDTSTART;VALUE=DATE:20260116\nEND:VEVENT\nEND:VCALENDAR';
  const ev = parseIcal(text, Date.parse('2026-01-14T00:00:00'), Date.parse('2026-01-16T23:00:00'));
  assert.deepEqual(ev.map((e) => `${e.start}:${e.title}`).sort(), ['2026-01-14:Napi', '2026-01-16:Napi', '2026-01-16:Áthelyezve']);
});

test('ismétlődés nélküli esemény változatlan', () => {
  const ev = parseIcal(cal('SUMMARY:Egyszeri\nDTSTART:20260201T080000Z\nDTEND:20260201T090000Z'), FROM, TO);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].title, 'Egyszeri');
});

test('az első előfordulás megmarad ezredmásodperces kezdésnél is', async () => {
  const { expandRrule } = await import('../src/feeds.js');
  const start = new Date(Date.parse('2026-01-05T09:00:00.123Z'));
  const ev = expandRrule({ start: start.toISOString(), end: new Date(start.getTime() + 3600e3).toISOString(), all_day: 0, rrule: 'FREQ=WEEKLY;COUNT=2' }, FROM, TO);
  assert.deepEqual(days(ev), ['2026-01-05', '2026-01-12']);
});
