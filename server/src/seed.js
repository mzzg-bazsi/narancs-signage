// Minta tartalmak: az első telepítéskor (és kérésre a Beállításokból) egy alap lejátszási lista
// néhány bemutató tartalommal, a kiválasztott nyelven.
import { getSetting, Slides, Playlists, Calendars, Events, Forms } from './db.js';
import { tr } from './i18n.js';

const THEME_GRADIENT = 'linear-gradient(135deg, var(--bg2), var(--bg))';
const pad = (n) => String(n).padStart(2, '0');
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function seedSamples() {
  const org = getSetting('org_name', '') || '';
  const now = new Date();
  const at = (days, h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, h, m).toISOString();
  const day = (days) => localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));

  // --- naptár mintaeseményekkel ---
  const cal = Calendars.create({ name: tr('Események'), color: 'var(--accent)' });
  for (const e of [
    { title: tr('Csapatmegbeszélés'), location: tr('Tárgyaló 2'), start: at(1, 10), end: at(1, 11) },
    { title: 'Workshop', location: tr('Aula'), start: at(3, 14), end: at(3, 16) },
    { title: tr('Nyílt nap'), location: tr('Recepció'), start: at(5, 9), end: at(5, 13) },
    { title: tr('Családi nap'), location: tr('Park'), start: day(10), end: day(10), all_day: 1 },
  ]) Events.create({ calendar_id: cal.id, description: '', all_day: 0, ...e });

  // --- elégedettségi űrlap (a menüből nyílik meg) ---
  const form = Forms.create({
    name: tr('Elégedettségi kérdőív'), title: tr('Mennyire volt elégedett?'), intro: tr('Véleménye segít nekünk fejlődni. Köszönjük!'),
    submit_text: tr('Küldés'), thanks_text: tr('Köszönjük a visszajelzést! 🧡'),
    fields: [
      { key: 'overall', type: 'smiley', label: tr('Összességében'), required: true },
      { key: 'liked', type: 'choice', label: tr('Mit értékelt leginkább?'), options: [tr('Kiszolgálás'), tr('Gyorsaság'), tr('Tisztaság'), tr('Ár')] },
      { key: 'comment', type: 'textarea', label: tr('Megjegyzés') },
    ],
  });

  // --- tartalmak ---
  const slide = (name, type, duration, data) => Slides.create({ name, type, duration, data });
  const welcome = slide(tr('Üdvözlő hirdetmény'), 'text', 12, {
    kicker: tr('Üdvözlünk!'), title: org || 'Narancs Signage',
    body: tr('Ez egy minta tartalom. Az admin felület Tartalmak menüjében szerkesztheted vagy törölheted, a Lejátszási listák menüben pedig összeállíthatod, mi fusson a képernyőkön.'),
    align: 'left', bg: THEME_GRADIENT, font_scale: 100, show_logo: true,
  });
  const clock = slide(tr('Óra és időjárás'), 'clock', 10, {
    style: 'digital', show_seconds: false, show_date: true, show_weather: true, show_forecast: true, title: tr('Szép napot!'),
    city: getSetting('default_city', 'Budapest'), lat: getSetting('default_lat', 47.4979), lon: getSetting('default_lon', 19.0402),
  });
  const cards = slide(tr('Szolgáltatásaink'), 'cards', 15, {
    title: tr('Szolgáltatásaink'), subtitle: tr('Minden egy helyen'), columns: 3, cards: [
      { icon: '☕', title: tr('Kávézó'), text: tr('Földszint, 7:00–18:00'), badge: tr('ÚJ') },
      { icon: '📚', title: tr('Könyvtár'), text: tr('2. emelet') },
      { icon: '🏋️', title: tr('Edzőterem'), text: tr('-1. szint') },
    ],
  });
  const calendar = slide(tr('Közelgő események'), 'calendar', 15, { title: tr('Közelgő események'), calendar_ids: [cal.id], view: 'list', days_ahead: 30, max_items: 7 });
  const formSlide = slide(tr('Elégedettségi kérdőív'), 'form', 45, { form_id: form.id });
  const menu = slide(tr('Interaktív menü'), 'menu', 20, {
    title: tr('Miben segíthetünk?'), subtitle: tr('Válassz egy témát'), columns: 3, buttons: [
      { icon: '📅', label: tr('Programok'), sub: tr('Közelgő események'), target_slide: calendar.id },
      { icon: '⭐', label: tr('Szolgáltatások'), sub: tr('Mit kínálunk?'), target_slide: cards.id },
      { icon: '✍️', label: tr('Visszajelzés'), sub: tr('Mondd el a véleményed'), target_slide: formSlide.id },
    ],
  });
  const countdown = slide(tr('Visszaszámlálás újévig'), 'countdown', 10, {
    title: tr('Újévig'), target: `${now.getFullYear() + 1}-01-01T00:00`, done_text: tr('Boldog új évet! 🎉'), bg: THEME_GRADIENT,
  });

  const playlist = Playlists.create({
    name: tr('Alap lejátszási lista'), transition: 'fade',
    items: [welcome, clock, cards, calendar, menu, countdown].map((s) => ({ slide_id: s.id, duration: null, enabled: true, valid_from: null, valid_to: null })),
  });
  return { playlist_id: playlist.id, slides: 7 };
}
