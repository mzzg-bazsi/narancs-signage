/* Narancs Signage – admin felület (keretrendszer nélküli SPA) */
(() => {
  'use strict';

  // A natív append/replaceChildren a null-t "null" szövegként szúrná be – kiszűrjük
  for (const m of ['append', 'replaceChildren']) {
    const orig = Element.prototype[m];
    if (orig.__safe) continue;
    Element.prototype[m] = function (...a) { return orig.apply(this, a.flat(Infinity).filter((x) => x != null && x !== false)); };
    Element.prototype[m].__safe = true;
  }

  // =====================================================================
  //  Segédfüggvények
  // =====================================================================
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  // Nyelv: a szerver /api/lang.js szkriptje adja (window.SIGNAGE_LANG), még a modul szintű
  // állandók (TYPES, NAV…) kiértékelése előtt. Nyelvváltás után az oldal újratöltődik.
  const I18N = window.SIGNAGE_I18N;
  I18N.set(window.SIGNAGE_LANG);
  const tr = I18N.t;
  const LOCALE = I18N.locale();
  document.documentElement.lang = I18N.lang;
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  const ICONS = {
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    screen: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    playlist: '<path d="M3 6h13M3 12h13M3 18h8"/><path d="M17 15v6l4-3z" fill="currentColor"/>',
    slides: '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="M21 7v12a2 2 0 0 1-2 2H7"/>',
    media: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    form: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    next: '<path d="m9 18 6-6-6-6"/>',
    prev: '<path d="m15 18-6-6 6-6"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    menu: '<path d="M3 12h18M3 6h18M3 18h18"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
    touch: '<path d="M9 11V5a2 2 0 1 1 4 0v6M13 10a2 2 0 1 1 4 0v2M17 11a2 2 0 1 1 4 0v4a7 7 0 0 1-7 7h-2a7 7 0 0 1-5.6-2.8L3 15.5a2 2 0 0 1 3-2.6L9 15"/>',
    power: '<path d="M18.4 6.6a9 9 0 1 1-12.8 0M12 2v10"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20c1 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.8-1.7 1.7-1.7h2A5.5 5.5 0 0 0 22 11c0-5-4.5-9-10-9z"/>',
  };
  const icon = (n, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'i ' + cls); s.innerHTML = ICONS[n] || ''; return s; };
  const btn = (label, onclick, { cls = '', ic, title, disabled } = {}) => h('button', { class: `btn ${cls}`, onclick, title, disabled, type: 'button' }, ic ? icon(ic) : null, label);
  const fmtBytes = (n) => { if (!n) return '0 B'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.min(4, Math.floor(Math.log(n) / Math.log(1024))); return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`; };
  const fmtDate = (t) => new Date(t).toLocaleString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtDur = (s) => { s = Math.round(s); if (s < 60) return tr('{n} mp', { n: s }); const m = Math.floor(s / 60); return s % 60 ? tr('{m} p {s} mp', { m, s: s % 60 }) : tr('{n} perc', { n: m }); };
  const ago = (t) => {
    if (!t) return tr('soha');
    const s = (Date.now() - t) / 1000;
    if (s < 60) return tr('épp most');
    if (s < 3600) return tr('{n} perce', { n: Math.floor(s / 60) });
    if (s < 86400) return tr('{n} órája', { n: Math.floor(s / 3600) });
    return tr('{n} napja', { n: Math.floor(s / 86400) });
  };
  const pad = (n) => String(n).padStart(2, '0');
  const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // =====================================================================
  //  API, értesítések, modális ablakok
  // =====================================================================
  async function api(method, path, body, extra = {}) {
    const opts = { method, headers: { 'X-Signage': '1' } };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const r = await fetch(path, { ...opts, ...extra });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !path.startsWith('/api/auth')) { boot(); throw new Error(tr('Lejárt a munkamenet')); }
    if (!r.ok) throw new Error(j.error || tr('Hiba ({n})', { n: r.status }));
    return j;
  }
  const GET = (p) => api('GET', p), POST = (p, b) => api('POST', p, b ?? {}), PUT = (p, b) => api('PUT', p, b), DEL = (p) => api('DELETE', p);

  function toast(msg, type = 'ok') {
    const t = h('div', { class: `toast ${type}` }, msg);
    $('#toasts').append(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, type === 'err' ? 5000 : 2600);
  }
  const fail = (e) => toast(e.message || String(e), 'err');

  function modal({ title, body, foot, size = '', onClose }) {
    const back = h('div', { class: 'modal-back' });
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    const m = h('div', { class: `modal ${size}` },
      h('div', { class: 'modal-head' }, h('h3', {}, title), btn('', close, { cls: 'ghost icon', ic: 'x', title: tr('Bezárás') })),
      h('div', { class: 'modal-body' }, body),
      foot ? h('div', { class: 'modal-foot' }, foot) : null);
    back.append(m);
    document.body.append(back);
    setTimeout(() => m.querySelector('input:not([type=checkbox]), textarea')?.focus(), 50);
    return { close, el: m };
  }
  function confirmBox(text, { ok = tr('Igen'), danger = true, title = tr('Megerősítés') } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const m = modal({
        title, body: h('p', { style: { margin: 0 } }, text),
        foot: [btn(tr('Mégse'), () => m.close()), btn(ok, () => { done = true; m.close(); }, { cls: danger ? 'primary' : 'primary' })],
        onClose: () => resolve(done),
      });
    });
  }

  // =====================================================================
  //  Gyorsítótárazott adatok
  // =====================================================================
  const cache = {};
  async function load(kind, force = false) {
    if (!cache[kind] || force) cache[kind] = await GET(`/api/${kind}`);
    return cache[kind];
  }
  const invalidate = (...kinds) => kinds.forEach((k) => delete cache[k]);
  const mediaById = (id) => (cache.media || []).find((m) => m.id === +id);

  // =====================================================================
  //  Tartalomtípusok
  // =====================================================================
  const TYPES = {
    image: { e: '🖼️', name: tr('Képváltó'), desc: tr('Több kép vagy videó automatikus váltakozása'), duration: 0, defaults: { media_ids: [], interval: 6, effect: 'fade', fit: 'cover', show_dots: true } },
    video: { e: '🎬', name: tr('Videó'), desc: tr('Videó lejátszása a végéig vagy adott ideig'), duration: 0, defaults: { media_id: null, muted: true, fit: 'contain' } },
    text: { e: '📝', name: tr('Hirdetmény'), desc: tr('Cím, szöveg, háttérkép – közlemények, ajánlatok'), duration: 12, defaults: { kicker: tr('Közlemény'), title: tr('Üdvözlünk!'), body: tr('Írd ide a szöveget…'), align: 'left', bg: 'linear-gradient(135deg, var(--bg2), var(--bg))', font_scale: 100 } },
    cards: { e: '🃏', name: tr('Kártyák'), desc: tr('Csempe elrendezés ikonokkal, képekkel, hivatkozással'), duration: 15, defaults: { title: tr('Szolgáltatásaink'), subtitle: '', columns: 3, cards: [{ icon: '☕', title: tr('Kávézó'), text: tr('Földszint, 7:00–18:00') }, { icon: '📚', title: tr('Könyvtár'), text: tr('2. emelet') }, { icon: '🏋️', title: tr('Edzőterem'), text: tr('-1. szint') }] } },
    menu: { e: '👆', name: tr('Interaktív menü'), desc: tr('Érintőgombok, amik más tartalmakra navigálnak'), duration: 30, defaults: { title: tr('Miben segíthetünk?'), subtitle: tr('Válassz egy témát'), columns: 3, buttons: [{ icon: '🗺️', label: tr('Térkép') }, { icon: '📅', label: tr('Programok') }, { icon: '✍️', label: tr('Visszajelzés') }] } },
    form: { e: '📋', name: tr('Űrlap'), desc: tr('Érintőképernyős űrlap virtuális billentyűzettel'), duration: 45, defaults: { form_id: null } },
    calendar: { e: '📅', name: tr('Naptár'), desc: tr('Események lista, heti vagy havi nézetben'), duration: 15, defaults: { title: tr('Közelgő események'), calendar_ids: [], view: 'list', days_ahead: 14, max_items: 7 } },
    clock: { e: '🕒', name: tr('Óra és időjárás'), desc: tr('Digitális vagy analóg óra, 5 napos előrejelzés'), duration: 10, defaults: { style: 'digital', show_seconds: false, show_date: true, show_weather: true, show_forecast: true } },
    rss: { e: '📰', name: tr('Hírfolyam (RSS)'), desc: tr('Friss hírek bármely RSS/Atom forrásból'), duration: 0, defaults: { url: 'https://telex.hu/rss', title: '', max: 5, per_item: 8, show_images: true } },
    countdown: { e: '⏳', name: tr('Visszaszámláló'), desc: tr('Visszaszámlálás egy eseményig'), duration: 10, defaults: { title: tr('Az évzáró buliig'), target: '', done_text: tr('Elkezdődött! 🎉'), bg: 'linear-gradient(135deg, var(--bg2), var(--bg))' } },
    qr: { e: '🔳', name: tr('QR kód'), desc: tr('Beolvasható link (pl. Wi-Fi, menü, weboldal)'), duration: 12, defaults: { url: 'https://', title: tr('Olvasd be a telefonoddal!'), text: '' } },
    web: { e: '🌐', name: tr('Weboldal'), desc: tr('Külső weboldal vagy dashboard beágyazása'), duration: 30, defaults: { url: 'https://', zoom: 100, interactive: false, reload_sec: 0 } },
    pdf: { e: '📄', name: 'PDF', desc: tr('PDF dokumentum megjelenítése'), duration: 20, defaults: { media_id: null, page: 1 } },
    zones: { e: '🔲', name: tr('Osztott képernyő'), desc: tr('Több tartalom egyszerre, zónákra osztva'), duration: 30, defaults: { layout: 'right', size: 30, gap: false, zones: [] } },
    html: { e: '🧩', name: tr('Egyedi HTML'), desc: tr('Saját HTML/CSS/JS kód'), duration: 15, defaults: { html: '<!doctype html>\n<html><body style="margin:0;display:grid;place-items:center;height:100vh;background:#f59e5b;font:700 8vmin sans-serif;color:#3b1a05">\n  ' + tr('Helló, signage!') + ' 👋\n</body></html>' } },
  };
  const TRANSITIONS = [['fade', tr('Áttűnés')], ['slide', tr('Becsúszás')], ['zoom', tr('Nagyítás')], ['up', tr('Felúszás')], ['none', tr('Nincs')]];
  const DAYS = [1, 2, 3, 4, 5, 6, 0].map(I18N.dayShort); // hétfőtől vasárnapig

  const PALETTE = [['#f59e5b', tr('Narancs')], ['#ef4444', tr('Piros')], ['#f97316', tr('Sötétnarancs')], ['#eab308', tr('Sárga')], ['#84cc16', tr('Lime')], ['#22c55e', tr('Zöld')],
    ['#14b8a6', tr('Türkiz')], ['#06b6d4', tr('Cián')], ['#3b82f6', tr('Kék')], ['#6366f1', tr('Indigó')], ['#a855f7', tr('Lila')], ['#ec4899', tr('Rózsaszín')],
    ['#f43f5e', tr('Málna')], ['#92400e', tr('Barna')], ['#64748b', tr('Palaszürke')], ['#111827', tr('Fekete')], ['#ffffff', tr('Fehér')]];
  const THEME_COLORS = [['var(--accent)', tr('Kiemelő')], ['var(--accent-fg)', tr('Kiemelőn szöveg')], ['var(--fg)', tr('Szöveg')], ['var(--bg)', tr('Háttér')], ['var(--bg2)', tr('Háttér 2')], ['var(--surface)', tr('Kártya')]];

  // Tartalom átszínezése az arculat szerint (ugyanaz a logika, mint a szerveren)
  function brandifyData(type, data) {
    const d = clone(data);
    delete d.color;
    if (['text', 'countdown'].includes(type)) d.bg = 'linear-gradient(135deg, var(--bg2), var(--bg))'; else delete d.bg;
    for (const k of ['cards', 'buttons']) if (Array.isArray(d[k])) d[k] = d[k].map(({ color, text_color, ...rest }) => rest);
    return d;
  }

  function slideThumb(s, el) {
    const d = s.data || {};
    const mid = d.media_ids?.[0] || d.bg_media_id || (s.type === 'video' ? null : d.media_id) || d.cards?.find((c) => c.media_id)?.media_id;
    const m = mid && mediaById(mid);
    if (m && m.mime.startsWith('image/')) { el.style.backgroundImage = `url("${m.url}")`; el.textContent = ''; return el; }
    const bg = themeCss(d.bg || (['image', 'video', 'web', 'pdf', 'html'].includes(s.type) ? '' : 'var(--bg)'));
    if (bg && !bg.includes('url')) { el.style.background = bg; el.style.color = themeCss('var(--fg)'); }
    el.textContent = TYPES[s.type]?.e || '❓';
    return el;
  }
  const slideDuration = (s) => {
    if (s.duration) return s.duration;
    if (s.type === 'image') return (s.data.media_ids?.length || 1) * (s.data.interval || 6);
    if (s.type === 'rss') return (s.data.max || 5) * (s.data.per_item || 8);
    if (s.type === 'video') return null;
    return 10;
  };

  // =====================================================================
  //  Űrlap mező segédek (kétirányú kötés egy objektumhoz)
  // =====================================================================
  const F = {
    wrap(label, input, { hint, full } = {}) {
      return h('div', { class: `field ${full ? 'full' : ''}` }, label ? h('label', {}, label) : null, input, hint ? h('div', { class: 'hint' }, hint) : null);
    },
    text(label, obj, key, o = {}) {
      const inp = h('input', { class: 'input', type: o.type || 'text', value: obj[key] ?? '', placeholder: o.placeholder || '' });
      inp.addEventListener('input', () => { obj[key] = inp.value; o.onchange?.(inp.value); });
      return F.wrap(label, inp, o);
    },
    number(label, obj, key, o = {}) {
      const inp = h('input', { class: 'input', type: 'number', value: obj[key] ?? '', min: o.min, max: o.max, step: o.step || 1, placeholder: o.placeholder || '' });
      inp.addEventListener('input', () => { obj[key] = inp.value === '' ? null : +inp.value; o.onchange?.(obj[key]); });
      return F.wrap(label, inp, o);
    },
    textarea(label, obj, key, o = {}) {
      const inp = h('textarea', { class: `input ${o.code ? 'code' : ''}`, placeholder: o.placeholder || '', rows: o.rows || 4 });
      inp.value = obj[key] ?? '';
      inp.addEventListener('input', () => { obj[key] = inp.value; o.onchange?.(inp.value); });
      return F.wrap(label, inp, { full: true, ...o });
    },
    select(label, obj, key, options, o = {}) {
      const sel = h('select', { class: 'input' }, options.map(([v, l]) => h('option', { value: v ?? '' }, l)));
      sel.value = obj[key] ?? '';
      sel.addEventListener('change', () => { const v = sel.value; obj[key] = o.number ? (v === '' ? null : +v) : v; o.onchange?.(obj[key]); });
      return F.wrap(label, sel, o);
    },
    toggle(label, obj, key, o = {}) {
      const inp = h('input', { type: 'checkbox', checked: o.invert ? obj[key] === false : (o.defaultOn ? obj[key] !== false : !!obj[key]) });
      inp.addEventListener('change', () => { obj[key] = o.invert ? !inp.checked : inp.checked; o.onchange?.(obj[key]); });
      return h('label', { class: `check ${o.full ? 'full' : ''}`, style: { gridColumn: o.full ? '1 / -1' : null } }, h('span', { class: 'switch' }, inp, h('span')), h('span', {}, label, o.hint ? h('div', { class: 'hint small muted' }, o.hint) : null));
    },
    color(label, obj, key, o = {}) {
      // Értékek: üres = alapértelmezett (téma szerint), var(--…) = arculati szín, #rrggbb = egyedi szín
      const toHex = (v) => { const x = themeCss(v || ''); return /^#[0-9a-f]{6}$/i.test(x) ? x : (o.def || '#f59e5b'); };
      const inp = h('input', { class: 'input', type: 'color', value: toHex(obj[key]), title: tr('Egyedi szín') });
      const box = h('div', { class: 'color-field' });
      const draw = () => {
        const v = obj[key] || '';
        const chips = o.theme === false ? [] : THEME_COLORS.map(([cv, cl]) => h('button', {
          type: 'button', class: `tchip ${v === cv ? 'on' : ''}`, title: tr('Arculat: {name}', { name: cl }),
          onclick: () => { obj[key] = cv; inp.value = toHex(cv); draw(); o.onchange?.(cv); },
        }, h('span', { class: 'color-dot', style: { background: themeCss(cv) } }), cl));
        const state = !v ? tr('Alap (téma)') : v.startsWith('var(') ? tr('Arculat színe') : tr('Egyedi szín');
        box.replaceChildren(
          h('div', { class: 'row', style: { flexWrap: 'nowrap', gap: '8px' } }, inp, h('span', { class: `badge ${v && !v.startsWith('var(') ? 'orange' : ''}` }, state),
            o.clearable !== false && v ? btn(tr('Alap'), () => { delete obj[key]; inp.value = toHex(''); draw(); o.onchange?.(); }, { cls: 'sm ghost' }) : null),
          chips.length ? h('div', { class: 'row', style: { gap: '4px' } }, h('span', { class: 'small muted', style: { width: '52px' } }, tr('Téma:')), chips) : null,
          o.palette === false ? null : h('div', { class: 'row', style: { gap: '4px' } }, h('span', { class: 'small muted', style: { width: '52px' } }, tr('Színek:')),
            PALETTE.map(([pv, pl]) => h('button', {
              type: 'button', class: `pswatch ${v.toLowerCase() === pv ? 'on' : ''}`, title: `${pl} (${pv})`, style: { background: pv },
              onclick: () => { obj[key] = pv; inp.value = pv; draw(); o.onchange?.(pv); },
            }))));
      };
      inp.addEventListener('input', () => { obj[key] = inp.value; draw(); o.onchange?.(inp.value); });
      draw();
      return F.wrap(label, box, o);
    },
    seg(label, obj, key, options, o = {}) {
      const box = h('div', { class: 'seg' });
      const draw = () => box.replaceChildren(...options.map(([v, l]) => h('button', { type: 'button', class: (obj[key] ?? o.def) === v ? 'on' : '', onclick: () => { obj[key] = v; draw(); o.onchange?.(v); } }, l)));
      draw();
      return F.wrap(label, box, o);
    },
    days(label, obj, key, o = {}) {
      const box = h('div', { class: 'daypick' });
      const draw = () => box.replaceChildren(...DAYS.map((d, i) => {
        const n = i + 1, on = (obj[key] || []).includes(n);
        return h('button', { type: 'button', class: on ? 'on' : '', onclick: () => {
          const s = new Set(obj[key] || []); on ? s.delete(n) : s.add(n); obj[key] = [...s].sort(); draw(); o.onchange?.();
        } }, d);
      }));
      draw();
      return F.wrap(label, box, { hint: o.hint ?? tr('Ha egy nap sincs kijelölve, minden nap érvényes.'), ...o });
    },
    bg(label, obj, key, o = {}) {
      const themeOpts = [['', tr('Téma szerint')], ['var(--bg)', tr('Téma háttér')], ['linear-gradient(135deg, var(--bg2), var(--bg))', tr('Téma átmenet')], ['var(--accent)', tr('Kiemelő szín')]];
      const chips = h('div', { class: 'row', style: { gap: '6px' } }, themeOpts.map(([v, l]) => h('button', { type: 'button', class: 'btn sm', title: v || tr('Az arculat alapértelmezett háttere'), onclick: () => { if (v) obj[key] = v; else delete obj[key]; inp.value = v; o.onchange?.(); } },
        h('span', { class: 'color-dot', style: { background: themeCss(v || 'var(--bg)'), border: '1px solid var(--border-strong)' } }), l)));
      const presets = ['#1b130e', '#0f172a', '#ffffff', 'linear-gradient(135deg, #3b2312, #a8521d)', 'linear-gradient(135deg, #f59e5b, #e0565b)', 'linear-gradient(135deg, #0f2027, #2c5364)', 'linear-gradient(135deg, #134e5e, #71b280)', 'linear-gradient(160deg, #24170e, #101010)'];
      const inp = h('input', { class: 'input', value: obj[key] || '', placeholder: tr('pl. #222 vagy linear-gradient(...)') });
      const sw = h('div', { class: 'row', style: { gap: '6px' } }, presets.map((p) => h('button', { type: 'button', title: p, style: { width: '30px', height: '30px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: p, cursor: 'pointer' }, onclick: () => { obj[key] = p; inp.value = p; o.onchange?.(); } })));
      inp.addEventListener('input', () => { obj[key] = inp.value; o.onchange?.(); });
      return F.wrap(label, h('div', { class: 'stack', style: { gap: '8px' } }, chips, sw, inp), { hint: tr('Üresen hagyva az Arculat menüben beállított téma hátterét használja.'), ...o });
    },
    media(label, obj, key, o = {}) {
      const box = h('div', { class: 'stack', style: { gap: '8px' } });
      const draw = () => {
        const ids = o.multiple ? (obj[key] || []) : (obj[key] ? [obj[key]] : []);
        const thumbs = h('div', { class: 'thumbs' }, ids.map((id, idx) => {
          const m = mediaById(id);
          const t = h('div', { class: 't', title: m?.name, style: m && m.mime.startsWith('image/') ? { backgroundImage: `url("${m.url}")` } : {} },
            !m ? '❓' : m.mime.startsWith('video/') ? '🎬' : m.mime === 'application/pdf' ? '📄' : null,
            o.captions && obj.captions?.[id] ? h('span', { class: 'cap' }, obj.captions[id]) : null,
            h('button', { type: 'button', title: tr('Eltávolítás'), onclick: () => {
              if (o.multiple) obj[key] = ids.filter((_, i) => i !== idx); else obj[key] = null;
              draw(); o.onchange?.();
            } }, '×'));
          if (o.captions) t.addEventListener('dblclick', () => {
            const v = prompt(tr('Felirat ehhez a képhez:'), obj.captions?.[id] || '');
            if (v == null) return;
            obj.captions = { ...(obj.captions || {}), [id]: v };
            if (!v) delete obj.captions[id];
            draw(); o.onchange?.();
          });
          return t;
        }));
        if (o.multiple && ids.length > 1) {
          // húzással átrendezhető sorrend
          [...thumbs.children].forEach((t, i) => {
            t.draggable = true;
            t.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', i));
            t.addEventListener('dragover', (e) => e.preventDefault());
            t.addEventListener('drop', (e) => {
              e.preventDefault();
              const from = +e.dataTransfer.getData('text/plain');
              const arr = [...ids]; const [x] = arr.splice(from, 1); arr.splice(i, 0, x);
              obj[key] = arr; draw(); o.onchange?.();
            });
          });
        }
        box.replaceChildren(ids.length ? thumbs : h('div', { class: 'muted small' }, tr('Nincs kiválasztva fájl')),
          h('div', { class: 'row' }, btn(o.multiple ? tr('Képek kiválasztása') : tr('Fájl kiválasztása'), async () => {
            const picked = await pickMedia({ multiple: o.multiple, accept: o.accept, selected: ids });
            if (!picked) return;
            obj[key] = o.multiple ? picked : picked[0] ?? null;
            draw(); o.onchange?.();
          }, { ic: 'media', cls: 'sm' }), o.multiple && ids.length > 1 ? h('span', { class: 'small muted' }, tr('Húzással rendezhető') + (o.captions ? tr(' · dupla katt = felirat') : '')) : null));
      };
      draw();
      return F.wrap(label, box, { full: true, ...o });
    },
    slideRef(label, obj, key, slides, o = {}) {
      return F.select(label, obj, key, [['', tr('— nincs (nem kattintható) —')], ...slides.filter((s) => s.id !== o.exclude).map((s) => [s.id, `${TYPES[s.type]?.e || ''} ${s.name}`])], { number: true, ...o });
    },
  };

  // =====================================================================
  //  Médiaválasztó / feltöltés
  // =====================================================================
  function uploadFiles(files, onProgress) {
    return Promise.all([...files].map((file) => new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media');
      xhr.setRequestHeader('X-Signage', '1');
      xhr.setRequestHeader('X-Filename', encodeURIComponent(file.name));
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => onProgress?.(file, e.loaded / e.total);
      xhr.onload = () => {
        const j = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) resolve(j); else reject(new Error(`${file.name}: ${j.error || xhr.status}`));
      };
      xhr.onerror = () => reject(new Error(tr('{name}: hálózati hiba', { name: file.name })));
      xhr.send(file);
    })));
  }

  function dropzone(onDone, accept = 'image/*,video/*,application/pdf') {
    const input = h('input', { type: 'file', multiple: true, accept, hidden: true });
    const bar = h('div', { class: 'progress hidden' }, h('div'));
    const label = h('div', {}, h('div', { style: { fontSize: '28px' } }, '⬆️'), h('b', {}, tr('Húzd ide a fájlokat')), tr(' vagy kattints a tallózáshoz'), h('div', { class: 'small' }, tr('Képek (JPG, PNG, WebP, GIF), videók (MP4, WebM), PDF')));
    const dz = h('div', { class: 'dropzone', onclick: () => input.click() }, label, bar, input);
    const go = async (files) => {
      if (!files.length) return;
      const prog = new Map();
      bar.classList.remove('hidden');
      try {
        const res = await uploadFiles(files, (f, p) => {
          prog.set(f, p);
          bar.firstChild.style.width = `${([...prog.values()].reduce((a, b) => a + b, 0) / files.length) * 100}%`;
        });
        invalidate('media');
        await load('media');
        toast(tr('{n} fájl feltöltve', { n: res.length }));
        onDone?.(res);
      } catch (e) { fail(e); } finally { bar.classList.add('hidden'); bar.firstChild.style.width = 0; input.value = ''; }
    };
    input.addEventListener('change', () => go([...input.files]));
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); go([...e.dataTransfer.files]); });
    return dz;
  }

  function mediaTile(m, { selIndex, onclick } = {}) {
    const isImg = m.mime.startsWith('image/'), isVid = m.mime.startsWith('video/');
    return h('div', { class: `media-tile ${selIndex ? 'sel' : ''}`, onclick, title: m.name },
      h('div', { class: 'pv', style: isImg ? { backgroundImage: `url("${m.url}")` } : {} },
        isVid ? h('video', { src: m.url + '#t=1', muted: true, preload: 'metadata' }) : !isImg ? (m.mime === 'application/pdf' ? '📄' : '🎵') : null,
        h('span', { class: 'kind' }, isImg ? tr('KÉP') : isVid ? tr('VIDEÓ') : m.mime === 'application/pdf' ? 'PDF' : tr('HANG')),
        selIndex ? h('span', { class: 'selnum' }, selIndex) : null),
      h('div', { class: 'nm' }, m.name, h('small', {}, fmtBytes(m.size))));
  }

  async function pickMedia({ multiple, accept, selected = [] } = {}) {
    await load('media');
    const acc = accept || (multiple ? 'image/,video/' : 'image/');
    const ok = (m) => acc.split(',').some((a) => m.mime.startsWith(a.trim()));
    let sel = [...selected];
    return new Promise((resolve) => {
      let result = null;
      const grid = h('div', { class: 'media-grid' });
      const search = h('input', { class: 'input', placeholder: tr('Keresés…'), style: { maxWidth: '260px' } });
      const draw = () => {
        const q = search.value.toLowerCase();
        const list = cache.media.filter(ok).filter((m) => !q || m.name.toLowerCase().includes(q));
        grid.replaceChildren(...(list.length ? list.map((m) => mediaTile(m, {
          selIndex: sel.includes(m.id) ? (multiple ? sel.indexOf(m.id) + 1 : '✓') : null,
          onclick: () => {
            if (multiple) sel = sel.includes(m.id) ? sel.filter((x) => x !== m.id) : [...sel, m.id];
            else { result = [m.id]; md.close(); return; }
            draw(); count.textContent = tr('{n} kiválasztva', { n: sel.length });
          },
        })) : [h('div', { class: 'empty', style: { gridColumn: '1/-1' } }, tr('Nincs megfelelő fájl. Tölts fel újat!'))]));
      };
      search.addEventListener('input', draw);
      const count = h('span', { class: 'muted small' }, tr('{n} kiválasztva', { n: sel.length }));
      const md = modal({
        title: multiple ? tr('Fájlok kiválasztása') : tr('Fájl kiválasztása'), size: 'wide',
        body: h('div', { class: 'stack' }, dropzone((up) => { const ids = up.filter(ok).map((m) => m.id); if (multiple) sel.push(...ids); else if (ids[0]) { result = [ids[0]]; md.close(); return; } draw(); count.textContent = tr('{n} kiválasztva', { n: sel.length }); }, acc.split(',').map((a) => a.trim() + (a.trim().endsWith('/') ? '*' : '')).join(',')), search, grid),
        foot: multiple ? [count, h('span', { class: 'grow' }), btn(tr('Mégse'), () => md.close()), btn(tr('Kiválasztás'), () => { result = sel; md.close(); }, { cls: 'primary' })] : null,
        onClose: () => resolve(result),
      });
      draw();
    });
  }

  // =====================================================================
  //  Előnézet keret (1920×1080-as lejátszó kicsinyítve)
  // =====================================================================
  function previewFrame(src, { portrait = false } = {}) {
    const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;
    const frame = h('iframe', { src, width: W, height: H, style: { width: W + 'px', height: H + 'px' } });
    const box = h('div', { class: `preview-frame ${portrait ? 'portrait' : ''}` }, frame);
    const ro = new ResizeObserver(() => { frame.style.transform = `scale(${box.clientWidth / W})`; });
    ro.observe(box);
    return { el: box, reload: (s) => { frame.src = s || frame.src; }, frame };
  }

  // =====================================================================
  //  Belépés / első indítás
  // =====================================================================
  // Szerzői jogi megjegyzés – a licenc (LICENSE, 3. pont) szerint nem távolítható el. A lejátszón nincs.
  const COPYRIGHT = '© 2026 Balázs Mazzag';
  // a programot teljes egészében Claude (Anthropic) írta – a szerzői jogi felirat alatt jelezzük
  const builtWith = () => h('a', { class: 'built-with', href: 'https://claude.com/claude-code', target: '_blank', rel: 'noopener' }, tr('Teljes egészében a Claude programozta'));

  let ME = null;
  const ROLE_NAMES = { admin: tr('Adminisztrátor'), editor: tr('Szerkesztő'), viewer: tr('Megtekintő') };
  const isAdmin = () => (ME?.role || 'admin') === 'admin';
  function authScreen(setup) {
    const data = { username: setup ? 'admin' : '', password: '', password2: '', org_name: '', language: I18N.lang };
    const err = h('div', { class: 'err' });
    const submit = async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        if (setup) {
          if (data.password !== data.password2) throw new Error(tr('A két jelszó nem egyezik'));
          await POST('/api/auth/setup', data);
        } else await POST('/api/auth/login', data);
        boot();
      } catch (ex) { err.textContent = ex.message; }
    };
    $('#app').replaceChildren(h('div', { class: 'auth' }, h('form', { class: 'card stack', onsubmit: submit },
      h('div', { class: 'brand' }, h('div', { class: 'logo' }, h('img', { src: '/shared/splash/logo.svg', alt: '' })), 'Narancs Signage'),
      h('p', { class: 'lead' }, setup ? tr('Üdv! Hozd létre az első adminisztrátor fiókot.') : tr('Jelentkezz be a vezérlőpulthoz.')),
      // nyelvválasztás még a fiók létrehozása előtt (a szerver csak beállítás nélküli rendszeren engedi)
      setup ? F.select('Language / Nyelv', data, 'language', Object.entries(I18N.LANGS), { onchange: async (v) => {
        try { await POST('/api/auth/language', { language: v }); location.reload(); } catch (ex) { err.textContent = ex.message; }
      } }) : null,
      setup ? F.text(tr('Szervezet neve'), data, 'org_name', { placeholder: tr('pl. Narancs Kft.') }) : null,
      F.text(tr('Felhasználónév'), data, 'username', { placeholder: 'admin' }),
      F.text(tr('Jelszó'), data, 'password', { type: 'password', placeholder: setup ? tr('legalább 6 karakter') : '' }),
      setup ? F.text(tr('Jelszó újra'), data, 'password2', { type: 'password' }) : null,
      err,
      h('button', { class: 'btn primary', type: 'submit', style: { padding: '11px' } }, setup ? tr('Fiók létrehozása') : tr('Belépés')),
      setup ? h('p', { class: 'small muted', style: { margin: 0, textAlign: 'center' } }, tr('Indulásként létrehozunk egy alap lejátszási listát néhány minta tartalommal – bármikor szerkesztheted vagy törölheted őket.')) : null,
      h('div', { class: 'copyright' }, `Narancs Signage ${COPYRIGHT}`, h('br'), builtWith()))));
  }

  // =====================================================================
  //  Keret és útválasztás
  // =====================================================================
  const NAV = [
    [tr('Áttekintés'), [['dashboard', tr('Irányítópult'), 'dashboard'], ['screens', tr('Képernyők'), 'screen'], ['reports', tr('Riportok'), 'chart']]],
    [tr('Tartalom'), [['playlists', tr('Lejátszási listák'), 'playlist'], ['slides', tr('Tartalmak'), 'slides'], ['media', tr('Médiatár'), 'media']]],
    [tr('Interaktív'), [['calendars', tr('Naptárak'), 'calendar'], ['forms', tr('Űrlapok'), 'form']]],
    [tr('Rendszer'), [['branding', tr('Arculat'), 'palette'], ['alerts', tr('Vészjelzés'), 'alert'], ['settings', tr('Beállítások'), 'settings']]],
  ];
  function shell() {
    // az arculat a rendszerbeállítások része → csak adminisztrátornak
    const nav = h('nav', { class: 'nav' }, NAV.map(([sec, items]) => [h('div', { class: 'nav-section' }, sec), items.filter(([r]) => r !== 'branding' || isAdmin()).map(([r, l, ic]) => h('a', { href: `#/${r}`, 'data-r': r }, icon(ic), l, h('span', { class: 'count hidden', 'data-count': r })))]));
    const sidebar = h('aside', { class: 'sidebar' },
      h('div', { class: 'brand' }, ME.logo_url ? h('img', { class: 'logo-img', src: ME.logo_url, alt: '' }) : h('div', { class: 'logo' }, h('img', { src: '/shared/splash/logo.svg', alt: '' })), h('div', {}, ME.org_name || 'Narancs Signage', h('small', {}, 'Narancs Signage'))),
      nav,
      h('div', { class: 'bottom' }, h('div', { class: 'avatar' }, ME.username[0].toUpperCase()), h('div', { class: 'who' }, ME.username, h('small', {}, ROLE_NAMES[ME.role] || ROLE_NAMES.admin)),
        btn('', toggleTheme, { cls: 'ghost icon', ic: 'moon', title: tr('Sötét/világos mód') }),
        btn('', async () => { await POST('/api/auth/logout'); boot(); }, { cls: 'ghost icon', ic: 'logout', title: tr('Kijelentkezés') })),
      h('div', { class: 'copyright' }, COPYRIGHT, h('br'), builtWith()));
    nav.addEventListener('click', () => sidebar.classList.remove('open'));
    $('#app').replaceChildren(
      h('div', { class: 'mobile-bar' }, btn('', () => sidebar.classList.toggle('open'), { cls: 'ghost icon', ic: 'menu' }), 'Narancs Signage'),
      ME.role === 'viewer' ? h('div', { class: 'role-banner' }, tr('👁️ Megtekintő vagy: mindent láthatsz, de módosítani nem tudsz.')) : null,
      h('div', { class: 'layout' }, sidebar, h('main', { class: 'main', id: 'view' })));
  }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('signage.theme', next); } catch { /* */ }
  }
  try { const t = localStorage.getItem('signage.theme'); if (t) document.documentElement.dataset.theme = t; } catch { /* */ }

  const ROUTES = {
    dashboard: pageDashboard, screens: pageScreens, playlists: pagePlaylists, slides: pageSlides, media: pageMedia,
    calendars: pageCalendars, forms: pageForms, alerts: pageAlerts, settings: pageSettings, branding: pageBranding, reports: pageReports,
  };
  let routeCleanup = null;
  let dirty = null; // nem mentett változások figyelése
  async function route() {
    if (!ME) return;
    const [name = 'dashboard', arg] = location.hash.replace(/^#\/?/, '').split('/');
    if (dirty && dirty() && !(await confirmBox(tr('Vannak nem mentett változtatások. Biztosan elhagyod az oldalt?'), { ok: tr('Elhagyom') }))) {
      history.replaceState(null, '', routeCleanup?.hash || '#/');
      return;
    }
    dirty = null;
    routeCleanup?.fn?.();
    routeCleanup = { hash: location.hash };
    $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.r === name));
    const view = $('#view');
    view.replaceChildren(h('div', { class: 'muted' }, tr('Betöltés…')));
    try {
      await (ROUTES[name] || pageDashboard)(view, arg);
    } catch (e) {
      view.replaceChildren(h('div', { class: 'card card-pad' }, h('b', {}, tr('Hiba: ')), e.message));
    }
    window.scrollTo(0, 0);
  }
  const onLeave = (fn) => { routeCleanup.fn = fn; };
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', (e) => { if (dirty && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  function head(title, sub, actions = [], crumbs) {
    return h('div', { class: 'page-head' },
      h('div', {}, crumbs ? h('div', { class: 'crumbs' }, crumbs) : null, h('h1', {}, title), sub ? h('p', {}, sub) : null),
      h('div', { class: 'actions' }, actions));
  }

  async function refreshBadges() {
    try {
      const s = await GET('/api/screens');
      const c = $('[data-count="screens"]');
      if (c) { c.textContent = s.pending.length; c.classList.toggle('hidden', !s.pending.length); }
      const a = (await GET('/api/alerts')).filter((x) => !x.expires_at || x.expires_at > Date.now());
      const ac = $('[data-count="alerts"]');
      if (ac) { ac.textContent = a.length; ac.classList.add('red'); ac.classList.toggle('hidden', !a.length); }
    } catch { /* */ }
  }

  async function boot() {
    const st = await GET('/api/auth/state');
    if (st.setup) return authScreen(true);
    if (!st.user) { ME = null; return authScreen(false); }
    ME = st.user;
    try { const st0 = await GET('/api/settings'); ME.org_name = st0.org_name; ME.logo_url = st0.logo_url; cache.branding = st0.branding; } catch { /* */ }
    shell();
    route();
    refreshBadges();
    clearInterval(boot.t);
    boot.t = setInterval(refreshBadges, 20000);
  }

  // =====================================================================
  //  Irányítópult
  // =====================================================================
  // =====================================================================
  //  Riportok: mi, hol, hányszor ment le (proof of play)
  // =====================================================================
  const reportFilter = { from: '', to: '', screen_id: '' };
  async function pageReports(view) {
    const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    if (!reportFilter.to) { reportFilter.to = ymd(Date.now()); reportFilter.from = ymd(Date.now() - 6 * 864e5); }
    const { screens } = await GET('/api/screens');
    const qs = () => new URLSearchParams(Object.entries(reportFilter).filter(([, v]) => v)).toString();
    const d = await GET(`/api/reports?${qs()}`);
    const preset = (n) => () => { reportFilter.to = ymd(Date.now()); reportFilter.from = ymd(Date.now() - (n - 1) * 864e5); route(); };
    const thisMonth = () => { const n = new Date(); reportFilter.from = ymd(new Date(n.getFullYear(), n.getMonth(), 1)); reportFilter.to = ymd(n); route(); };
    const filters = h('div', { class: 'card card-pad report-filters' },
      F.text(tr('Ettől'), reportFilter, 'from', { type: 'date', onchange: route }),
      F.text(tr('Eddig'), reportFilter, 'to', { type: 'date', onchange: route }),
      F.select(tr('Képernyő'), reportFilter, 'screen_id', [['', tr('Minden képernyő')], ...screens.map((x) => [String(x.id), x.name])], { onchange: route }),
      h('div', { class: 'row', style: { alignSelf: 'end' } }, btn(tr('7 nap'), preset(7), { cls: 'sm' }), btn(tr('30 nap'), preset(30), { cls: 'sm' }), btn(tr('Ez a hónap'), thisMonth, { cls: 'sm' })));
    // napi oszlopdiagram az egész időszakra
    const days = [];
    for (let t = new Date(`${reportFilter.from}T12:00`); ymd(t) <= reportFilter.to && days.length < 400; t.setDate(t.getDate() + 1)) days.push(ymd(t));
    const byDay = Object.fromEntries(d.by_day.map((x) => [x.day, x]));
    const max = Math.max(1, ...days.map((k) => (byDay[k]?.views || 0) + (byDay[k]?.touches || 0)));
    const bars = h('div', { class: 'bars report-bars' }, days.map((k) => {
      const v = byDay[k]?.views || 0, t = byDay[k]?.touches || 0;
      return h('div', { class: 'b', title: `${new Date(`${k}T12:00`).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })}: ${tr('{v} megjelenés, {t} érintés', { v, t })}` }, h('div', { class: 'col', style: { height: `${((v + t) / max) * 100}%` } },
        h('i', { style: { flex: v || 0 } }), h('i', { class: 't', style: { flex: t || 0 } })), days.length <= 14 ? h('small', {}, I18N.dayShort(new Date(k).getDay())) : null);
    }));
    const total = d.totals.views || 1;
    const table = (rows, label, nameCell) => rows.length ? h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, label), h('th', { class: 'num' }, tr('Megjelenés')), h('th', { class: 'num' }, tr('Érintés')), h('th', { class: 'num' }, tr('Arány')))),
      h('tbody', {}, rows.map((x, i) => h('tr', {}, h('td', { class: 'muted' }, i + 1), h('td', {}, nameCell(x)), h('td', { class: 'num' }, x.views), h('td', { class: 'num' }, x.touches),
        h('td', { class: 'num' }, h('div', { class: 'share' }, h('b', {}, h('i', { style: { width: `${(x.views / total) * 100}%` } })), h('span', {}, `${Math.round((x.views / total) * 100)}%`))))))) : h('div', { class: 'empty small' }, tr('Ebben az időszakban nincs adat'));
    const stat = (ic, v, l) => h('div', { class: 'card stat' }, h('div', { class: 'ic' }, icon(ic)), h('div', {}, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l)));
    view.replaceChildren(
      head(tr('Riportok'), tr('Mi, hol és hányszor jelent meg a képernyőkön (lejátszási igazolás).'),
        [h('a', { class: 'btn', href: `/api/reports/export.csv?${qs()}` }, icon('download'), tr('CSV letöltése'))]),
      filters,
      h('div', { class: 'grid c4' }, stat('eye', d.totals.views, tr('Megjelenés')), stat('touch', d.totals.touches, tr('Érintés')), stat('screen', d.totals.screens, tr('Aktív képernyő')), stat('slides', d.totals.slides, tr('Lejátszott tartalom'))),
      h('div', { class: 'card mt' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Napi aktivitás')), h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: 'var(--primary)' } }), tr('Megjelenés')), h('span', {}, h('i', { style: { background: '#ffc9a1' } }), tr('Érintés')))), h('div', { class: 'card-body' }, bars)),
      h('div', { class: 'grid c2 mt' },
        h('div', { class: 'card table-wrap' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Tartalmak szerint'))), table(d.by_slide, tr('Tartalom'), (x) => x.type ? h('a', { href: `#/slides/${x.slide_id}` }, `${TYPES[x.type]?.e || ''} ${x.name}`) : h('span', { class: 'muted' }, x.name))),
        h('div', { class: 'card table-wrap' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Képernyők szerint'))), table(d.by_screen, tr('Képernyő'), (x) => x.name))),
      h('p', { class: 'small muted mt' }, tr('A kijelzők minden tartalom megjelenését és minden érintést rögzítenek; az adatok 90 napig maradnak meg. A CSV export soronként egy eseményt tartalmaz időponttal.')));
  }

  async function pageDashboard(view) {
    const d = await GET('/api/dashboard');
    await load('media');
    const c = d.counts;
    const stat = (ic, v, l, cls = '') => h('div', { class: `card stat ${cls}` }, h('div', { class: 'ic' }, icon(ic)), h('div', {}, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l)));
    // 7 napos diagram
    const days = [];
    for (let i = 6; i >= 0; i--) { const t = new Date(Date.now() - i * 864e5); days.push(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`); }
    const byDay = Object.fromEntries(d.daily.map((x) => [x.day, x]));
    const max = Math.max(1, ...days.map((k) => (byDay[k]?.views || 0) + (byDay[k]?.touches || 0)));
    const bars = h('div', { class: 'bars' }, days.map((k) => {
      const v = byDay[k]?.views || 0, t = byDay[k]?.touches || 0;
      return h('div', { class: 'b', title: tr('{v} megjelenés, {t} érintés', { v, t }) }, h('div', { class: 'col', style: { height: `${((v + t) / max) * 100}%` } },
        h('i', { style: { flex: v || 0 } }), h('i', { class: 't', style: { flex: t || 0 } })), h('small', {}, I18N.dayShort(new Date(k).getDay())));
    }));
    const pctFree = d.storage ? Math.round((d.storage.free / d.storage.total) * 100) : null;

    view.replaceChildren(
      head(tr('Szia, {name}! 👋', { name: ME.username }), `${new Date().toLocaleDateString(LOCALE, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
        [btn(tr('Vészjelzés'), () => { location.hash = '#/alerts'; }, { ic: 'alert', cls: 'danger' }), btn(tr('Új tartalom'), () => newSlideDialog(), { ic: 'plus', cls: 'primary' })]),
      c.pending ? h('div', { class: 'card card-pad row', style: { background: 'var(--primary-soft)', borderColor: 'var(--primary)', marginBottom: '18px' } },
        h('div', { style: { fontSize: '26px' } }, '📺'), h('div', { class: 'grow' }, h('b', {}, tr('{n} új képernyő vár párosításra', { n: c.pending })), h('div', { class: 'small muted' }, tr('A képernyőn megjelenő 6 jegyű kóddal tudod hozzáadni.'))),
        btn(tr('Párosítás'), () => pairDialog(), { cls: 'primary' })) : null,
      h('div', { class: 'grid c4' },
        stat('screen', `${c.online}/${c.screens}`, tr('Képernyő online'), 'green'),
        stat('slides', c.slides, tr('Tartalom · {n} lista', { n: c.playlists })),
        stat('touch', c.touches_week, tr('Érintés (7 nap)'), 'blue'),
        stat('form', c.submissions_week, tr('Űrlap beküldés (7 nap)'), 'yellow')),
      d.alerts.length ? h('div', { class: 'card card-pad mt row', style: { background: 'var(--danger-soft)', borderColor: 'var(--danger)' } },
        h('b', {}, tr('🚨 {n} aktív vészjelzés/közlemény fut a képernyőkön', { n: d.alerts.length })), h('span', { class: 'grow' }), btn(tr('Kezelés'), () => { location.hash = '#/alerts'; }, { cls: 'sm' })) : null,
      h('div', { class: 'grid c2 mt' },
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h3', {}, tr('Képernyők állapota')), h('a', { href: '#/screens', class: 'small' }, tr('Összes →'))),
          d.screens.length ? h('div', {}, d.screens.slice(0, 7).map((s) => h('div', { class: 'list-item' },
            h('span', { class: `dot ${s.online ? 'on' : ''}` }),
            h('div', { class: 'grow' }, h('b', {}, s.name), h('div', { class: 'small muted' }, s.online ? `▶ ${s.info?.current?.name || '—'}` : tr('Utoljára: {t}', { t: ago(s.last_seen) }))),
            h('span', { class: `badge ${s.online ? 'green' : ''}` }, s.online ? tr('Online') : tr('Offline')))))
            : h('div', { class: 'empty' }, h('div', { class: 'big' }, '📺'), h('h3', {}, tr('Még nincs képernyő')), h('p', {}, tr('Telepítsd a lejátszót egy eszközre, majd párosítsd itt.')), btn(tr('Képernyő párosítása'), () => pairDialog(), { cls: 'primary' }))),
        h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h3', {}, tr('Aktivitás – utolsó 7 nap')), h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: 'var(--primary)' } }), tr('Megjelenés')), h('span', {}, h('i', { style: { background: '#ffc9a1' } }), tr('Érintés')))),
          h('div', { class: 'card-body' }, bars, h('div', { class: 'small muted mt' }, tr('Összesen {v} megjelenés és {t} érintés.', { v: c.views_week, t: c.touches_week }))))),
      h('div', { class: 'grid c3 mt' },
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Legnézettebb tartalmak'))),
          d.top_slides.length ? h('div', {}, d.top_slides.map((s, i) => h('a', { class: 'list-item', href: `#/slides/${s.id}`, style: { color: 'inherit', textDecoration: 'none' } },
            h('b', { class: 'muted' }, i + 1), h('span', {}, TYPES[s.type]?.e), h('span', { class: 'grow' }, s.name), h('span', { class: 'badge orange' }, s.views))))
            : h('div', { class: 'empty small' }, tr('Még nincs adat'))),
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Legutóbbi beküldések'))),
          d.recent_submissions.length ? h('div', {}, d.recent_submissions.map((s) => h('a', { class: 'list-item', href: `#/forms/${s.form_id}/subs`, style: { color: 'inherit', textDecoration: 'none' } },
            h('span', {}, '📋'), h('span', { class: 'grow' }, s.form_name), h('span', { class: 'small muted' }, ago(s.created_at)))))
            : h('div', { class: 'empty small' }, tr('Még nincs beküldés'))),
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Rendszer'))),
          h('div', { class: 'card-body stack' },
            h('div', { class: 'kv' }, tr('Médiatár: '), h('b', {}, tr('{n} fájl, {size}', { n: c.media.n, size: fmtBytes(c.media.s) }))),
            d.storage ? h('div', {}, h('div', { class: 'kv' }, tr('Szabad hely: '), h('b', {}, `${fmtBytes(d.storage.free)} (${pctFree}%)`)),
              h('div', { class: 'progress', style: { marginTop: '6px' } }, h('div', { style: { width: `${100 - pctFree}%`, background: pctFree < 10 ? 'var(--danger)' : null } }))) : null,
            h('div', { class: 'row' }, btn(tr('Összes újratöltése'), async () => { const r = await POST('/api/screens/broadcast', { command: 'reload' }); toast(tr('{n} képernyő újratöltve', { n: r.count })); }, { cls: 'sm', ic: 'refresh' }),
              btn(tr('Azonosítás'), async () => { await POST('/api/screens/broadcast', { command: 'identify' }); toast(tr('A képernyők 10 mp-ig a nevüket mutatják')); }, { cls: 'sm', ic: 'target' }))))),
    );
    const t = setInterval(() => { if (!document.hidden && location.hash.match(/^(#\/?)?(dashboard)?$/)) pageDashboard(view).catch(() => {}); }, 30000);
    onLeave(() => clearInterval(t));
  }

  // =====================================================================
  //  Képernyők
  // =====================================================================
  async function pairDialog(prefillName) {
    const pls = await load('playlists', true);
    const data = { code: '', name: prefillName || '', playlist_id: pls[0]?.id || null };
    const err = h('div', { class: 'small', style: { color: 'var(--danger)' } });
    const submit = async () => {
      try {
        const s = await POST('/api/screens/pair', data);
        toast(tr('„{name}” sikeresen párosítva', { name: s.name }));
        m.close();
        refreshBadges();
        if (location.hash.startsWith('#/screens')) route(); else location.hash = '#/screens';
      } catch (e) { err.textContent = e.message; }
    };
    const codeIn = F.text(tr('Párosító kód'), data, 'code', { placeholder: '000000', hint: tr('A lejátszó első indításakor egy 6 jegyű kódot mutat.') });
    codeIn.querySelector('input').classList.add('pair-input');
    codeIn.querySelector('input').maxLength = 6;
    codeIn.querySelector('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    const m = modal({
      title: tr('Képernyő párosítása'),
      body: h('div', { class: 'stack' }, codeIn, F.text(tr('Képernyő neve'), data, 'name', { placeholder: tr('pl. Recepció, Aula bal oldal') }),
        F.select(tr('Lejátszási lista'), data, 'playlist_id', [['', tr('— később választok —')], ...pls.map((p) => [p.id, p.name])], { number: true }), err,
        installHint()),
      foot: [btn(tr('Mégse'), () => m.close()), btn(tr('Párosítás'), submit, { cls: 'primary' })],
    });
  }

  function installHint() {
    const cmd = `curl -fsSL ${location.origin}/install-player.sh | sudo bash`;
    return h('div', { class: 'small', style: { background: 'var(--primary-softer)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px' } },
      h('b', {}, tr('💡 Új kijelző telepítése (Ubuntu Server / Raspberry Pi, ARM vagy x86):')),
      h('div', { class: 'row', style: { marginTop: '8px', flexWrap: 'nowrap' } },
        h('code', { class: 'code-pill grow', style: { overflowX: 'auto', whiteSpace: 'nowrap', padding: '6px 10px' } }, cmd),
        btn(tr('Másolás'), () => { navigator.clipboard?.writeText(cmd).then(() => toast(tr('Parancs vágólapra másolva')), () => toast(cmd)); }, { cls: 'sm', ic: 'copy' })),
      h('div', { class: 'muted', style: { marginTop: '6px' } }, tr('Vagy nyisd meg bármely böngészőben: '), h('span', { class: 'code-pill' }, `${location.origin}/player/`)));
  }

  // Újraindítási lehetőségek egy képernyőre (screen) vagy az összesre (null)
  function restartDialog(screen) {
    const all = !screen;
    const agentOk = all || screen.agent_online;
    const send = async (command, label) => {
      if (command === 'reboot' && !(await confirmBox(all ? tr('Minden kijelző eszköz újraindul. Kb. 1 percig nem lesz kép. Folytatod?') : tr('A(z) „{name}” eszköz újraindul, kb. 1 percig nem lesz kép. Folytatod?', { name: screen.name }), { ok: tr('Újraindítás') }))) return;
      try {
        if (all) { const r = await POST('/api/screens/broadcast', { command }); toast(tr('{label}: {n} képernyő', { label, n: r.count })); }
        else { const r = await POST(`/api/screens/${screen.id}/command`, { command }); toast(r.delivered ? tr('{label} elküldve', { label }) : tr('A képernyő jelenleg nem érhető el'), r.delivered ? 'ok' : 'err'); }
        m.close();
      } catch (e) { fail(e); }
    };
    const option = (ic, title, desc, command, enabled = true, note) => h('div', { class: 'list-item', style: { opacity: enabled ? 1 : 0.55 } },
      h('div', { class: 'stat', style: { padding: 0 } }, h('div', { class: 'ic' }, icon(ic))),
      h('div', { class: 'grow' }, h('b', {}, title), h('div', { class: 'small muted' }, desc), note ? h('div', { class: 'small', style: { color: 'var(--danger)' } }, note) : null),
      btn(tr('Indítás'), () => send(command, title), { cls: command === 'reboot' ? 'sm danger' : 'sm primary', disabled: !enabled }));
    const noAgent = tr('Ehhez a telepített lejátszó ügynöke szükséges (install-player.sh). Futtasd újra a telepítőt a kijelzőn.');
    const quick = h('div', { class: 'row', style: { marginBottom: '14px' } },
      btn(tr('Azonosítás'), async () => {
        try {
          if (all) { const r = await POST('/api/screens/broadcast', { command: 'identify' }); toast(tr('{n} képernyő mutatja a nevét 10 mp-ig', { n: r.count })); }
          else { const r = await POST(`/api/screens/${screen.id}/command`, { command: 'identify' }); toast(r.delivered ? tr('A képernyő 10 mp-ig a nevét mutatja') : tr('A képernyő jelenleg nem érhető el'), r.delivered ? 'ok' : 'err'); }
        } catch (e) { fail(e); }
      }, { ic: 'target', title: tr('A képernyő 10 másodpercig a nevét mutatja') }),
      all ? null : btn(tr('Előnézet új lapon'), () => window.open(`/player/?preview=screen:${screen.id}`, '_blank'), { ic: 'eye' }));
    const m = modal({
      title: all ? tr('Összes képernyő vezérlése') : tr('Vezérlés: {name}', { name: screen.name }),
      body: h('div', {}, quick, h('div', { class: 'card' },
        all ? null : h('div', { class: 'list-item', style: { opacity: agentOk ? 1 : 0.55 } },
          h('div', { class: 'stat', style: { padding: 0 } }, h('div', { class: 'ic' }, icon('camera'))),
          h('div', { class: 'grow' }, h('b', {}, tr('Képernyőkép')), h('div', { class: 'small muted' }, tr('Mi látszik most a valódi kijelzőn? Pár másodperc.')), agentOk ? null : h('div', { class: 'small', style: { color: 'var(--danger)' } }, noAgent)),
          btn(tr('Megnézem'), () => { m.close(); screenshotDialog(screen); }, { cls: 'sm primary', disabled: !agentOk })),
        option('refresh', tr('Oldal újratöltése'), tr('A lejátszó oldal frissül, a böngésző fut tovább. Pár másodperc.'), 'reload', all || screen.online),
        option('screen', tr('Lejátszó újraindítása'), tr('A böngésző teljesen újraindul, közben a logós indulóképernyő látszik. Kb. 10 másodperc.'), 'restart', agentOk, agentOk ? null : noAgent),
        option('power', tr('Eszköz újraindítása'), tr('A teljes kijelző eszköz (számítógép) újraindul. Kb. 1 perc.'), 'reboot', agentOk, agentOk ? null : noAgent))),
      foot: [btn(tr('Bezárás'), () => m.close())],
    });
  }

  // Képernyőkép a kijelzőről: az ügynök készíti és tölti fel, mi addig várunk, amíg frissebb kép érkezik
  function screenshotDialog(screen) {
    const img = h('img', { class: 'shot', alt: tr('Képernyőkép: {name}', { name: screen.name }) });
    const status = h('div', { class: 'small muted' });
    const url = () => `/api/screens/${screen.id}/screenshot?t=${Date.now()}`;
    let prev = screen.info?.screenshot_at || 0;
    if (prev) { img.src = url(); status.textContent = tr('Korábbi kép: {t}', { t: fmtDate(prev) }); }
    let busy = false;
    const take = async () => {
      if (busy) return;
      busy = true;
      status.textContent = tr('Képernyőkép kérése…');
      try {
        const r = await POST(`/api/screens/${screen.id}/command`, { command: 'screenshot' });
        if (!r.delivered) { status.textContent = tr('A kijelző ügynöke jelenleg nem érhető el.'); return; }
        for (let i = 0; i < 20; i++) {
          await new Promise((ok) => setTimeout(ok, 1000));
          const s = (await GET('/api/screens')).screens.find((x) => x.id === screen.id);
          if ((s?.info?.screenshot_at || 0) > prev) {
            prev = s.info.screenshot_at; img.src = url();
            status.textContent = tr('Készült: {t}', { t: fmtDate(prev) });
            return;
          }
        }
        status.textContent = tr('Nem érkezett kép. Ha a kijelzőn régebbi a lejátszó, futtasd újra rajta a telepítőt.');
      } catch (e) { fail(e); } finally { busy = false; }
    };
    const m = modal({
      title: tr('Képernyőkép: {name}', { name: screen.name }), size: 'wide',
      body: h('div', { class: 'stack' }, h('div', { class: 'shot-box' }, img), status),
      foot: [btn(tr('Új kép'), take, { ic: 'refresh' }), btn(tr('Bezárás'), () => m.close())],
    });
    take();
  }

  async function pageScreens(view) {
    const [{ screens, pending }, pls] = await Promise.all([GET('/api/screens'), load('playlists', true)]);
    const plName = (id) => pls.find((p) => p.id === id)?.name;
    let live = false;
    try { live = localStorage.getItem('signage.livepreview') === '1'; } catch { /* */ }
    const cmd = async (s, command, label) => {
      try { const r = await POST(`/api/screens/${s.id}/command`, { command }); toast(r.delivered ? label : tr('A képernyő jelenleg nem elérhető'), r.delivered ? 'ok' : 'err'); } catch (e) { fail(e); }
    };
    const grid = h('div', { class: 'grid auto' });
    const draw = () => grid.replaceChildren(...screens.map((s) => {
      const portrait = (s.settings?.orientation || '').startsWith('portrait');
      const playing = s.online && s.info?.current;
      return h('div', { class: 'card screen-card' },
        h('div', { class: 'thumb' },
          h('div', { class: 'pill st' }, h('span', { class: `dot ${s.online ? 'on' : ''}` }), s.online ? tr('Online') : tr('Offline')),
          h('div', { class: 'pill mode', title: s.settings?.tablet ? tr('Csak érintés, egérmutató nélkül') : tr('Egérmutató mozgatáskor 3 mp-ig') }, s.settings?.tablet ? tr('👆 Tablet') : tr('🖱️ Egér')),
          live ? h('iframe', { src: `/player/?preview=screen:${s.id}`, loading: 'lazy' })
            : h('div', { class: 'now' }, playing ? [h('small', {}, tr('Most játszik')), h('b', {}, s.info.current.name)] : h('small', {}, s.online ? tr('Nincs adat') : portrait ? tr('Álló kijelző') : tr('Fekvő kijelző'))),
          s.online ? h('div', { class: 'ctl' },
            h('button', { type: 'button', title: tr('Előző tartalom'), onclick: () => cmd(s, 'prev', tr('Előző tartalom')) }, icon('prev')),
            h('button', { type: 'button', title: tr('Következő tartalom'), onclick: () => cmd(s, 'next', tr('Következő tartalom')) }, icon('next'))) : null),
        h('div', { class: 'body' },
          h('h3', { title: s.name }, s.name),
          h('dl', { class: 'meta' },
            h('dt', {}, tr('Lista#lejátszási lista')), h('dd', {}, plName(s.playlist_id) || '—', s.schedule?.length ? h('span', { class: 'badge orange', style: { marginLeft: '6px' } }, tr('+{n} ütemezés', { n: s.schedule.length })) : null),
            h('dt', {}, tr('Felbontás')), h('dd', {}, s.info?.w ? `${s.info.w} × ${s.info.h}` : '—'),
            h('dt', {}, tr('Utolsó jel')), h('dd', {}, s.online ? tr('most aktív') : ago(s.last_seen)))),
        h('div', { class: 'foot' },
          btn(tr('Szerkesztés'), () => editScreen(s, pls), { cls: 'sm primary', ic: 'edit' }),
          btn(tr('Vezérlés'), () => restartDialog(s), { cls: 'sm', ic: 'power', title: tr('Azonosítás, előnézet, újratöltés, újraindítás') })));
    }));
    draw();
    const liveTog = F.toggle(tr('Élő előnézet'), { v: live }, 'v', { onchange: (v) => { live = v; try { localStorage.setItem('signage.livepreview', v ? '1' : '0'); } catch { /* */ } draw(); } });
    view.replaceChildren(
      head(tr('Képernyők'), tr('{n} párosított képernyő, {on} online', { n: screens.length, on: screens.filter((s) => s.online).length }), [liveTog, screens.length ? btn(tr('Összes vezérlése'), () => restartDialog(null), { ic: 'power' }) : null, btn(tr('Új képernyő'), () => pairDialog(), { ic: 'plus', cls: 'primary' })]),
      pending.length ? h('div', { class: 'card mt', style: { marginBottom: '18px', borderColor: 'var(--primary)' } },
        h('div', { class: 'card-head' }, h('h3', {}, tr('⏳ Párosításra váró eszközök ({n})', { n: pending.length }))),
        pending.map((p) => h('div', { class: 'list-item' }, h('span', { class: 'dot on' }), h('div', { class: 'grow' }, h('b', {}, tr('Eszköz {id}', { id: p.device_short })), h('div', { class: 'small muted' }, `${p.info?.w ? `${p.info.w}×${p.info.h} · ` : ''}${p.info?.platform || ''} · ${ago(p.last_seen)}`)),
          btn(tr('Párosítás kóddal'), () => pairDialog(), { cls: 'sm primary' }),
          btn(tr('Elvetés'), async () => {
            if (!(await confirmBox(tr('Elveted a(z) „{name}” eszközt? Ha újra jelentkezik, új kóddal kerül vissza a listára.', { name: p.device_short }), { ok: tr('Elvetés') }))) return;
            await DEL(`/api/screens/${p.id}`); toast(tr('Eszköz elvetve')); refreshBadges(); route();
          }, { cls: 'sm ghost', ic: 'trash', title: tr('Nem kívánt eszköz eltávolítása a listáról') })))) : null,
      screens.length ? grid : h('div', { class: 'card' }, h('div', { class: 'empty' }, h('div', { class: 'big' }, '📺'), h('h3', {}, tr('Még nincs párosított képernyő')),
        h('div', { style: { maxWidth: '640px', margin: '0 auto 16px', textAlign: 'left' } }, installHint()),
        btn(tr('Képernyő párosítása'), () => pairDialog(), { cls: 'primary' }))),
    );
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const fresh = await GET('/api/screens');
        if (fresh.pending.length !== pending.length) return route();
        fresh.screens.forEach((f) => { const s = screens.find((x) => x.id === f.id); if (s) Object.assign(s, f); });
        if (!live) draw();
      } catch { /* */ }
    }, 15000);
    onLeave(() => clearInterval(t));
  }

  function editScreen(screen, pls) {
    const s = clone(screen);
    s.settings ||= {};
    s.schedule ||= [];
    const st = s.settings;
    const plOpts = [['', tr('— nincs —')], ...pls.map((p) => [p.id, p.name])];
    let tab = 'general';
    const body = h('div');
    const tabs = h('div', { class: 'tabs' });
    const TABS = [['general', tr('Általános')], ['schedule', tr('Ütemezés')], ['look', tr('Megjelenés#fül')], ['power', tr('Be/kikapcsolás')], ['device', tr('Eszköz')]];
    const draw = () => {
      tabs.replaceChildren(...TABS.map(([k, l]) => h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; draw(); } }, l)));
      let content;
      if (tab === 'general') {
        content = h('div', { class: 'fields' },
          F.text(tr('Név'), s, 'name', { full: true }),
          F.select(tr('Alapértelmezett lejátszási lista'), s, 'playlist_id', plOpts, { number: true, full: true, hint: tr('Ez fut, ha egyik ütemezési szabály sem aktív.') }),
          F.number(tr('Visszatérés érintés után (mp)'), st, 'idle_return', { min: 10, max: 600, placeholder: '45', hint: tr('Ennyi tétlenség után folytatódik az automatikus lejátszás.') }),
          F.toggle(tr('Virtuális billentyűzet űrlapokhoz'), st, 'virtual_keyboard', { defaultOn: true, hint: tr('Érintőképernyőhöz, ha nincs fizikai billentyűzet') }),
          F.toggle(tr('Tablet mód (érintőképernyő)'), st, 'tablet', { full: true, hint: tr('Bekapcsolva soha nem jelenik meg egérmutató, csak érinteni lehet. Kikapcsolva egér mozgatásakor 3 másodpercig látszik a mutató, utána eltűnik.') }));
      } else if (tab === 'schedule') {
        const list = h('div');
        const drawRules = () => list.replaceChildren(...(s.schedule.length ? s.schedule.map((r, i) => h('div', { class: 'sched-row' },
          h('div', { class: 'num', style: { fontWeight: 800, color: 'var(--primary-strong)' } }, `#${i + 1}`),
          h('div', { class: 'fields' },
            F.select(tr('Lejátszási lista'), r, 'playlist_id', plOpts.slice(1), { number: true, full: true }),
            F.days(tr('Napok'), r, 'days', { full: true }),
            F.text(tr('Kezdés'), r, 'from', { type: 'time' }), F.text(tr('Befejezés'), r, 'to', { type: 'time' }),
            F.text(tr('Dátumtól (opcionális)'), r, 'date_from', { type: 'date' }), F.text(tr('Dátumig (opcionális)'), r, 'date_to', { type: 'date' }),
            h('div', { class: 'full row' },
              i > 0 ? btn(tr('Feljebb'), () => { [s.schedule[i - 1], s.schedule[i]] = [s.schedule[i], s.schedule[i - 1]]; drawRules(); }, { cls: 'sm' }) : null,
              btn(tr('Törlés'), () => { s.schedule.splice(i, 1); drawRules(); }, { cls: 'sm danger', ic: 'trash' }))))) : [h('div', { class: 'empty small' }, tr('Nincs ütemezési szabály – mindig az alapértelmezett lista fut.'))]));
        drawRules();
        content = h('div', { class: 'stack' },
          h('div', { class: 'small muted' }, tr('A szabályok sorrendben értékelődnek ki: az első érvényes szabály listája fut. Pl. reggel 7–10 között reggeli menü, hétvégén más tartalom.')),
          list, btn(tr('Szabály hozzáadása'), () => { s.schedule.push({ playlist_id: pls[0]?.id, days: [1, 2, 3, 4, 5], from: '08:00', to: '12:00' }); drawRules(); }, { ic: 'plus' }));
      } else if (tab === 'look') {
        content = h('div', { class: 'fields' },
          F.select(tr('Tájolás'), st, 'orientation', [['landscape', tr('Fekvő (alap)')], ['portrait', tr('Álló (90°)')], ['portrait-flipped', tr('Álló (270°)')], ['landscape-flipped', tr('Fekvő fejjel lefelé (180°)')]], { full: true, hint: tr('A lejátszó szoftveresen forgatja a tartalmat – nem kell a rendszert átállítani.') }),
          F.toggle(tr('Óra a sarokban'), st, 'show_clock'),
          F.toggle(tr('Folyamatjelző csík'), st, 'show_progress'),
          F.textarea(tr('Hírszalag (soronként egy üzenet)'), st, 'ticker', { rows: 3, placeholder: tr('Pl. Ma 14:00-kor tűzriadó gyakorlat\nA kávézó ma 16:00-ig van nyitva'), hint: tr('Üresen hagyva nem jelenik meg.') }),
          F.number(tr('Hírszalag sebesség (%)'), st, 'ticker_speed', { min: 25, max: 400, placeholder: '100' }),
          F.color(tr('Hírszalag színe'), st, 'ticker_color'),
          F.select(tr('Arculat / téma'), st, 'theme', [['', tr('Globális arculat (Arculat menü)')], ...Object.entries(window.SIGNAGE_THEMES.THEMES).map(([k, t]) => [k, `${tr(t.name)} – ${tr(t.desc)}`])], { full: true, hint: tr('Ez a képernyő eltérő témát is használhat (pl. étterem bordó, recepció kék). A logó és a fejléc a globális marad.') }),
          F.color(tr('Kiemelő szín felülírása'), st, 'accent', { theme: false, hint: tr('Csak ezen a képernyőn, a téma kiemelő színe helyett') }));
      } else if (tab === 'power') {
        content = h('div', { class: 'fields' },
          F.toggle(tr('Időzített képernyő kikapcsolás'), st, 'power_schedule', { full: true, hint: tr('Az üzemidőn kívül fekete képet mutat (OLED/LCD kímélés, energiatakarékosság). Telepített lejátszón a monitort is lekapcsolja.') }),
          F.text(tr('Bekapcsolás'), st, 'on_time', { type: 'time' }), F.text(tr('Kikapcsolás'), st, 'off_time', { type: 'time' }),
          F.days(tr('Üzemnapok'), st, 'on_days', { full: true }));
      } else {
        const i = s.info || {};
        content = h('div', { class: 'stack' },
          h('table', { class: 'table' }, [[tr('Eszköz ID'), s.device_short + '…'], [tr('Felbontás'), i.w ? `${i.w}×${i.h}` : '—'], [tr('Platform'), i.platform || '—'], [tr('Böngésző'), i.ua || '—'], [tr('Nyelv'), i.lang || '—'], [tr('Futásidő'), i.uptime ? fmtDur(i.uptime) : '—'], [tr('Offline gyorsítótár'), i.offline_cache ? tr('aktív') : tr('nem elérhető')], [tr('Utoljára látva'), fmtDate(s.last_seen)],
              [tr('Távvezérlő ügynök'), s.agent_online ? tr('kapcsolódva (v{v})', { v: i.agent?.version || '?' }) : i.agent ? tr('nem kapcsolódik (utoljára {t})', { t: ago(i.agent.seen) }) : tr('nincs telepítve')],
              [tr('Eszköz'), i.agent ? `${i.agent.host || '—'} · ${i.agent.ip || ''} · ${i.agent.os || ''}` : '—'],
              [tr('Eszköz futásideje'), i.agent?.sys_uptime ? fmtDur(i.agent.sys_uptime) : '—'], [tr('Párosítva'), fmtDate(s.created_at)]]
            .map(([k, v]) => h('tr', {}, h('td', { class: 'muted', style: { width: '170px' } }, k), h('td', { style: { wordBreak: 'break-all' } }, v)))),
          h('div', { class: 'row' },
            btn(tr('Gyorsítótár ürítése'), async () => { await POST(`/api/screens/${s.id}/command`, { command: 'clear-cache' }); toast(tr('Parancs elküldve')); }, { cls: 'sm' }),
            btn(tr('Újraindítás…'), () => restartDialog(s), { cls: 'sm', ic: 'power' }),
            btn(tr('Képernyő törlése'), async () => {
              if (!(await confirmBox(tr('Biztosan törlöd a(z) „{name}” képernyőt? Újra párosítani kell majd.', { name: s.name }), { ok: tr('Törlés') }))) return;
              await DEL(`/api/screens/${s.id}`); toast(tr('Képernyő törölve')); m.close(); route();
            }, { cls: 'sm danger', ic: 'trash' })));
      }
      body.replaceChildren(tabs, content);
    };
    draw();
    const m = modal({
      title: tr('Képernyő: {name}', { name: screen.name }), size: 'wide', body,
      foot: [btn(tr('Mégse'), () => m.close()), btn(tr('Mentés'), async () => {
        try { await PUT(`/api/screens/${s.id}`, s); toast(tr('Képernyő mentve – a változás azonnal megjelenik')); m.close(); route(); } catch (e) { fail(e); }
      }, { cls: 'primary', ic: 'save' })],
    });
  }

  // =====================================================================
  //  Lejátszási listák
  // =====================================================================
  async function pagePlaylists(view, id) {
    if (id) return pagePlaylistEdit(view, +id);
    const [pls, slides, { screens }] = await Promise.all([load('playlists', true), load('slides', true), GET('/api/screens'), load('media')]);
    const sById = Object.fromEntries(slides.map((s) => [s.id, s]));
    const create = async () => {
      const name = prompt(tr('Az új lejátszási lista neve:'), tr('Új lista'));
      if (!name) return;
      const p = await POST('/api/playlists', { name, items: [] });
      invalidate('playlists');
      location.hash = `#/playlists/${p.id}`;
    };
    view.replaceChildren(
      head(tr('Lejátszási listák'), tr('A képernyők ezeket a listákat játsszák le körbe-körbe.'), [btn(tr('Új lista'), create, { ic: 'plus', cls: 'primary' })]),
      pls.length ? h('div', { class: 'grid auto' }, pls.map((p) => {
        const items = p.items.filter((i) => sById[i.slide_id]);
        const total = items.reduce((a, i) => a + (i.duration || slideDuration(sById[i.slide_id]) || 0), 0);
        const used = screens.filter((s) => s.playlist_id === p.id || s.schedule?.some((r) => r.playlist_id === p.id));
        const first = items[0] && sById[items[0].slide_id];
        return h('div', { class: 'card slide-card', onclick: () => { location.hash = `#/playlists/${p.id}`; } },
          first ? slideThumb(first, h('div', { class: 'thumb' })) : h('div', { class: 'thumb' }, '▶'),
          h('div', { class: 'body' }, h('h4', {}, p.name),
            h('div', { class: 'row small muted', style: { marginTop: '4px' } }, tr('{n} elem · ~{d}', { n: items.length, d: fmtDur(total) })),
            h('div', { class: 'row', style: { marginTop: '6px', gap: '4px' } }, used.length ? used.slice(0, 3).map((s) => h('span', { class: 'badge green' }, '📺 ' + s.name)) : h('span', { class: 'badge' }, tr('Nincs képernyőn')))));
      })) : h('div', { class: 'card' }, h('div', { class: 'empty' }, h('div', { class: 'big' }, '▶️'), h('h3', {}, tr('Még nincs lejátszási lista')), h('p', {}, tr('Hozz létre egyet, és add hozzá a tartalmakat.')), btn(tr('Új lista'), create, { cls: 'primary', ic: 'plus' }))),
    );
  }

  async function pagePlaylistEdit(view, id) {
    const [p, slides] = await Promise.all([GET(`/api/playlists/${id}`), load('slides', true), load('media')]);
    const sById = Object.fromEntries(slides.map((s) => [s.id, s]));
    const orig = JSON.stringify(p);
    dirty = () => JSON.stringify(p) !== orig && !saved;
    let saved = false;
    const list = h('div');
    const totalEl = h('span', { class: 'badge orange' });
    const pv = previewFrame(`/player/?preview=playlist:${p.id}`);

    const draw = () => {
      p.items = p.items.filter((i) => sById[i.slide_id]);
      const total = p.items.filter((i) => i.enabled !== false).reduce((a, i) => a + (i.duration || slideDuration(sById[i.slide_id]) || 0), 0);
      totalEl.textContent = tr('{n} elem · ~{d}', { n: p.items.length, d: fmtDur(total) });
      let dragFrom = null;
      list.replaceChildren(...(p.items.length ? p.items.map((it, i) => {
        const s = sById[it.slide_id];
        const extra = h('div', { class: 'pl-extra' + (it.valid_from || it.valid_to ? '' : ' hidden') },
          tr('📅 Érvényes:'), h('input', { class: 'input', type: 'date', value: it.valid_from || '', oninput: (e) => { it.valid_from = e.target.value || null; } }),
          '–', h('input', { class: 'input', type: 'date', value: it.valid_to || '', oninput: (e) => { it.valid_to = e.target.value || null; } }));
        const dur = h('input', { class: 'input dur', type: 'number', min: 0, placeholder: slideDuration(s) ? `${slideDuration(s)}` : 'auto', value: it.duration || '', title: tr('Megjelenési idő (mp). Üresen: a tartalom saját ideje.'), oninput: (e) => { it.duration = e.target.value ? +e.target.value : null; draw.total(); } });
        const row = h('div', { class: `pl-item ${it.enabled === false ? 'disabled' : ''}`, draggable: true },
          h('span', { class: 'handle' }, icon('grip')),
          h('span', { class: 'num' }, i + 1),
          slideThumb(s, h('div', { class: 'thumb' })),
          h('div', { class: 'grow' }, h('a', { href: `#/slides/${s.id}`, style: { fontWeight: 600, color: 'inherit' } }, s.name), h('div', { class: 'small muted' }, `${TYPES[s.type]?.name}${it.valid_from || it.valid_to ? ` · ${it.valid_from || '…'} – ${it.valid_to || '…'}` : ''}`), extra),
          dur, h('span', { class: 'small muted' }, tr('mp')),
          F.toggle('', it, 'enabled', { defaultOn: true, onchange: () => draw() }),
          btn('', () => extra.classList.toggle('hidden'), { cls: 'sm icon ghost', ic: 'calendar', title: tr('Érvényességi időszak') }),
          btn('', () => { p.items.splice(i, 1); draw(); }, { cls: 'sm icon ghost', ic: 'trash', title: tr('Eltávolítás a listából') }));
        row.addEventListener('dragstart', (e) => { dragFrom = i; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
        row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('over'); });
        row.addEventListener('dragleave', () => row.classList.remove('over'));
        row.addEventListener('drop', (e) => {
          e.preventDefault(); row.classList.remove('over');
          if (dragFrom == null || dragFrom === i) return;
          const [x] = p.items.splice(dragFrom, 1); p.items.splice(i, 0, x); draw();
        });
        return row;
      }) : [h('div', { class: 'empty' }, h('div', { class: 'big' }, '🎞'), h('h3', {}, tr('Üres lista')), h('p', {}, tr('Adj hozzá tartalmakat a lenti gombbal.')))]));
    };
    draw.total = debounce(() => {
      const total = p.items.filter((i) => i.enabled !== false).reduce((a, i) => a + (i.duration || slideDuration(sById[i.slide_id]) || 0), 0);
      totalEl.textContent = tr('{n} elem · ~{d}', { n: p.items.length, d: fmtDur(total) });
    }, 200);
    draw();

    const addSlides = async () => {
      const picked = await pickSlides(slides);
      if (!picked?.length) return;
      p.items.push(...picked.map((sid) => ({ slide_id: sid, duration: null, enabled: true })));
      draw();
    };
    const save = async () => {
      try {
        await PUT(`/api/playlists/${p.id}`, p);
        saved = true; dirty = () => false;
        invalidate('playlists');
        toast(tr('Lista mentve – a képernyők frissülnek'));
        setTimeout(() => pv.reload(), 300);
        saved = false;
        const o2 = JSON.stringify(p); dirty = () => JSON.stringify(p) !== o2;
      } catch (e) { fail(e); }
    };
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } };
    document.addEventListener('keydown', onKey);
    onLeave(() => document.removeEventListener('keydown', onKey));

    view.replaceChildren(
      head(p.name, null, [
        btn(tr('Törlés'), async () => {
          if (!(await confirmBox(tr('Biztosan törlöd a(z) „{name}” listát?', { name: p.name }), { ok: tr('Törlés') }))) return;
          await DEL(`/api/playlists/${p.id}`); dirty = null; invalidate('playlists'); toast(tr('Lista törölve')); location.hash = '#/playlists';
        }, { cls: 'danger', ic: 'trash' }),
        btn(tr('Mentés'), save, { cls: 'primary', ic: 'save' })], [h('a', { href: '#/playlists' }, tr('Lejátszási listák')), ' / ']),
      h('div', { class: 'split wide-left' },
        h('div', { class: 'stack' },
          h('div', { class: 'card card-pad fields' },
            F.text(tr('Lista neve'), p, 'name'),
            F.select(tr('Átmenet a tartalmak között'), p, 'transition', TRANSITIONS)),
          h('div', { class: 'card' },
            h('div', { class: 'card-head' }, h('h3', {}, tr('Tartalmak sorrendje')), totalEl),
            h('div', { class: 'card-body' }, list,
              h('div', { class: 'row' }, btn(tr('Tartalom hozzáadása'), addSlides, { ic: 'plus', cls: 'primary' }), btn(tr('Új tartalom létrehozása'), () => newSlideDialog(), { ic: 'edit' }))))),
        h('div', { class: 'preview-box stack' },
          h('div', { class: 'row between' }, h('b', {}, tr('Élő előnézet')), h('div', { class: 'row' }, btn('', () => pv.reload(), { cls: 'sm icon', ic: 'refresh', title: tr('Frissítés') }), btn('', () => window.open(`/player/?preview=playlist:${p.id}`, '_blank'), { cls: 'sm icon', ic: 'external', title: tr('Megnyitás új lapon') }))),
          pv.el,
          h('div', { class: 'small muted' }, tr('Az előnézet a mentett állapotot mutatja. Tipp: Ctrl/Cmd+S a gyors mentéshez, a sorokat húzással rendezheted.')))),
    );
  }

  function pickSlides(slides, { multiple = true } = {}) {
    return new Promise((resolve) => {
      const sel = [];
      let result = null;
      const grid = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' } });
      const search = h('input', { class: 'input', placeholder: tr('Keresés…'), style: { maxWidth: '260px' } });
      const count = h('span', { class: 'small muted' });
      const draw = () => {
        const q = search.value.toLowerCase();
        grid.replaceChildren(...slides.filter((s) => !q || s.name.toLowerCase().includes(q)).map((s) => {
          const n = sel.indexOf(s.id);
          return h('div', { class: 'card slide-card', style: n >= 0 ? { outline: '3px solid var(--primary)' } : {}, onclick: () => {
            if (!multiple) { result = [s.id]; m.close(); return; }
            if (n >= 0) sel.splice(n, 1); else sel.push(s.id);
            draw();
          } }, slideThumb(s, h('div', { class: 'thumb' })), n >= 0 ? h('span', { class: 'badge orange', style: { position: 'absolute', margin: '-28px 0 0 8px' } }, n + 1) : null,
          h('div', { class: 'body' }, h('h4', {}, s.name), h('div', { class: 'small muted' }, TYPES[s.type]?.name)));
        }));
        count.textContent = tr('{n} kiválasztva', { n: sel.length });
      };
      search.addEventListener('input', draw);
      const m = modal({
        title: tr('Tartalom kiválasztása'), size: 'wide',
        body: h('div', { class: 'stack' }, search, slides.length ? grid : h('div', { class: 'empty' }, tr('Még nincs tartalom. Hozz létre egyet a Tartalmak menüben.'))),
        foot: multiple ? [count, h('span', { class: 'grow' }), btn(tr('Mégse'), () => m.close()), btn(tr('Hozzáadás'), () => { result = sel; m.close(); }, { cls: 'primary' })] : null,
        onClose: () => resolve(result),
      });
      draw();
    });
  }

  // =====================================================================
  //  Tartalmak (diák)
  // =====================================================================
  function newSlideDialog() {
    const m = modal({
      title: tr('Új tartalom – válassz típust'), size: 'wide',
      body: h('div', { class: 'type-grid' }, Object.entries(TYPES).map(([k, t]) => h('button', { class: 'type-tile', type: 'button', onclick: async () => {
        try {
          const s = await POST('/api/slides', { name: tr('Új {type}', { type: t.name.toLowerCase() }), type: k, duration: t.duration, data: clone(t.defaults) });
          invalidate('slides');
          m.close();
          location.hash = `#/slides/${s.id}`;
        } catch (e) { fail(e); }
      } }, h('span', { class: 'e' }, t.e), h('b', {}, t.name), h('span', {}, t.desc)))),
    });
  }

  async function pageSlides(view, id) {
    if (id) return pageSlideEdit(view, +id);
    const [slides] = await Promise.all([load('slides', true), load('media')]);
    let filter = '';
    let q = '';
    const grid = h('div', { class: 'grid auto' });
    const draw = () => {
      const list = slides.filter((s) => (!filter || s.type === filter) && (!q || s.name.toLowerCase().includes(q)));
      grid.replaceChildren(...(list.length ? list.map((s) => h('div', { class: 'card slide-card', onclick: () => { location.hash = `#/slides/${s.id}`; } },
        slideThumb(s, h('div', { class: 'thumb' })),
        h('div', { class: 'body' }, h('h4', {}, s.name),
          h('div', { class: 'row between small muted', style: { marginTop: '4px' } }, h('span', {}, `${TYPES[s.type]?.e} ${TYPES[s.type]?.name}`), h('span', {}, slideDuration(s) ? fmtDur(slideDuration(s)) : 'auto')))))
        : [h('div', { class: 'card', style: { gridColumn: '1/-1' } }, h('div', { class: 'empty' }, h('div', { class: 'big' }, '✨'), h('h3', {}, tr('Nincs találat')), h('p', {}, tr('Hozz létre új tartalmat!')), btn(tr('Új tartalom'), newSlideDialog, { cls: 'primary', ic: 'plus' })))]));
    };
    const types = [...new Set(slides.map((s) => s.type))];
    const segBox = h('div', { class: 'seg' });
    const drawSeg = () => segBox.replaceChildren(...[['', tr('Mind')], ...types.map((t) => [t, `${TYPES[t]?.e} ${TYPES[t]?.name}`])].map(([v, l]) => h('button', { class: filter === v ? 'on' : '', onclick: () => { filter = v; drawSeg(); draw(); } }, l)));
    drawSeg();
    const search = h('input', { class: 'input', placeholder: tr('Keresés…'), style: { maxWidth: '240px' }, oninput: (e) => { q = e.target.value.toLowerCase(); draw(); } });
    draw();
    view.replaceChildren(
      head(tr('Tartalmak'), tr('Képváltók, hirdetmények, interaktív menük, űrlapok és minden más, ami a képernyőn megjelenik.'), [btn(tr('Új tartalom'), newSlideDialog, { ic: 'plus', cls: 'primary' })]),
      h('div', { class: 'row', style: { marginBottom: '16px' } }, search, types.length > 1 ? segBox : null),
      grid);
  }

  async function pageSlideEdit(view, id) {
    const [s, slides, forms, cals] = await Promise.all([GET(`/api/slides/${id}`), load('slides', true), load('forms', true), load('calendars', true), load('media', true)]);
    const t = TYPES[s.type] || { name: s.type, e: '❓' };
    const d = s.data = { ...clone(t.defaults || {}), ...s.data };
    let orig = JSON.stringify(s);
    dirty = () => JSON.stringify(s) !== orig;
    const pv = previewFrame(`/player/?preview=slide:${s.id}`);
    const usage = h('div', { class: 'small muted' });
    GET(`/api/slides/${s.id}/usage`).then((u) => usage.replaceChildren(...(u.length ? [tr('Szerepel: '), ...u.flatMap((p, i) => [i ? ', ' : '', h('a', { href: `#/playlists/${p.id}` }, p.name)])] : [tr('Még egyik lejátszási listában sem szerepel.')]))).catch(() => {});

    const save = async () => {
      try {
        await PUT(`/api/slides/${s.id}`, s);
        orig = JSON.stringify(s);
        invalidate('slides');
        toast(tr('Mentve'));
        setTimeout(() => pv.reload(), 250);
      } catch (e) { fail(e); }
    };
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); } };
    document.addEventListener('keydown', onKey);
    onLeave(() => document.removeEventListener('keydown', onKey));
    const autoPreview = debounce(() => { if (dirty()) save(); }, 1500);
    let auto = true;
    const ch = () => { if (auto) autoPreview(); };

    const editor = slideEditor(s.type, d, { slides, forms, cals, onchange: ch, self: s.id, rerender: () => route() });
    const addToPlaylist = async () => {
      const pls = await load('playlists', true);
      if (!pls.length) return toast(tr('Előbb hozz létre egy lejátszási listát'), 'err');
      const data = { pid: pls[0].id };
      const m = modal({
        title: tr('Hozzáadás lejátszási listához'),
        body: F.select(tr('Lejátszási lista'), data, 'pid', pls.map((p) => [p.id, p.name]), { number: true }),
        foot: [btn(tr('Mégse'), () => m.close()), btn(tr('Hozzáadás'), async () => {
          const p = pls.find((x) => x.id === data.pid);
          p.items.push({ slide_id: s.id });
          await PUT(`/api/playlists/${p.id}`, p);
          toast(tr('Hozzáadva: {name}', { name: p.name })); m.close(); route();
        }, { cls: 'primary' })],
      });
    };

    view.replaceChildren(
      head(`${t.e} ${s.name}`, t.desc, [
        btn(tr('Arculat szerint'), async () => {
          if (!(await confirmBox(tr('A tartalom egyedi színei (háttér, szöveg, kártya- és gombszínek) az arculat színeire cserélődnek. Folytatod?'), { ok: tr('Átszínezés'), danger: false }))) return;
          s.data = brandifyData(s.type, s.data);
          await save();
          route();
        }, { ic: 'palette', title: tr('Az egyedi színek helyett az arculat színeit használja') }),
        btn(tr('Másolat'), async () => { const c = await POST(`/api/slides/${s.id}/duplicate`); invalidate('slides'); location.hash = `#/slides/${c.id}`; }, { ic: 'copy' }),
        btn(tr('Törlés'), async () => {
          if (!(await confirmBox(tr('Biztosan törlöd a(z) „{name}” tartalmat? A lejátszási listákból is eltűnik.', { name: s.name }), { ok: tr('Törlés') }))) return;
          await DEL(`/api/slides/${s.id}`); dirty = null; invalidate('slides'); toast(tr('Tartalom törölve')); location.hash = '#/slides';
        }, { cls: 'danger', ic: 'trash' }),
        btn(tr('Mentés'), save, { cls: 'primary', ic: 'save' })], [h('a', { href: '#/slides' }, tr('Tartalmak')), ' / ']),
      h('div', { class: 'split' },
        h('div', { class: 'stack' },
          h('div', { class: 'card card-pad fields' },
            F.text(tr('Megnevezés'), s, 'name', { full: true, onchange: ch }),
            F.number(tr('Megjelenési idő (mp)'), s, 'duration', { min: 0, hint: s.type === 'video' ? tr('0 = a videó végéig') : s.type === 'image' ? tr('0 = képek száma × váltási idő') : tr('0 = alapértelmezett'), onchange: ch }),
            F.select(tr('Átmenet'), d, 'transition', [['', tr('A lista szerint')], ...TRANSITIONS], { onchange: ch })),
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Tartalom beállításai'))), h('div', { class: 'card-body' }, editor))),
        h('div', { class: 'preview-box stack' },
          h('div', { class: 'row between' }, h('b', {}, tr('Előnézet')),
            h('div', { class: 'row' }, F.toggle(tr('Automatikus mentés'), { a: auto }, 'a', { onchange: (v) => { auto = v; } }),
              btn('', () => pv.reload(), { cls: 'sm icon', ic: 'refresh', title: tr('Frissítés') }),
              btn('', () => window.open(`/player/?preview=slide:${s.id}`, '_blank'), { cls: 'sm icon', ic: 'external', title: tr('Teljes képernyő új lapon') }))),
          pv.el,
          h('div', { class: 'row between' }, usage, btn(tr('Listához adás'), addToPlaylist, { cls: 'sm', ic: 'playlist' })))),
    );
  }

  // Típusonkénti szerkesztő űrlapok
  function slideEditor(type, d, ctx) {
    const { onchange: ch, slides, forms, cals } = ctx;
    const f = (...x) => h('div', { class: 'fields' }, ...x);
    switch (type) {
      case 'image': return f(
        F.media(tr('Képek / videók (sorrendben)'), d, 'media_ids', { multiple: true, accept: 'image/,video/', captions: true, onchange: ch }),
        F.number(tr('Váltási idő képenként (mp)'), d, 'interval', { min: 2, max: 600, onchange: ch }),
        F.select(tr('Effekt'), d, 'effect', [['fade', tr('Áttűnés')], ['slide', tr('Csúsztatás')], ['kenburns', tr('Ken Burns (lassú zoom)')]], { onchange: ch }),
        F.select(tr('Kitöltés'), d, 'fit', [['cover', tr('Kitöltés (vágással)')], ['contain', tr('Teljes kép (keretezve)')]], { onchange: ch }),
        F.toggle(tr('Elmosott háttér (teljes kép módban)'), d, 'blur_bg', { defaultOn: true, onchange: ch }),
        F.toggle(tr('Lapozó pöttyök'), d, 'show_dots', { onchange: ch }),
        F.toggle(tr('Egyszer menjen végig, utána következő tartalom'), d, 'once', { full: true, onchange: ch }));
      case 'video': return f(
        F.media(tr('Videó'), d, 'media_id', { accept: 'video/', onchange: ch }),
        F.select(tr('Kitöltés'), d, 'fit', [['contain', tr('Teljes kép')], ['cover', tr('Kitöltés (vágással)')]], { onchange: ch }),
        F.toggle(tr('Némítva'), d, 'muted', { defaultOn: true, onchange: ch, hint: tr('Hang csak telepített lejátszón garantált') }),
        F.toggle(tr('Ismétlés a megadott ideig'), d, 'loop', { onchange: ch }));
      case 'text': return f(
        F.text(tr('Felirat (kicsi, a cím fölött)'), d, 'kicker', { full: true, onchange: ch }),
        F.text(tr('Cím'), d, 'title', { full: true, onchange: ch }),
        F.textarea(tr('Szöveg'), d, 'body', { rows: 5, onchange: ch }),
        F.seg(tr('Igazítás'), d, 'align', [['left', tr('Balra')], ['center', tr('Középre')], ['right', tr('Jobbra')]], { def: 'left', onchange: ch }),
        F.number(tr('Betűméret (%)'), d, 'font_scale', { min: 40, max: 250, step: 5, onchange: ch }),
        F.bg(tr('Háttér'), d, 'bg', { full: true, onchange: ch }),
        F.color(tr('Szövegszín (üres = téma)'), d, 'color', { def: '#ffffff', onchange: ch }),
        F.toggle(tr('Logó megjelenítése'), d, 'show_logo', { onchange: ch }),
        F.media(tr('Háttérkép vagy -videó'), d, 'bg_media_id', { accept: 'image/,video/', onchange: ch }),
        F.toggle(tr('Sötétítés a háttérképen'), d, 'shade', { defaultOn: true, onchange: ch }));
      case 'cards': return f(
        F.text(tr('Cím'), d, 'title', { onchange: ch }), F.text(tr('Alcím'), d, 'subtitle', { onchange: ch }),
        F.number(tr('Oszlopok'), d, 'columns', { min: 1, max: 6, onchange: ch }),
        F.bg(tr('Háttér'), d, 'bg', { onchange: ch }),
        subList(tr('Kártyák'), d, 'cards', (c) => [
          h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, F.text(tr('Ikon'), c, 'icon', { onchange: ch, placeholder: '⭐' }), h('div', { class: 'grow' }, F.text(tr('Cím'), c, 'title', { onchange: ch }))),
          F.textarea(tr('Szöveg'), c, 'text', { rows: 2, onchange: ch }),
          h('div', { class: 'fields' }, F.text(tr('Címke (jobb felső sarok)'), c, 'badge', { onchange: ch, placeholder: tr('pl. ÚJ') }), F.slideRef(tr('Érintésre megnyitja'), c, 'target_slide', slides, { onchange: ch, exclude: ctx.self }),
            F.color(tr('Háttérszín (üres = téma)'), c, 'color', { def: '#2a1d14', onchange: ch }), F.color(tr('Szövegszín (üres = téma)'), c, 'text_color', { def: '#ffffff', onchange: ch })),
          F.media(tr('Kép'), c, 'media_id', { accept: 'image/', onchange: ch }),
        ], () => ({ icon: '⭐', title: tr('Új kártya'), text: '' }), ch));
      case 'menu': return f(
        F.text(tr('Cím'), d, 'title', { onchange: ch }), F.text(tr('Alcím'), d, 'subtitle', { onchange: ch }),
        F.number(tr('Oszlopok'), d, 'columns', { min: 1, max: 6, onchange: ch }),
        F.text(tr('Tipp szöveg alul'), d, 'hint', { placeholder: tr('👆 Érintsd meg a képernyőt'), onchange: ch }),
        F.bg(tr('Háttér'), d, 'bg', { onchange: ch }),
        F.media(tr('Háttérkép'), d, 'bg_media_id', { accept: 'image/', onchange: ch }),
        h('div', { class: 'full small muted', style: { background: 'var(--primary-softer)', padding: '10px 12px', borderRadius: '10px' } }, tr('💡 Minden gombhoz rendelj egy másik tartalmat (pl. térkép kép, naptár, űrlap). Érintéskor a lejátszó megnyitja, és a megadott tétlenségi idő után visszatér a normál lejátszáshoz. Vissza és Kezdőlap gomb automatikusan megjelenik.')),
        subList(tr('Gombok'), d, 'buttons', (b) => [
          h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, F.text(tr('Ikon'), b, 'icon', { onchange: ch }), h('div', { class: 'grow' }, F.text(tr('Felirat'), b, 'label', { onchange: ch }))),
          h('div', { class: 'fields' }, F.text(tr('Alfelirat'), b, 'sub', { onchange: ch }), F.slideRef(tr('Érintésre megnyitja'), b, 'target_slide', slides, { onchange: ch, exclude: ctx.self }),
            F.color(tr('Gomb színe (üres = téma)'), b, 'color', { def: '#f59e5b', onchange: ch }), F.color(tr('Szöveg színe (üres = téma)'), b, 'text_color', { def: '#3b1a05', onchange: ch })),
          F.media(tr('Háttérkép a gombon'), b, 'media_id', { accept: 'image/', onchange: ch }),
        ], () => ({ icon: '✨', label: tr('Új gomb') }), ch));
      case 'zones': return zonesEditor(d, ctx);
      case 'form': return f(
        forms.length ? F.select(tr('Űrlap'), d, 'form_id', [['', tr('— válassz —')], ...forms.map((x) => [x.id, x.name])], { number: true, full: true, onchange: ch })
          : h('div', { class: 'full' }, tr('Még nincs űrlap. '), h('a', { href: '#/forms' }, tr('Hozz létre egyet az Űrlapok menüben →'))),
        d.form_id ? h('div', { class: 'full' }, h('a', { href: `#/forms/${d.form_id}` }, tr('Űrlap mezőinek szerkesztése →'))) : null,
        h('div', { class: 'full small muted' }, tr('Érintőképernyőn virtuális billentyűzet jelenik meg. A beküldött adatok az Űrlapok menüben láthatók és CSV-be exportálhatók.')));
      case 'calendar': return f(
        F.text(tr('Cím'), d, 'title', { full: true, onchange: ch }),
        cals.length ? F.wrap(tr('Naptárak'), h('div', { class: 'row' }, cals.map((c) => {
          const cb = h('input', { type: 'checkbox', checked: (d.calendar_ids || []).includes(c.id), onchange: () => {
            const set = new Set(d.calendar_ids || []); cb.checked ? set.add(c.id) : set.delete(c.id); d.calendar_ids = [...set]; ch();
          } });
          return h('label', { class: 'check' }, cb, h('span', { class: 'color-dot', style: { background: themeCss(c.color || 'var(--accent)') } }), c.name);
        })), { full: true }) : h('div', { class: 'full' }, tr('Még nincs naptár. '), h('a', { href: '#/calendars' }, tr('Hozz létre egyet →'))),
        F.seg(tr('Nézet'), d, 'view', [['list', tr('Lista')], ['week', tr('Hét')], ['month', tr('Hónap')]], { def: 'list', onchange: ch }),
        F.number(tr('Előretekintés (nap)'), d, 'days_ahead', { min: 1, max: 365, onchange: ch }),
        F.number(tr('Max. események (lista)'), d, 'max_items', { min: 1, max: 20, onchange: ch }),
        F.bg(tr('Háttér'), d, 'bg', { full: true, onchange: ch }));
      case 'clock': return f(
        F.seg(tr('Stílus'), d, 'style', [['digital', tr('Digitális')], ['analog', tr('Analóg')]], { def: 'digital', onchange: ch }),
        F.text(tr('Kiegészítő szöveg'), d, 'title', { placeholder: tr('pl. Jó reggelt!'), onchange: ch }),
        F.toggle(tr('Másodpercek'), d, 'show_seconds', { onchange: ch }),
        F.toggle(tr('Dátum'), d, 'show_date', { defaultOn: true, onchange: ch }),
        F.toggle(tr('Időjárás'), d, 'show_weather', { defaultOn: true, onchange: ch }),
        F.toggle(tr('5 napos előrejelzés'), d, 'show_forecast', { defaultOn: true, onchange: ch }),
        cityPicker(d, ch),
        F.bg(tr('Háttér'), d, 'bg', { full: true, onchange: ch }));
      case 'rss': {
        const test = h('div', { class: 'small muted full' });
        return f(
          F.text(tr('Hírfolyam URL (RSS/Atom)'), d, 'url', { full: true, onchange: ch, hint: tr('Pl. https://telex.hu/rss, https://index.hu/24ora/rss/, https://hvg.hu/rss') }),
          h('div', { class: 'full' }, btn(tr('Kapcsolat tesztelése'), async () => {
            test.textContent = tr('Lekérdezés…');
            try { const r = await GET(`/api/rss-test?url=${encodeURIComponent(d.url)}`); test.textContent = '✓ ' + tr('{title}: {n} hír, pl. „{first}”', { title: r.title || tr('Hírfolyam'), n: r.items.length, first: r.items[0]?.title || '-' }); } catch (e) { test.textContent = '✗ ' + e.message; }
          }, { cls: 'sm' })), test,
          F.text(tr('Cím (üresen a forrás neve)'), d, 'title', { onchange: ch }),
          F.number(tr('Hírek száma'), d, 'max', { min: 1, max: 20, onchange: ch }),
          F.number(tr('Idő hírenként (mp)'), d, 'per_item', { min: 4, max: 60, onchange: ch }),
          F.toggle(tr('Képek megjelenítése'), d, 'show_images', { defaultOn: true, onchange: ch }),
          F.bg(tr('Háttér'), d, 'bg', { full: true, onchange: ch }));
      }
      case 'countdown': return f(
        F.text(tr('Cím'), d, 'title', { full: true, onchange: ch }),
        F.text(tr('Céldátum és idő'), d, 'target', { type: 'datetime-local', onchange: ch }),
        F.text(tr('Szöveg a lejárat után'), d, 'done_text', { onchange: ch }),
        F.text(tr('Alcím'), d, 'subtitle', { full: true, onchange: ch }),
        F.bg(tr('Háttér'), d, 'bg', { full: true, onchange: ch }));
      case 'qr': return f(
        F.text(tr('Link / szöveg a QR kódban'), d, 'url', { full: true, onchange: ch, hint: tr('Wi-Fi-hez: WIFI:T:WPA;S:HálózatNév;P:Jelszó;;') }),
        F.text(tr('Cím'), d, 'title', { full: true, onchange: ch }),
        F.textarea(tr('Leírás'), d, 'text', { rows: 3, onchange: ch }),
        F.toggle(tr('Link kiírása'), d, 'show_url', { defaultOn: true, onchange: ch }),
        F.bg(tr('Háttér'), d, 'bg', { full: true, onchange: ch }));
      case 'web': return f(
        F.text(tr('Weboldal címe'), d, 'url', { full: true, onchange: ch, hint: tr('Egyes oldalak (pl. Google, Facebook) tiltják a beágyazást.') }),
        F.number(tr('Nagyítás (%)'), d, 'zoom', { min: 25, max: 400, step: 5, onchange: ch }),
        F.number(tr('Újratöltés (mp, 0 = soha)'), d, 'reload_sec', { min: 0, onchange: ch }),
        F.toggle(tr('Interaktív (érinthető, görgethető)'), d, 'interactive', { full: true, onchange: ch }));
      case 'pdf': return f(
        F.media(tr('PDF fájl'), d, 'media_id', { accept: 'application/pdf', onchange: ch }),
        F.number(tr('Oldal'), d, 'page', { min: 1, onchange: ch }));
      case 'html': return f(
        F.textarea(tr('HTML kód'), d, 'html', { code: true, rows: 14, onchange: ch, hint: tr('Elszigetelt keretben fut (sandbox). Külső scripteket és API-kat is használhatsz.') }));
      default: return h('div', {}, tr('Ehhez a típushoz nincs szerkesztő.'));
    }
  }

  // Osztott képernyő: elrendezés választó (kis rajzzal) és zónánként a lejátszandó tartalmak
  function zonesEditor(d, ctx) {
    const Z = SIGNAGE_ZONES, ch = ctx.onchange;
    const pick = ctx.slides.filter((x) => x.type !== 'zones' && x.id !== ctx.self);
    const zonesBox = h('div', { class: 'full stack', style: { gap: '12px' } });
    const sizeBox = h('div');
    const layouts = h('div', { class: 'zone-layouts' });
    const drawLayouts = () => layouts.replaceChildren(...Object.entries(Z.LAYOUTS).map(([k, L]) => {
      const mini = h('div', { class: 'zl-mini' }, L.zones.map((_, i) => h('i', { style: { gridArea: Z.AREAS[i] } }, String(i + 1))));
      Object.assign(mini.style, Z.gridStyle(k, d.size));
      return h('button', { type: 'button', class: `zl${(d.layout || 'right') === k ? ' on' : ''}`, title: tr(L.name), onclick: () => { d.layout = k; drawLayouts(); draw(); ch(); } }, mini, h('span', {}, tr(L.name)));
    }));
    const draw = () => {
      const L = Z.LAYOUTS[d.layout] || Z.LAYOUTS.right;
      d.zones ||= [];
      while (d.zones.length < L.zones.length) d.zones.push({ items: [] });
      sizeBox.replaceChildren(L.sized ? F.number(tr('Mellékzóna mérete (%)'), d, 'size', { min: 15, max: 50, onchange: () => { drawLayouts(); ch(); }, hint: tr('15–50%; az oldalsáv vagy a sáv mérete') }) : null);
      zonesBox.replaceChildren(...L.zones.map((zname, i) => {
        const z = d.zones[i];
        z.transition ||= 'fade';
        return h('div', { class: 'sub-item' },
          h('div', { class: 'sub-head' }, h('b', {}, `${i + 1}. ${tr(zname)}`)),
          h('div', { class: 'stack', style: { gap: '10px' } },
            F.select(tr('Áttűnés a zónán belül'), z, 'transition', TRANSITIONS, { onchange: ch }),
            subList(tr('Tartalmak (sorban váltakoznak)'), z, 'items', (it) => [
              F.select(tr('Tartalom'), it, 'slide_id', [['', tr('— válassz —')], ...pick.map((x) => [x.id, `${TYPES[x.type]?.e || ''} ${x.name}`])], { number: true, onchange: ch }),
            ], () => ({ slide_id: null }), ch)));
      }));
    };
    drawLayouts(); draw();
    return h('div', { class: 'fields' },
      F.wrap(tr('Elrendezés'), layouts, { full: true }),
      sizeBox,
      F.toggle(tr('Rés a zónák között'), d, 'gap', { onchange: ch }),
      h('div', { class: 'full small muted', style: { background: 'var(--primary-softer)', padding: '10px 12px', borderRadius: '10px' } }, tr('💡 Minden zónába tegyél egy vagy több meglévő tartalmat – a zónán belül a saját megjelenési idejük szerint váltakoznak. Például: fő területen képváltó, oldalsávon óra és időjárás, alul hírfolyam.')),
      zonesBox);
  }

  function subList(label, obj, key, fields, make, ch) {
    obj[key] ||= [];
    const box = h('div', { class: 'full' });
    const draw = () => {
      box.replaceChildren(h('div', { class: 'label', style: { marginBottom: '8px' } }, label),
        ...obj[key].map((it, i) => h('div', { class: 'sub-item' },
          h('div', { class: 'sub-head' }, h('b', {}, `${i + 1}. ${it.title || it.label || ''}`),
            i > 0 ? btn('', () => { [obj[key][i - 1], obj[key][i]] = [obj[key][i], obj[key][i - 1]]; draw(); ch(); }, { cls: 'sm icon ghost', ic: 'prev', title: tr('Előre') }) : null,
            btn('', () => { obj[key].splice(i + 1, 0, clone(it)); draw(); ch(); }, { cls: 'sm icon ghost', ic: 'copy', title: tr('Másolás') }),
            btn('', () => { obj[key].splice(i, 1); draw(); ch(); }, { cls: 'sm icon ghost', ic: 'trash', title: tr('Törlés') })),
          h('div', { class: 'stack', style: { gap: '10px' } }, fields(it)))),
        btn(tr('Új elem'), () => { obj[key].push(make()); draw(); ch(); }, { ic: 'plus', cls: 'sm' }));
    };
    draw();
    return box;
  }

  function cityPicker(d, ch) {
    const out = h('div', { class: 'stack', style: { gap: '6px' } });
    const q = h('input', { class: 'input', value: d.city || '', placeholder: tr('Település keresése (pl. Debrecen)') });
    const res = h('div', { class: 'row' });
    const search = debounce(async () => {
      if (q.value.length < 2) return;
      try {
        const r = await GET(`/api/geocode?q=${encodeURIComponent(q.value)}`);
        res.replaceChildren(...r.map((c) => btn(`${c.name}${c.admin ? ', ' + c.admin : ''} (${c.country})`, () => {
          d.city = c.name; d.lat = c.lat; d.lon = c.lon; q.value = c.name; res.replaceChildren(h('span', { class: 'small muted' }, `✓ ${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}`)); ch();
        }, { cls: 'sm' })));
      } catch (e) { res.replaceChildren(h('span', { class: 'small', style: { color: 'var(--danger)' } }, e.message)); }
    }, 400);
    q.addEventListener('input', search);
    out.append(q, res);
    if (d.lat != null) res.append(h('span', { class: 'small muted' }, tr('Jelenleg: {city}', { city: d.city || '' }) + ` (${(+d.lat).toFixed(3)}, ${(+d.lon).toFixed(3)})`));
    return F.wrap(tr('Helyszín (időjáráshoz)'), out, { full: true });
  }

  // =====================================================================
  //  Médiatár
  // =====================================================================
  async function pageMedia(view) {
    const media = await load('media', true);
    let filter = '';
    const grid = h('div', { class: 'media-grid' });
    const total = h('span', { class: 'badge orange' });
    const draw = () => {
      const list = cache.media.filter((m) => !filter || m.mime.startsWith(filter));
      total.textContent = tr('{n} fájl · {size}', { n: cache.media.length, size: fmtBytes(cache.media.reduce((a, m) => a + m.size, 0)) });
      grid.replaceChildren(...(list.length ? list.map((m) => mediaTile(m, { onclick: () => mediaDetail(m, draw) })) : [h('div', { class: 'empty', style: { gridColumn: '1/-1' } }, tr('Nincs fájl'))]));
    };
    const seg = h('div', { class: 'seg' });
    const drawSeg = () => seg.replaceChildren(...[['', tr('Mind')], ['image/', tr('Képek')], ['video/', tr('Videók')], ['application/pdf', 'PDF']].map(([v, l]) => h('button', { class: filter === v ? 'on' : '', onclick: () => { filter = v; drawSeg(); draw(); } }, l)));
    drawSeg();
    draw();
    void media;
    view.replaceChildren(
      head(tr('Médiatár'), tr('Képek, videók és dokumentumok a tartalmakhoz.'), [total]),
      dropzone(() => draw()),
      h('div', { class: 'row', style: { margin: '18px 0 14px' } }, seg),
      grid);
  }

  function mediaDetail(m, redraw) {
    const data = { name: m.name };
    const isImg = m.mime.startsWith('image/'), isVid = m.mime.startsWith('video/');
    const md = modal({
      title: m.name, size: 'wide',
      body: h('div', { class: 'stack' },
        isImg ? h('img', { src: m.url, style: { maxWidth: '100%', maxHeight: '55vh', borderRadius: '10px', alignSelf: 'center' } })
          : isVid ? h('video', { src: m.url, controls: true, style: { maxWidth: '100%', maxHeight: '55vh', borderRadius: '10px' } })
            : h('iframe', { src: m.url, style: { width: '100%', height: '55vh', border: 0 } }),
        h('div', { class: 'fields' }, F.text(tr('Név'), data, 'name'), F.wrap(tr('Adatok'), h('div', { class: 'small muted' }, `${m.mime} · ${fmtBytes(m.size)} · ${fmtDate(m.created_at)}`))),
        h('div', { class: 'small' }, tr('Közvetlen link: '), h('a', { href: m.url, target: '_blank' }, location.origin + m.url))),
      foot: [
        btn(tr('Törlés'), async () => {
          if (!(await confirmBox(tr('Biztosan törlöd: „{name}”? A tartalmakból is eltűnik.', { name: m.name }), { ok: tr('Törlés') }))) return;
          await DEL(`/api/media/${m.id}`); cache.media = cache.media.filter((x) => x.id !== m.id); md.close(); redraw(); toast(tr('Fájl törölve'));
        }, { cls: 'danger', ic: 'trash' }),
        h('span', { class: 'grow' }),
        btn(tr('Mégse'), () => md.close()),
        btn(tr('Mentés'), async () => { await PUT(`/api/media/${m.id}`, data); m.name = data.name; md.close(); redraw(); toast(tr('Mentve')); }, { cls: 'primary' })],
    });
  }

  // =====================================================================
  //  Naptárak
  // =====================================================================
  async function pageCalendars(view, id) {
    const cals = await load('calendars', true);
    const sel = cals.find((c) => c.id === +id) || cals[0];
    const createCal = async () => {
      const name = prompt(tr('Új naptár neve:'), tr('Események'));
      if (!name) return;
      const c = await POST('/api/calendars', { name, color: 'var(--accent)' });
      location.hash = `#/calendars/${c.id}`;
    };
    const side = h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h3', {}, tr('Naptárak')), btn('', createCal, { cls: 'sm icon primary', ic: 'plus', title: tr('Új naptár') })),
      cals.length ? cals.map((c) => h('a', { class: 'list-item', href: `#/calendars/${c.id}`, style: { color: 'inherit', textDecoration: 'none', background: sel?.id === c.id ? 'var(--primary-softer)' : null } },
        h('span', { class: 'color-dot', style: { background: themeCss(c.color || 'var(--accent)') } }), h('span', { class: 'grow' }, c.name), c.ical_url ? h('span', { class: 'badge blue' }, 'iCal') : null))
        : h('div', { class: 'empty small' }, tr('Még nincs naptár')));
    const main = h('div', { class: 'stack' });
    view.replaceChildren(head(tr('Naptárak'), tr('Saját események és külső (Google, Outlook) iCal naptárak megjelenítése.'), [btn(tr('Új naptár'), createCal, { ic: 'plus', cls: 'primary' })]),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: '20px', alignItems: 'start' }, class: 'cal-layout' }, side, main));
    if (!sel) {
      main.append(h('div', { class: 'card' }, h('div', { class: 'empty' }, h('div', { class: 'big' }, '📅'), h('h3', {}, tr('Hozd létre az első naptárad')), h('p', {}, tr('Utána egy „Naptár” típusú tartalommal jelenítheted meg a képernyőkön.')), btn(tr('Új naptár'), createCal, { cls: 'primary', ic: 'plus' }))));
      return;
    }
    const c = clone(sel);
    const events = await GET(`/api/events?calendar_id=${c.id}`);
    const evList = h('div');
    const drawEvents = () => {
      const now = Date.now() - 864e5;
      // ismétlődő esemény addig „közelgő”, amíg a sorozat tart
      const isUpcoming = (e) => Date.parse(e.end || e.start) >= now || (e.rrule && !(/UNTIL=(\d{8})/.exec(e.rrule)?.[1] < new Date(now).toISOString().slice(0, 10).replace(/-/g, '')));
      const upcoming = events.filter(isUpcoming);
      const past = events.filter((e) => !isUpcoming(e));
      const row = (e) => {
        const st = new Date(e.start.length === 10 ? e.start + 'T00:00' : e.start);
        return h('div', { class: 'cal-ev-row' },
          h('div', { class: 'date' }, h('b', {}, st.getDate()), h('small', {}, st.toLocaleDateString(LOCALE, { month: 'short' }))),
          h('div', { class: 'grow' }, h('b', {}, e.title, e.rrule ? h('span', { class: 'muted', title: tr('Ismétlődő esemény') }, ' 🔁') : null),
            h('div', { class: 'small muted' }, e.all_day ? tr('Egész nap') : `${st.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })} – ${new Date(e.end).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}`, e.location ? ` · 📍 ${e.location}` : '')),
          btn('', () => eventDialog(c, e, events, drawEvents), { cls: 'sm icon ghost', ic: 'edit' }),
          btn('', async () => { if (!(await confirmBox(tr('Törlöd: „{name}”?', { name: e.title }), { ok: tr('Törlés') }))) return; await DEL(`/api/events/${e.id}`); events.splice(events.indexOf(e), 1); drawEvents(); }, { cls: 'sm icon ghost', ic: 'trash' }));
      };
      evList.replaceChildren(
        ...(upcoming.length ? upcoming.map(row) : [h('div', { class: 'empty small' }, tr('Nincs közelgő saját esemény'))]),
        past.length ? h('details', { style: { padding: '10px 16px' } }, h('summary', { class: 'small muted', style: { cursor: 'pointer' } }, tr('Korábbi események ({n})', { n: past.length })), past.reverse().map(row)) : null);
    };
    drawEvents();
    const icalInfo = h('div', { class: 'small muted' }, c.ical_url ? tr('{n} esemény importálva · utolsó frissítés: {t}', { n: (c.ical_cache || []).length, t: c.ical_fetched ? ago(c.ical_fetched) : tr('még nem') }) : tr('Google Naptár: Beállítások → Naptár integrálása → „Titkos cím iCal formátumban”.'));
    main.append(
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Naptár beállításai')),
        h('div', { class: 'row' },
          btn(tr('Törlés'), async () => { if (!(await confirmBox(tr('Törlöd a(z) „{name}” naptárat az összes eseményével?', { name: c.name }), { ok: tr('Törlés') }))) return; await DEL(`/api/calendars/${c.id}`); location.hash = '#/calendars'; route(); }, { cls: 'sm danger', ic: 'trash' }),
          btn(tr('Mentés'), async () => { await PUT(`/api/calendars/${c.id}`, c); toast(tr('Naptár mentve')); if (c.ical_url !== sel.ical_url) { await POST(`/api/calendars/${c.id}/refresh`); } route(); }, { cls: 'sm primary', ic: 'save' }))),
        h('div', { class: 'card-body fields' },
          F.text(tr('Név'), c, 'name'), F.color(tr('Szín'), c, 'color', { full: true, clearable: false, hint: tr('A naptár eseményei ezzel a színnel jelennek meg. Téma szerinti szín választásakor témaváltáskor vele együtt változik.') }),
          F.text(tr('Külső iCal URL (opcionális)'), c, 'ical_url', { full: true, placeholder: 'https://calendar.google.com/calendar/ical/…/basic.ics' }),
          h('div', { class: 'full row' }, icalInfo, c.ical_url ? btn(tr('Frissítés most'), async () => { try { const r = await POST(`/api/calendars/${c.id}/refresh`); toast(tr('{n} esemény importálva', { n: (r.ical_cache || []).length })); route(); } catch (e) { fail(e); } }, { cls: 'sm', ic: 'refresh' }) : null))),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Saját események')), btn(tr('Új esemény'), () => eventDialog(c, null, events, drawEvents), { cls: 'sm primary', ic: 'plus' })), evList),
      c.ical_url && (c.ical_cache || []).length ? h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Importált események (iCal)'))),
        h('div', {}, c.ical_cache.filter((e) => Date.parse(e.end || e.start) >= Date.now()).slice(0, 15).map((e) => h('div', { class: 'list-item' }, h('span', { class: 'small muted', style: { width: '130px' } }, fmtDate(e.start)), h('span', {}, e.title))))) : null);
  }

  function eventDialog(cal, ev, events, redraw) {
    const now = new Date(); now.setMinutes(0, 0, 0); now.setHours(now.getHours() + 1);
    const e = ev ? clone(ev) : { calendar_id: cal.id, title: '', location: '', description: '', all_day: 0, start: now.toISOString(), end: new Date(now.getTime() + 3600e3).toISOString() };
    const v = { start: e.all_day ? e.start.slice(0, 10) : toLocalInput(e.start), end: e.all_day ? e.end.slice(0, 10) : toLocalInput(e.end), all_day: !!e.all_day };
    // ismétlődés: FREQ=…;UNTIL=ÉÉÉÉHHNN formában tároljuk
    const rr = Object.fromEntries((e.rrule || '').split(';').filter(Boolean).map((p) => p.split('=')));
    const rv = { freq: rr.FREQ || '', until: rr.UNTIL ? `${rr.UNTIL.slice(0, 4)}-${rr.UNTIL.slice(4, 6)}-${rr.UNTIL.slice(6, 8)}` : '' };
    const times = h('div', { class: 'fields full' });
    const drawTimes = () => {
      const type = v.all_day ? 'date' : 'datetime-local';
      if (v.all_day) { v.start = v.start.slice(0, 10); v.end = v.end.slice(0, 10); } else if (v.start.length === 10) { v.start += 'T09:00'; v.end = v.end + 'T10:00'; }
      times.replaceChildren(F.text(tr('Kezdés'), v, 'start', { type }), F.text(tr('Befejezés'), v, 'end', { type }));
    };
    drawTimes();
    const m = modal({
      title: ev ? tr('Esemény szerkesztése') : tr('Új esemény'),
      body: h('div', { class: 'fields' },
        F.text(tr('Megnevezés'), e, 'title', { full: true }),
        F.toggle(tr('Egész napos'), v, 'all_day', { full: true, onchange: drawTimes }), times,
        F.select(tr('Ismétlődés'), rv, 'freq', [['', tr('Nem ismétlődik')], ['DAILY', tr('Naponta')], ['WEEKLY', tr('Hetente')], ['MONTHLY', tr('Havonta')], ['YEARLY', tr('Évente')]]),
        F.text(tr('Ismétlődés vége (opcionális)'), rv, 'until', { type: 'date' }),
        F.text(tr('Helyszín'), e, 'location', { full: true }),
        F.textarea(tr('Leírás'), e, 'description', { rows: 2 })),
      foot: [btn(tr('Mégse'), () => m.close()), btn(tr('Mentés'), async () => {
        if (!e.title) return toast(tr('Adj meg megnevezést'), 'err');
        e.all_day = v.all_day ? 1 : 0;
        e.start = v.all_day ? v.start : new Date(v.start).toISOString();
        e.end = v.all_day ? (v.end || v.start) : new Date(v.end || v.start).toISOString();
        if (e.end < e.start) return toast(tr('A befejezés nem lehet a kezdés előtt'), 'err');
        e.rrule = rv.freq ? `FREQ=${rv.freq}${rv.until ? `;UNTIL=${rv.until.replace(/-/g, '')}` : ''}` : '';
        try {
          const saved = ev ? await PUT(`/api/events/${e.id}`, e) : await POST('/api/events', e);
          if (ev) Object.assign(ev, saved); else events.push(saved);
          events.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
          redraw(); m.close(); toast(tr('Esemény mentve'));
        } catch (ex) { fail(ex); }
      }, { cls: 'primary' })],
    });
  }

  // =====================================================================
  //  Űrlapok
  // =====================================================================
  const FIELD_TYPES = [['text', tr('Rövid szöveg')], ['textarea', tr('Hosszú szöveg')], ['email', 'E-mail'], ['tel', tr('Telefonszám')], ['number', tr('Szám')], ['select', tr('Legördülő lista')], ['choice', tr('Választógombok')], ['checkbox', tr('Jelölőnégyzet')], ['rating', tr('Csillagos értékelés')], ['smiley', tr('Elégedettség (smiley)')]];
  const FORM_TEMPLATES = {
    feedback: { name: tr('Elégedettségi kérdőív'), title: tr('Mennyire volt elégedett?'), intro: tr('Véleménye segít nekünk fejlődni. Köszönjük!'), fields: [{ type: 'smiley', label: tr('Összességében'), required: true }, { type: 'choice', label: tr('Mit értékelt leginkább?'), options: [tr('Kiszolgálás'), tr('Gyorsaság'), tr('Tisztaság'), tr('Ár')] }, { type: 'textarea', label: tr('Megjegyzés') }], thanks_text: tr('Köszönjük a visszajelzést! 🧡') },
    contact: { name: tr('Kapcsolatfelvétel'), title: tr('Kérjen visszahívást!'), intro: tr('Kollégánk hamarosan felveszi Önnel a kapcsolatot.'), fields: [{ type: 'text', label: tr('Név'), required: true }, { type: 'tel', label: tr('Telefonszám'), required: true }, { type: 'email', label: 'E-mail' }, { type: 'select', label: tr('Téma'), options: [tr('Általános'), tr('Árajánlat'), tr('Panasz'), tr('Egyéb')] }, { type: 'checkbox', label: tr('Hozzájárulok adataim kezeléséhez'), required: true }], thanks_text: tr('Köszönjük, hamarosan keresni fogjuk!') },
    guest: { name: tr('Vendégregisztráció'), title: tr('Üdvözöljük! Kérjük, regisztráljon.'), intro: '', fields: [{ type: 'text', label: tr('Teljes név'), required: true }, { type: 'text', label: tr('Cég') }, { type: 'text', label: tr('Kihez érkezett?'), required: true }, { type: 'checkbox', label: tr('Elfogadom a házirendet'), required: true }], thanks_text: tr('Köszönjük! Kollégánk értesítést kapott, kérjük, foglaljon helyet.') },
    blank: { name: tr('Új űrlap'), title: tr('Új űrlap'), intro: '', fields: [{ type: 'text', label: tr('Név'), required: true }] },
  };

  async function pageForms(view, id, sub) {
    const parts = location.hash.split('/');
    if (id || parts[2]) return pageFormEdit(view, +(id || parts[2]), parts[3] === 'subs' ? 'subs' : 'edit');
    void sub;
    const forms = await load('forms', true);
    const create = () => {
      const m = modal({
        title: tr('Új űrlap – válassz sablont'), size: 'wide',
        body: h('div', { class: 'type-grid' }, Object.entries({ feedback: '😊', contact: '📞', guest: '🛎️', blank: '📄' }).map(([k, e]) => h('button', { class: 'type-tile', onclick: async () => {
          const f = await POST('/api/forms', { submit_text: tr('Küldés'), thanks_text: tr('Köszönjük!'), ...clone(FORM_TEMPLATES[k]) }); m.close(); location.hash = `#/forms/${f.id}`;
        } }, h('span', { class: 'e' }, e), h('b', {}, FORM_TEMPLATES[k].name), h('span', {}, tr('{n} mező', { n: FORM_TEMPLATES[k].fields.length }))))),
      });
    };
    const counts = await Promise.all(forms.map((f) => GET(`/api/forms/${f.id}/submissions`).then((s) => s.length).catch(() => 0)));
    view.replaceChildren(
      head(tr('Űrlapok'), tr('Érintőképernyős kérdőívek, regisztrációk, visszajelzések.'), [btn(tr('Új űrlap'), create, { cls: 'primary', ic: 'plus' })]),
      forms.length ? h('div', { class: 'card table-wrap' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, tr('Név')), h('th', {}, tr('Mezők')), h('th', {}, tr('Beküldések')), h('th', {}, tr('Módosítva')), h('th'))),
        h('tbody', {}, forms.map((f, i) => h('tr', { class: 'click', onclick: () => { location.hash = `#/forms/${f.id}`; } },
          h('td', {}, h('b', {}, f.name), h('div', { class: 'small muted' }, f.title)), h('td', {}, f.fields.length), h('td', {}, h('span', { class: `badge ${counts[i] ? 'orange' : ''}` }, counts[i])), h('td', { class: 'muted small' }, ago(f.updated_at)),
          h('td', { style: { textAlign: 'right' } }, btn(tr('Beküldések'), (e) => { e.stopPropagation(); location.hash = `#/forms/${f.id}/subs`; }, { cls: 'sm' })))))))
        : h('div', { class: 'card' }, h('div', { class: 'empty' }, h('div', { class: 'big' }, '📋'), h('h3', {}, tr('Még nincs űrlap')), h('p', {}, tr('Kezdd egy sablonnal: elégedettségi kérdőív, vendégregisztráció, visszahívás kérés.')), btn(tr('Új űrlap'), create, { cls: 'primary', ic: 'plus' }))));
  }

  async function pageFormEdit(view, id, tab) {
    const f = await GET(`/api/forms/${id}`);
    let orig = JSON.stringify(f);
    dirty = () => JSON.stringify(f) !== orig;
    const subs = await GET(`/api/forms/${id}/submissions`);
    const content = h('div');
    const save = async () => {
      try { const r = await PUT(`/api/forms/${f.id}`, f); f.fields = r.fields; orig = JSON.stringify(f); toast(tr('Űrlap mentve')); } catch (e) { fail(e); }
    };
    const tabs = h('div', { class: 'tabs' });
    const drawTabs = () => tabs.replaceChildren(
      h('button', { class: tab === 'edit' ? 'on' : '', onclick: () => { tab = 'edit'; drawTabs(); draw(); } }, tr('Szerkesztő')),
      h('button', { class: tab === 'subs' ? 'on' : '', onclick: () => { tab = 'subs'; drawTabs(); draw(); } }, tr('Beküldések ({n})', { n: subs.length })));
    const draw = () => {
      if (tab === 'edit') {
        const fieldsBox = h('div');
        const drawFields = () => fieldsBox.replaceChildren(...f.fields.map((fl, i) => {
          const opts = h('div', { class: 'full' });
          const drawOpts = () => opts.replaceChildren(['select', 'choice'].includes(fl.type) ? F.wrap(tr('Választási lehetőségek (soronként egy)'),
            h('textarea', { class: 'input', rows: 3, oninput: (e) => { fl.options = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); } }, (fl.options || []).join('\n'))) : '');
          drawOpts();
          return h('div', { class: 'sub-item' },
            h('div', { class: 'sub-head' }, h('b', {}, `${i + 1}. ${fl.label || ''}`),
              i > 0 ? btn('', () => { [f.fields[i - 1], f.fields[i]] = [f.fields[i], f.fields[i - 1]]; drawFields(); }, { cls: 'sm icon ghost', ic: 'prev', title: tr('Feljebb') }) : null,
              btn('', () => { f.fields.splice(i, 1); drawFields(); }, { cls: 'sm icon ghost', ic: 'trash' })),
            h('div', { class: 'fields' },
              F.text(tr('Kérdés / mező neve'), fl, 'label'),
              F.select(tr('Típus'), fl, 'type', FIELD_TYPES, { onchange: drawOpts }),
              ['text', 'textarea', 'email', 'tel', 'number'].includes(fl.type) || !fl.type ? F.text(tr('Helykitöltő szöveg'), fl, 'placeholder') : h('div'),
              h('div', { class: 'row' }, F.toggle(tr('Kötelező'), fl, 'required'), F.toggle(tr('Teljes szélesség'), fl, 'wide')),
              opts));
        }));
        drawFields();
        content.replaceChildren(h('div', { class: 'split' },
          h('div', { class: 'stack' },
            h('div', { class: 'card card-pad fields' },
              F.text(tr('Belső név'), f, 'name'), F.text(tr('Gomb felirata'), f, 'submit_text'),
              F.text(tr('Cím a képernyőn'), f, 'title', { full: true }),
              F.textarea(tr('Bevezető szöveg'), f, 'intro', { rows: 2 }),
              F.text(tr('Köszönő üzenet'), f, 'thanks_text', { full: true })),
            h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Mezők')), btn(tr('Új mező'), () => { f.fields.push({ type: 'text', label: tr('Új mező') }); drawFields(); }, { cls: 'sm primary', ic: 'plus' })), h('div', { class: 'card-body' }, fieldsBox))),
          h('div', { class: 'card card-pad stack preview-box' },
            h('b', {}, tr('Hogyan jelenítsem meg?')),
            h('p', { class: 'small muted', style: { margin: 0 } }, tr('Hozz létre egy „Űrlap” típusú tartalmat, válaszd ki ezt az űrlapot, majd tedd be egy lejátszási listába – vagy köss rá egy interaktív menü gombot.')),
            btn(tr('Űrlap tartalom létrehozása'), async () => {
              await save();
              const s = await POST('/api/slides', { name: f.name, type: 'form', duration: 45, data: { form_id: f.id } });
              invalidate('slides'); location.hash = `#/slides/${s.id}`;
            }, { cls: 'primary', ic: 'plus' }),
            h('div', { class: 'small muted' }, tr('✓ Virtuális magyar billentyűzet érintőképernyőhöz'), h('br'), tr('✓ Kötelező mezők és e-mail ellenőrzés'), h('br'), tr('✓ CSV export Excelhez (UTF-8, pontosvessző)')))));
      } else {
        content.replaceChildren(h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h3', {}, tr('{n} beküldés', { n: subs.length })), h('a', { class: 'btn sm', href: `/api/forms/${f.id}/export.csv` }, icon('download'), tr('CSV letöltése'))),
          subs.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
            h('thead', {}, h('tr', {}, h('th', {}, tr('Időpont')), h('th', {}, tr('Képernyő')), f.fields.map((x) => h('th', {}, x.label)), h('th'))),
            h('tbody', {}, subs.map((s) => h('tr', {},
              h('td', { class: 'small', style: { whiteSpace: 'nowrap' } }, fmtDate(s.created_at)), h('td', { class: 'small muted' }, s.screen_name || '—'),
              f.fields.map((x) => {
                const v = s.data[x.key];
                return h('td', {}, typeof v === 'boolean' ? (v ? '✓' : '—') : x.type === 'rating' ? '★'.repeat(+v || 0) : x.type === 'smiley' ? (['', '😞', '🙁', '😐', '🙂', '😍'][+v] || '') : String(v ?? ''));
              }),
              h('td', {}, btn('', async () => { if (!(await confirmBox(tr('Törlöd ezt a beküldést?'), { ok: tr('Törlés') }))) return; await DEL(`/api/submissions/${s.id}`); subs.splice(subs.indexOf(s), 1); drawTabs(); draw(); }, { cls: 'sm icon ghost', ic: 'trash' }))))))) : h('div', { class: 'empty' }, h('div', { class: 'big' }, '📭'), tr('Még nem érkezett beküldés.'))));
      }
    };
    drawTabs(); draw();
    view.replaceChildren(
      head(f.name, null, [
        btn(tr('Törlés'), async () => { if (!(await confirmBox(tr('Törlöd a(z) „{name}” űrlapot és az összes beküldését?', { name: f.name }), { ok: tr('Törlés') }))) return; await DEL(`/api/forms/${f.id}`); dirty = null; location.hash = '#/forms'; }, { cls: 'danger', ic: 'trash' }),
        btn(tr('Mentés'), save, { cls: 'primary', ic: 'save' })], [h('a', { href: '#/forms' }, tr('Űrlapok')), ' / ']),
      tabs, content);
  }

  // =====================================================================
  //  Vészjelzés / közlemények
  // =====================================================================
  async function pageAlerts(view) {
    const [alerts, { screens }] = await Promise.all([GET('/api/alerts'), GET('/api/screens')]);
    const a = { title: '', message: '', level: 'warning', minutes: 30, screen_ids: [] };
    const LEVELS = [['info', 'ℹ️', tr('Információ')], ['success', '✅', tr('Pozitív')], ['warning', '⚠️', tr('Figyelmeztetés')], ['danger', '🚨', tr('Vészhelyzet')]];
    const TEMPLATES = [
      { title: tr('TŰZRIADÓ'), message: tr('Kérjük, azonnal hagyja el az épületet a legközelebbi vészkijáraton!\nNe használja a liftet!'), level: 'danger', minutes: 0 },
      { title: tr('Evakuálás'), message: tr('Kérjük, nyugodtan, a kijelölt útvonalon hagyja el az épületet, és gyülekezzen a gyülekezési ponton.'), level: 'danger', minutes: 0 },
      { title: tr('Rövid szünet'), message: tr('Az ügyfélszolgálat 15 percig szünetel. Köszönjük türelmét!'), level: 'info', minutes: 15 },
      { title: tr('Gratulálunk!'), message: tr('Ma ünnepeljük cégünk születésnapját! 🎉 Torta a konyhában.'), level: 'success', minutes: 60 },
    ];
    const formBox = h('div');
    const drawForm = () => formBox.replaceChildren(h('div', { class: 'stack' },
      h('div', { class: 'row' }, h('span', { class: 'small muted' }, tr('Sablonok:')), TEMPLATES.map((t) => btn(t.title, () => { Object.assign(a, clone(t)); drawForm(); }, { cls: 'sm' }))),
      h('div', { class: 'level-pick' }, LEVELS.map(([k, e, l]) => h('button', { type: 'button', class: `${k} ${a.level === k ? 'on' : ''}`, onclick: () => { a.level = k; drawForm(); } }, h('span', {}, e), l))),
      F.text(tr('Cím'), a, 'title', { placeholder: tr('pl. Figyelem!') }),
      F.textarea(tr('Üzenet'), a, 'message', { rows: 3 }),
      h('div', { class: 'fields' },
        F.select(tr('Időtartam'), a, 'minutes', [[0, tr('Visszavonásig')], [5, tr('{n} perc', { n: 5 })], [15, tr('{n} perc', { n: 15 })], [30, tr('{n} perc', { n: 30 })], [60, tr('1 óra')], [240, tr('4 óra')], [1440, tr('1 nap')]], { number: true }),
        F.wrap(tr('Képernyők'), h('div', { class: 'stack', style: { gap: '4px', maxHeight: '140px', overflowY: 'auto' } },
          h('span', { class: 'small muted' }, tr('Ha egy sincs kijelölve: minden képernyő')),
          screens.map((s) => { const cb = h('input', { type: 'checkbox', checked: a.screen_ids.includes(s.id), onchange: () => { a.screen_ids = cb.checked ? [...a.screen_ids, s.id] : a.screen_ids.filter((x) => x !== s.id); } }); return h('label', { class: 'check' }, cb, s.name); })))),
      h('div', { class: 'row' }, btn(tr('Küldés a képernyőkre'), async () => {
        if (!a.message) return toast(tr('Az üzenet nem lehet üres'), 'err');
        if (a.level === 'danger' && !(await confirmBox(tr('Vészhelyzeti üzenetet küldesz, ami azonnal, teljes képernyőn megjelenik. Folytatod?'), { ok: tr('Küldés') }))) return;
        await POST('/api/alerts', a); toast(tr('Üzenet kiküldve')); refreshBadges(); route();
      }, { cls: 'primary', ic: 'alert' }))));
    drawForm();
    const active = alerts.filter((x) => !x.expires_at || x.expires_at > Date.now());
    const past = alerts.filter((x) => x.expires_at && x.expires_at <= Date.now());
    const row = (x, isActive) => h('div', { class: 'alert-row' }, h('span', { class: 'ai' }, LEVELS.find((l) => l[0] === x.level)?.[1]),
      h('div', { class: 'grow' }, h('b', {}, x.title || tr('(cím nélkül)')), h('div', { class: 'small', style: { whiteSpace: 'pre-line' } }, x.message),
        h('div', { class: 'small muted' }, `${fmtDate(x.created_at)} · ${x.screen_ids?.length ? tr('{n} képernyő', { n: x.screen_ids.length }) : tr('minden képernyő')}${isActive ? (x.expires_at ? ' · ' + tr('lejár: {t}', { t: new Date(x.expires_at).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }) }) : tr(' · visszavonásig')) : ''}`)),
      isActive ? btn(tr('Visszavonás'), async () => { await DEL(`/api/alerts/${x.id}`); toast(tr('Üzenet visszavonva')); refreshBadges(); route(); }, { cls: 'sm danger' })
        : btn(tr('Újraküldés'), async () => { await POST('/api/alerts', { ...x, minutes: 30 }); toast(tr('Újraküldve')); route(); }, { cls: 'sm' }));
    view.replaceChildren(
      head(tr('Vészjelzés és közlemények'), tr('Azonnali, teljes képernyős üzenet a kiválasztott vagy az összes képernyőre – minden más tartalmat felülír.')),
      h('div', { class: 'split' },
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Új üzenet'))), h('div', { class: 'card-body' }, formBox)),
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Aktív ({n})', { n: active.length }))), active.length ? active.map((x) => row(x, true)) : h('div', { class: 'empty small' }, tr('Nincs aktív üzenet ✓'))),
          past.length ? h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Korábbiak'))), past.slice(0, 10).map((x) => row(x, false))) : null)));
  }

  // A téma CSS változóinak (var(--bg) stb.) feloldása az admin színmintáihoz
  function themeCss(str) {
    const T = window.SIGNAGE_THEMES;
    if (!T) return str;
    const c = T.resolve(cache.branding || {}).colors;
    const map = { '--accent': c.accent, '--accent-fg': c.accent_fg, '--bg': c.bg, '--bg2': c.bg2, '--fg': c.fg, '--surface': c.surface, '--muted': c.muted };
    return String(str).replace(/var\((--[\w-]+)\)/g, (m, v) => map[v] || m);
  }

  // =====================================================================
  //  Arculat (színek, logók, betűk, fejléc, előre megadott témák)
  // =====================================================================
  async function pageBranding(view) {
    const T = window.SIGNAGE_THEMES;
    const [st] = await Promise.all([GET('/api/settings'), load('media', true)]);
    st.branding = { preset: 'narancs', colors: {}, header: {}, ...(st.branding || {}) };
    st.branding.colors ||= {};
    st.branding.header ||= {};
    const b = st.branding;
    let orig = JSON.stringify(st);
    dirty = () => JSON.stringify(st) !== orig;

    const pv = previewFrame('/player/?preview=brand:1');
    const push = debounce(() => {
      const logo = st.logo_media_id && mediaById(st.logo_media_id);
      pv.frame.contentWindow?.postMessage({
        type: 'branding',
        org: { name: st.org_name, slogan: st.slogan, logo_media_id: st.logo_media_id || null, branding: clone(b) },
        media: logo ? { [logo.id]: { id: logo.id, url: logo.url, mime: logo.mime, name: logo.name } } : {},
      }, location.origin);
    }, 120);
    pv.frame.addEventListener('load', () => setTimeout(push, 400));
    const ch = () => { push(); drawSwatches(); };

    // --- Témák galériája ---
    const gallery = h('div', { class: 'theme-grid' });
    const drawGallery = () => gallery.replaceChildren(...Object.entries(T.THEMES).map(([k, t]) => {
      const c = t.colors;
      return h('button', { type: 'button', class: `theme-tile ${b.preset === k ? 'on' : ''}`, onclick: async () => {
        const custom = Object.keys(b.colors).length || b.font || b.head_font || b.radius;
        if (custom && b.preset !== k && !(await confirmBox(tr('A téma váltása törli az egyedi szín- és betűbeállításokat. Folytatod?'), { ok: tr('Téma váltása'), danger: false }))) return;
        b.preset = k; b.colors = {}; delete b.font; delete b.head_font; delete b.radius;
        drawGallery(); drawCustom(); ch();
      } },
      h('div', { class: 'theme-pv', style: { background: `linear-gradient(135deg, ${c.bg2}, ${c.bg})`, color: c.fg, fontFamily: T.FONTS[t.head_font]?.css } },
        h('div', { class: 'tp-title' }, tr('Aa Üdv!')),
        h('div', { class: 'row', style: { gap: '5px' } }, h('span', { class: 'tp-btn', style: { background: c.accent, color: c.accent_fg } }, tr('Gomb')), h('span', { class: 'tp-card', style: { background: c.surface } }))),
      h('div', { class: 'theme-meta' }, h('b', {}, tr(t.name)), h('span', {}, tr(t.desc))));
    }));
    drawGallery();

    // --- Egyedi színek, betűk, forma ---
    const custom = h('div');
    const swatches = h('div', { class: 'row', style: { gap: '6px' } });
    const drawSwatches = () => {
      const r = T.resolve(b);
      swatches.replaceChildren(...['bg', 'bg2', 'surface', 'accent', 'accent_fg', 'fg', 'muted'].map((k) => h('span', { class: 'swatch', title: tr(T.COLOR_LABELS[k]), style: { background: r.colors[k] } })));
    };
    const fontOpts = (withDefault) => [...(withDefault ? [['', tr('A téma szerint ({name})', { name: tr(T.FONTS[T.THEMES[b.preset]?.font]?.name || '') })]] : []), ...Object.entries(T.FONTS).map(([k, f]) => [k, tr(f.name)])];
    const drawCustom = () => {
      const r = T.resolve(b);
      const colorField = (k) => {
        const val = b.colors[k] || '';
        const eff = r.colors[k];
        const inp = h('input', { class: 'input', type: 'color', value: /^#[0-9a-f]{6}$/i.test(eff) ? eff : '#888888' });
        inp.addEventListener('input', () => { b.colors[k] = inp.value; mark.textContent = tr('egyedi'); mark.className = 'badge orange'; ch(); });
        const mark = h('span', { class: val ? 'badge orange' : 'badge' }, val ? tr('egyedi') : tr('téma'));
        return F.wrap(tr(T.COLOR_LABELS[k]), h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, inp, mark,
          btn('', () => { delete b.colors[k]; drawCustom(); ch(); }, { cls: 'sm icon ghost', ic: 'refresh', title: tr('Vissza a téma színére') })));
      };
      const sample = h('div', { class: 'font-sample', style: { fontFamily: T.FONTS[r.font]?.css } },
        h('div', { style: { fontFamily: T.FONTS[r.head_font]?.css, fontWeight: 800, fontSize: '22px' } }, tr('Árvíztűrő tükörfúrógép')),
        h('div', {}, tr('Minta szöveg ékezetekkel: őszi ünnepi programok 2026.')));
      custom.replaceChildren(h('div', { class: 'fields' },
        colorField('accent'), colorField('accent_fg'), colorField('bg'), colorField('bg2'), colorField('fg'),
        h('div', { class: 'field' }, h('label', {}, tr('Teljes paletta')), swatches),
        F.select(tr('Szöveg betűtípusa'), b, 'font', fontOpts(true), { onchange: (v) => { if (!v) delete b.font; drawCustom(); ch(); } }),
        F.select(tr('Címek betűtípusa'), b, 'head_font', fontOpts(true), { onchange: (v) => { if (!v) delete b.head_font; drawCustom(); ch(); } }),
        F.seg(tr('Lekerekítés'), b, 'radius', Object.entries(T.RADIUS).map(([k, x]) => [k, tr(x.name)]), { def: T.THEMES[b.preset]?.radius, onchange: () => { drawCustom(); ch(); } }),
        h('div', { class: 'full' }, sample),
        h('div', { class: 'full small muted' }, tr('A Google betűtípusokhoz a kijelzőnek internet kell; nélküle a rendszer betűtípusa jelenik meg.'))));
      drawSwatches();
    };
    drawCustom();

    const hd = b.header;
    view.replaceChildren(
      head(tr('Arculat'), tr('Színek, logó, betűtípusok és címek – egységes megjelenés minden képernyőn.'), [
        btn(tr('Alapértelmezés'), async () => {
          if (!(await confirmBox(tr('Visszaállítod a Narancs alaptémát? A logó és a nevek megmaradnak.'), { ok: tr('Visszaállítás') }))) return;
          st.branding = { preset: 'narancs', colors: {}, header: {} }; await PUT('/api/settings', { branding: st.branding }); dirty = null; route();
        }, { ic: 'refresh' }),
        btn(tr('Mentés'), async () => {
          try {
            await PUT('/api/settings', { org_name: st.org_name, slogan: st.slogan, logo_media_id: st.logo_media_id || null, branding: b });
            orig = JSON.stringify(st);
            cache.branding = clone(b);
            ME.org_name = st.org_name; ME.logo_url = st.logo_media_id ? mediaById(st.logo_media_id)?.url : null;
            toast(tr('Arculat mentve – a képernyők azonnal frissülnek'));
            const brandEl = $('.sidebar .brand'); if (brandEl) { shell(); route(); }
          } catch (e) { fail(e); }
        }, { cls: 'primary', ic: 'save' })]),
      h('div', { class: 'split' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('1. Válassz témát'))), h('div', { class: 'card-body' }, gallery)),
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('2. Szervezet, logó és címek'))),
            h('div', { class: 'card-body fields' },
              F.text(tr('Szervezet neve'), st, 'org_name', { onchange: ch }),
              F.text(tr('Szlogen / alcím'), st, 'slogan', { onchange: ch, placeholder: tr('pl. Minden, amit tudni érdemes') }),
              F.media(tr('Logó'), st, 'logo_media_id', { accept: 'image/', onchange: ch, hint: tr('Átlátszó hátterű PNG vagy SVG ajánlott.') }),
              F.seg(tr('Logó vízjel a sarokban'), b, 'logo_corner', [['none', tr('Nincs')], ['tl', tr('↖ Bal fent')], ['tr', tr('↗ Jobb fent')], ['bl', tr('↙ Bal lent')], ['br', tr('↘ Jobb lent')]], { def: 'none', full: true, onchange: ch }),
              F.number(tr('Vízjel mérete (% a képernyő magasságából)'), b, 'logo_size', { min: 3, max: 30, placeholder: '9', onchange: ch }),
              F.number(tr('Vízjel átlátszatlansága (%)'), b, 'logo_opacity', { min: 10, max: 100, placeholder: '90', onchange: ch }))),
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('3. Fejléc sáv a képernyők tetején'))),
            h('div', { class: 'card-body fields' },
              F.toggle(tr('Fejléc megjelenítése'), hd, 'enabled', { full: true, onchange: ch, hint: tr('Logó, cím, alcím és óra a képernyő tetején, minden tartalom fölött.') }),
              F.text(tr('Cím'), hd, 'title', { placeholder: tr('üresen: a szervezet neve'), onchange: ch }),
              F.text(tr('Alcím'), hd, 'subtitle', { placeholder: tr('üresen: a szlogen'), onchange: ch }),
              F.seg(tr('Stílus'), hd, 'style', [['surface', tr('Háttérszín')], ['accent', tr('Kiemelő szín')], ['gradient', tr('Átmenet#szín')]], { def: 'surface', onchange: ch }),
              h('div', { class: 'row' }, F.toggle(tr('Logó'), hd, 'show_logo', { defaultOn: true, onchange: ch }), F.toggle(tr('Óra és dátum'), hd, 'show_clock', { defaultOn: true, onchange: ch })))),
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('4. Finomhangolás: színek, betűk, forma'))), h('div', { class: 'card-body' }, custom)),
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('5. Tartalmak színezése'))),
            h('div', { class: 'card-body stack' },
              h('p', { class: 'small muted', style: { margin: 0 } }, tr('Az új tartalmak alapból az arculat színeit használják. A korábban egyedi színekkel (háttér, szöveg, kártya- és gombszín) létrehozott tartalmakat itt egyszerre átszínezheted, így minden a kiválasztott témát követi – később témát váltva is. A képek, videók és háttérképek nem változnak.')),
              h('div', {}, btn(tr('Összes tartalom arculat szerint'), async () => {
                if (!(await confirmBox(tr('Minden tartalom egyedi színei az arculat színeire cserélődnek. Ez nem vonható vissza. Folytatod?'), { ok: tr('Átszínezés') }))) return;
                try { const r = await POST('/api/slides/brandify', {}); invalidate('slides'); toast(tr('{n} / {total} tartalom átszínezve', { n: r.changed, total: r.total })); pv.reload(); } catch (e) { fail(e); }
              }, { cls: 'primary', ic: 'palette' }))))),
        h('div', { class: 'preview-box stack' },
          h('div', { class: 'row between' }, h('b', {}, tr('Élő előnézet')),
            h('div', { class: 'row' },
              btn('', () => pv.frame.contentWindow?.postMessage({ type: 'nav', step: -1 }, location.origin), { cls: 'sm icon', ic: 'prev', title: tr('Előző minta') }),
              btn('', () => pv.frame.contentWindow?.postMessage({ type: 'nav', step: 1 }, location.origin), { cls: 'sm icon', ic: 'next', title: tr('Következő minta') }),
              btn('', () => window.open('/player/?preview=brand:1', '_blank'), { cls: 'sm icon', ic: 'external', title: tr('Teljes képernyő') }))),
          pv.el,
          h('div', { class: 'small muted' }, tr('A változások azonnal látszanak az előnézetben; a képernyőkre a Mentés után kerülnek ki. Képernyőnként eltérő téma a Képernyők → Szerkesztés → Megjelenés fülön állítható.')))),
    );
  }

  // =====================================================================
  //  Beállítások
  // =====================================================================
  async function pageSettings(view) {
    const admin = isAdmin();
    const [st, users, tokens] = await Promise.all([GET('/api/settings'), admin ? GET('/api/users') : [], admin ? GET('/api/tokens') : [], load('media')]);
    const pw = { current: '', password: '', password2: '' };
    const nu = { username: '', password: '', role: 'editor' };
    const nt = { name: '', role: 'editor' };
    const roleOpts = Object.entries(ROLE_NAMES);
    const lang = { v: st.language || I18N.lang };
    const usersBox = h('div');
    const drawUsers = (list) => usersBox.replaceChildren(...list.map((u) => h('div', { class: 'list-item' }, h('div', { class: 'avatar' }, u.username[0].toUpperCase()), h('div', { class: 'grow' }, h('b', {}, u.username), h('div', { class: 'small muted' }, tr('Létrehozva: {t}', { t: fmtDate(u.created_at) }))),
      u.id !== ME.id ? h('select', { class: 'input sm role-sel', title: tr('Szerepkör'), onchange: async (e) => { try { drawUsers(await PUT(`/api/users/${u.id}`, { role: e.target.value })); toast(tr('Szerepkör módosítva')); } catch (ex) { fail(ex); } } },
        roleOpts.map(([k, l]) => h('option', { value: k, selected: (u.role || 'admin') === k }, l))) : h('span', { class: 'small muted' }, ROLE_NAMES[u.role || 'admin']),
      u.id !== ME.id ? btn('', async () => { if (!(await confirmBox(tr('Törlöd „{name}” felhasználót?', { name: u.username }), { ok: tr('Törlés') }))) return; drawUsers(await DEL(`/api/users/${u.id}`)); }, { cls: 'sm icon ghost', ic: 'trash' }) : h('span', { class: 'badge orange' }, tr('Te')))));
    drawUsers(users);
    const tokensBox = h('div');
    const drawTokens = (list) => tokensBox.replaceChildren(...(list.length ? list.map((t) => h('div', { class: 'list-item' }, h('div', { class: 'grow' }, h('b', {}, t.name),
      h('div', { class: 'small muted' }, `${ROLE_NAMES[t.role]} · ${tr('létrehozta: {u}', { u: t.username })} · ${t.last_used ? tr('utoljára használva: {t}', { t: ago(t.last_used) }) : tr('még nem használták')}`)),
      btn('', async () => { if (!(await confirmBox(tr('Visszavonod a(z) „{name}” kulcsot? Az ezt használó rendszerek nem érik el többé az API-t.', { name: t.name }), { ok: tr('Visszavonás') }))) return; drawTokens(await DEL(`/api/tokens/${t.id}`)); }, { cls: 'sm icon ghost', ic: 'trash', title: tr('Visszavonás') })))
      : [h('div', { class: 'empty small' }, tr('Még nincs API kulcs'))]));
    drawTokens(tokens);
    view.replaceChildren(
      head(tr('Beállítások'), `Narancs Signage v${st.version} · Node ${st.node}`),
      h('div', { class: 'grid c2' },
        h('div', { class: 'card', 'data-admin': 1 }, h('div', { class: 'card-head' }, h('h3', {}, tr('Nyelv'))),
          h('div', { class: 'card-body stack' },
            F.select(tr('A felület és a képernyők nyelve'), lang, 'v', Object.entries(I18N.LANGS), { onchange: async (v) => {
              try { await PUT('/api/settings', { language: v }); location.reload(); } catch (e) { fail(e); }
            } }),
            h('p', { class: 'small muted', style: { margin: 0 } }, tr('Az admin felület, a kijelzők feliratai (dátumok, gombok, billentyűzet) és az új tartalmak mintaszövegei ezen a nyelven jelennek meg. A már létrehozott tartalmak szövege nem változik.')))),
        h('div', { class: 'card', 'data-admin': 1 }, h('div', { class: 'card-head' }, h('h3', {}, tr('Szervezet és arculat'))),
          h('div', { class: 'card-body stack' },
            h('div', { class: 'row' }, ME.logo_url ? h('img', { src: ME.logo_url, style: { height: '44px', maxWidth: '140px', objectFit: 'contain' } }) : null, h('div', {}, h('b', {}, st.org_name), st.slogan ? h('div', { class: 'small muted' }, st.slogan) : null)),
            h('p', { class: 'small muted', style: { margin: 0 } }, tr('A szervezet neve, a logó, a színek, a betűtípusok és a képernyő fejléce az Arculat menüben állítható.')),
            h('div', {}, btn(tr('Arculat szerkesztése'), () => { location.hash = '#/branding'; }, { cls: 'primary', ic: 'palette' })))),
        h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h3', {}, tr('Jelszó módosítása'))),
          h('div', { class: 'card-body stack' },
            F.text(tr('Jelenlegi jelszó'), pw, 'current', { type: 'password' }),
            h('div', { class: 'fields' }, F.text(tr('Új jelszó'), pw, 'password', { type: 'password' }), F.text(tr('Új jelszó újra'), pw, 'password2', { type: 'password' })),
            h('div', {}, btn(tr('Jelszó módosítása'), async () => {
              if (pw.password !== pw.password2) return toast(tr('A két jelszó nem egyezik'), 'err');
              try { await POST('/api/account/password', pw); toast(tr('Jelszó módosítva')); } catch (e) { fail(e); }
            }, { cls: 'primary' })))),
        h('div', { class: 'card', 'data-admin': 1 }, h('div', { class: 'card-head' }, h('h3', {}, tr('Felhasználók'))), usersBox,
          h('div', { class: 'card-body row', style: { borderTop: '1px solid var(--border)', alignItems: 'flex-end' } },
            h('div', { class: 'grow' }, F.text(tr('Felhasználónév'), nu, 'username')), h('div', { class: 'grow' }, F.text(tr('Jelszó'), nu, 'password', { type: 'password' })),
            h('div', {}, F.select(tr('Szerepkör'), nu, 'role', roleOpts)),
            btn(tr('Hozzáadás'), async () => { try { drawUsers(await POST('/api/users', nu)); toast(tr('Felhasználó létrehozva')); } catch (e) { fail(e); } }, { cls: 'primary', ic: 'plus' }))),
        h('div', { class: 'card', 'data-admin': 1 }, h('div', { class: 'card-head' }, h('h3', {}, tr('API kulcsok'))),
          h('div', { class: 'card-body stack' },
            h('p', { class: 'small muted', style: { margin: 0 } }, tr('Más rendszerek (pl. Home Assistant, Zapier, saját szkript) ezzel a kulccsal hívhatják az API-t – például vészjelzést küldhetnek. Fejléc: '), h('span', { class: 'code-pill' }, 'Authorization: Bearer ns_…')),
            tokensBox,
            h('div', { class: 'row', style: { alignItems: 'flex-end' } },
              h('div', { class: 'grow' }, F.text(tr('Kulcs neve'), nt, 'name', { placeholder: tr('pl. Home Assistant') })),
              h('div', {}, F.select(tr('Szerepkör'), nt, 'role', roleOpts)),
              btn(tr('Kulcs létrehozása'), async () => {
                try {
                  const r = await POST('/api/tokens', nt);
                  drawTokens(r.tokens); nt.name = '';
                  const m = modal({ title: tr('Új API kulcs'), body: h('div', { class: 'stack' },
                    h('p', { class: 'small' }, tr('Másold ki most – biztonsági okból később már nem jeleníthető meg.')),
                    h('div', { class: 'code-pill', style: { userSelect: 'all', wordBreak: 'break-all', fontSize: '13px', padding: '10px' } }, r.token)),
                  foot: [btn(tr('Másolás'), async () => { try { await navigator.clipboard.writeText(r.token); toast(tr('Kimásolva')); } catch { /* */ } }, { ic: 'copy' }), btn(tr('Kész'), () => m.close(), { cls: 'primary' })] });
                } catch (e) { fail(e); }
              }, { cls: 'primary', ic: 'plus' })))),
        h('div', { class: 'card', 'data-admin': 1 }, h('div', { class: 'card-head' }, h('h3', {}, tr('Minta tartalmak'))),
          h('div', { class: 'card-body stack' },
            h('p', { class: 'small muted', style: { margin: 0 } }, tr('Egy új lejátszási lista bemutató tartalmakkal: üdvözlő hirdetmény, óra és időjárás, kártyák, naptár mintaeseményekkel, interaktív menü elégedettségi kérdőívvel és visszaszámláló. Az első telepítéskor ez automatikusan létrejön.')),
            h('div', {}, btn(tr('Minta tartalmak létrehozása'), async () => {
              try { const r = await POST('/api/samples'); invalidate('playlists', 'slides', 'forms', 'calendars'); toast(tr('Minta tartalmak létrehozva')); location.hash = `#/playlists/${r.playlist_id}`; } catch (e) { fail(e); }
            }, { ic: 'plus' })))),
        h('div', { class: 'card', 'data-admin': 1 }, h('div', { class: 'card-head' }, h('h3', {}, tr('Rendszer és mentés'))),
          h('div', { class: 'card-body stack' },
            h('div', { class: 'kv' }, tr('Adatkönyvtár: '), h('span', { class: 'code-pill' }, st.data_dir)),
            h('div', { class: 'kv' }, tr('Futásidő: '), h('b', {}, fmtDur(st.uptime))),
            h('div', { class: 'kv' }, tr('Lejátszó címe: '), h('span', { class: 'code-pill' }, `${location.origin}/player/`)),
            h('div', { class: 'row' }, h('a', { class: 'btn', href: '/api/backup' }, icon('download'), tr('Adatbázis mentése')),
              btn(tr('Képernyők újratöltése'), async () => { const r = await POST('/api/screens/broadcast', { command: 'reload' }); toast(tr('{n} képernyő újratöltve', { n: r.count })); }, { ic: 'refresh' })),
            h('div', { class: 'small muted' }, tr('A teljes mentéshez (médiafájlokkal együtt) a szerveren futtasd: '), h('span', { class: 'code-pill' }, 'sudo signage-backup'))))),
    );
    if (!admin) view.querySelectorAll('[data-admin]').forEach((el) => el.remove());
  }

  boot();
})();
