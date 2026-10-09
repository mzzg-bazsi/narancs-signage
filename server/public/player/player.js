/* Narancs Signage – lejátszó
 * Böngészőben fut (Chromium kioszk mód), ARM és x86 eszközökön egyaránt. */
(() => {
  'use strict';

  // A natív append/replaceChildren a null-t "null" szövegként szúrná be – kiszűrjük
  for (const m of ['append', 'replaceChildren']) {
    const orig = Element.prototype[m];
    if (orig.__safe) continue;
    Element.prototype[m] = function (...a) { return orig.apply(this, a.flat(Infinity).filter((x) => x != null && x !== false)); };
    Element.prototype[m].__safe = true;
  }

  // ------------------------------------------------------------------
  //  Alapok
  // ------------------------------------------------------------------
  const $ = (s, el = document) => el.querySelector(s);
  const h = (tag, attrs = {}, ...children) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  };
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.get('preview');
  const LS = {
    get(k, d = null) { try { const v = localStorage.getItem('signage.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('signage.' + k, JSON.stringify(v)); } catch { /* tele */ } },
  };
  function randomId() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }
  let DEVICE = params.get('device') || LS.get('device');
  if (!DEVICE || !/^[\w-]{8,64}$/.test(DEVICE)) DEVICE = randomId();
  if (!PREVIEW) LS.set('device', DEVICE);
  if (PREVIEW) document.body.classList.add('preview');

  const api = async (path, opts = {}) => {
    const r = await fetch(path, { cache: 'no-store', ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { status: r.status });
    return j;
  };

  const state = {
    cfg: null,
    playlistId: null,
    items: [],
    index: -1,
    current: null,       // { slide, ctrl, el }
    timer: null,
    slideStart: 0,
    slideDuration: 0,
    stack: [],           // interaktív navigáció előzményei
    interactUntil: 0,
    stats: [],
    online: true,
  };

  const media = (id) => (state.cfg?.media || {})[id];
  const mediaUrl = (id) => media(id)?.url || '';
  const settings = () => state.cfg?.screen?.settings || {};
  const pad = (n) => String(n).padStart(2, '0');
  const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const HU_DAYS = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  const HU_DAYS_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
  const HU_MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  const fmtDay = (d) => `${HU_MONTHS[d.getMonth()]} ${d.getDate()}., ${HU_DAYS[d.getDay()]}`;
  const fmtDateLong = (d) => `${d.getFullYear()}. ${fmtDay(d)}`;
  // Egész napos események dátuma helyi idő szerint (nem UTC)
  const localDate = (str) => { const [y, m, d] = String(str).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const evStart = (e) => (e.all_day ? localDate(e.start) : new Date(e.start));
  const evEnd = (e) => { if (e.all_day) { const d = localDate(e.end || e.start); d.setHours(23, 59, 59, 999); return d; } return new Date(e.end || e.start); };
  const cleanups = new Set();
  const later = (fn, ms) => { const t = setTimeout(fn, ms); cleanups.add(() => clearTimeout(t)); return t; };
  const every = (fn, ms) => { const t = setInterval(fn, ms); cleanups.add(() => clearInterval(t)); return t; };

  // ------------------------------------------------------------------
  //  Ütemezés: melyik lejátszási lista aktív most?
  // ------------------------------------------------------------------
  const toMin = (s) => { const [a, b] = String(s || '0:0').split(':').map(Number); return (a || 0) * 60 + (b || 0); };
  function inWindow(rule, d = new Date()) {
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    if (rule.days?.length && !rule.days.includes(dow)) return false;
    const day = d.toISOString().slice(0, 10);
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (rule.date_from && local < rule.date_from) return false;
    if (rule.date_to && local > rule.date_to) return false;
    void day;
    if (!rule.from && !rule.to) return true;
    const m = d.getHours() * 60 + d.getMinutes();
    const f = toMin(rule.from || '00:00'), t = toMin(rule.to || '24:00');
    return f <= t ? m >= f && m < t : m >= f || m < t; // éjfélen átnyúló sáv
  }
  function activePlaylistId() {
    const s = state.cfg.screen;
    for (const rule of s.schedule || []) if (rule.playlist_id && inWindow(rule)) return rule.playlist_id;
    return s.playlist_id || (PREVIEW ? 0 : null);
  }
  function screenIsOff() {
    const st = settings();
    if (!st.power_schedule) return false;
    const d = new Date();
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    if (st.on_days?.length && !st.on_days.includes(dow)) return true;
    return !inWindow({ from: st.on_time || '00:00', to: st.off_time || '24:00' });
  }
  function itemValid(it) {
    if (it.enabled === false) return false;
    const d = new Date();
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (it.valid_from && local < it.valid_from) return false;
    if (it.valid_to && local > it.valid_to) return false;
    return !!state.cfg.slides[it.slide_id];
  }

  // ------------------------------------------------------------------
  //  Lejátszási ciklus
  // ------------------------------------------------------------------
  function loadPlaylist(force = false) {
    const pid = activePlaylistId();
    const pl = state.cfg.playlists[pid];
    const items = (pl?.items || []).filter(itemValid);
    const sig = JSON.stringify([pid, items]);
    if (!force && sig === state.itemsSig) return;
    state.itemsSig = sig;
    const currentId = state.items[state.index]?.slide_id;
    state.playlistId = pid;
    state.transition = pl?.transition || 'fade';
    state.items = items;
    // ha az aktuális dia még benne van, onnan folytatjuk
    const keep = items.findIndex((i) => i.slide_id === currentId);
    state.index = keep >= 0 ? keep - 1 : -1;
    if (!state.stack.length) next();
  }

  function next(step = 1) {
    clearTimeout(state.timer);
    if (!state.items.length) { showEmpty(); return; }
    state.index = (state.index + step + state.items.length) % state.items.length;
    const it = state.items[state.index];
    show(state.cfg.slides[it.slide_id], { duration: it.duration });
  }

  function schedule(ms) {
    clearTimeout(state.timer);
    state.slideStart = Date.now();
    state.slideDuration = ms;
    updateProgress();
    if (!ms) return; // a dia maga jelez, ha kész (pl. videó vége)
    state.timer = setTimeout(advance, ms);
  }

  function advance() {
    if (Date.now() < state.interactUntil) { // valaki épp használja a képernyőt
      state.timer = setTimeout(advance, state.interactUntil - Date.now() + 50);
      return;
    }
    if (state.stack.length) { goHome(); return; }
    next();
  }

  function goHome() {
    state.stack = [];
    updateNav();
    state.index--;
    next();
  }

  function goTo(slideId) {
    const s = state.cfg.slides[slideId];
    if (!s) return;
    state.stack.push(state.current?.slide?.id);
    updateNav();
    show(s, { interactive: true });
  }

  function goBack() {
    state.stack.pop();
    const prev = state.stack[state.stack.length - 1];
    if (prev == null) { goHome(); return; }
    state.stack.pop();
    goTo(prev);
  }

  function updateNav() {
    $('#nav').hidden = !state.stack.length;
  }

  function show(slide, { duration, interactive } = {}) {
    if (!slide) return;
    const r = renderers[slide.type] || renderers.unknown;
    const old = state.current;
    for (const c of cleanups) c();
    cleanups.clear();
    old?.ctrl?.destroy?.();

    const el = h('div', { class: 'slide', 'data-type': slide.type });
    const d = slide.data || {};
    if (d.bg) el.style.background = d.bg;
    if (d.color) el.style.color = d.color;
    let finished = false;
    const done = () => { if (!finished && state.current?.el === el) { finished = true; advance(); } };
    const ctrl = r(el, slide, { done }) || {};
    const tr = interactive ? 'up' : (d.transition || state.transition || 'fade');
    if (tr !== 'none') el.classList.add('t-' + tr);
    $('#stage').append(el);
    if (old?.el) {
      old.el.classList.add('leaving');
      if (tr === 'slide') old.el.classList.add('t-slide-out');
      const oldEl = old.el;
      setTimeout(() => oldEl.remove(), 950);
    }
    state.current = { slide, ctrl, el };
    ctrl.start?.();
    let secs = duration || slide.duration;
    if (ctrl.duration != null && !secs) secs = ctrl.duration;
    if (interactive) secs = idleMs() / 1000 + 0.1;
    schedule(secs ? secs * 1000 : (ctrl.manual ? 0 : 10000));
    if (interactive) state.interactUntil = Date.now() + idleMs();
    track(slide.id, 'view');
  }

  function showEmpty() {
    const org = state.cfg?.org || {};
    const el = h('div', { class: 'slide t-fade' },
      h('div', { class: 'empty-slide' },
        org.logo_media_id && mediaUrl(org.logo_media_id) ? h('img', { class: 'logo', src: mediaUrl(org.logo_media_id) }) : null,
        h('h1', {}, org.name || 'Narancs Signage'),
        h('p', {}, state.cfg?.screen?.name ? `${state.cfg.screen.name} – nincs hozzárendelt tartalom` : 'Nincs hozzárendelt tartalom')));
    $('#stage').replaceChildren(el);
    state.current = { slide: null, el, ctrl: {} };
    clearTimeout(state.timer);
    state.timer = setTimeout(() => loadPlaylist(true), 30000);
  }

  function idleMs() { return Math.max(10, +settings().idle_return || 45) * 1000; }

  function updateProgress() {
    const bar = $('#progress');
    bar.style.transition = 'none';
    bar.style.width = '0';
    if (!settings().show_progress || !state.slideDuration) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.style.transition = `width ${state.slideDuration}ms linear`;
      bar.style.width = '100%';
    }));
  }

  // Érintés → megállítjuk a rotációt, amíg a felhasználó használja a képernyőt
  document.addEventListener('pointerdown', () => {
    if (!state.cfg) return;
    state.interactUntil = Date.now() + idleMs();
    const bar = $('#progress');
    bar.style.transition = 'none'; bar.style.width = '0';
    if (state.current?.slide) track(state.current.slide.id, 'touch');
    clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(() => { if (Date.now() >= state.interactUntil) advance(); }, idleMs() + 100);
    document.body.classList.add('touch-cursor');
  }, true);

  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.nav === 'home') goHome(); else goBack();
  });

  // ------------------------------------------------------------------
  //  Tartalomtípusok megjelenítése
  // ------------------------------------------------------------------
  function linkHandler(item) {
    if (item.target_slide) return () => goTo(+item.target_slide);
    return null;
  }

  const renderers = {
    // --- Automatikus képváltó több kép között ---
    image(el, s, { done }) {
      const d = s.data;
      const ids = (d.media_ids || []).filter((i) => media(i));
      const interval = Math.max(2, +d.interval || 6);
      const fit = d.fit || 'cover';
      const g = h('div', { class: `gallery fx-${d.effect || 'fade'}`, style: { '--kb': `${interval + 2}s` } });
      const blurs = [], imgs = [];
      ids.forEach((id) => {
        if (fit === 'contain' && d.blur_bg !== false) { const b = h('img', { class: 'gblur', src: mediaUrl(id), alt: '' }); blurs.push(b); g.append(b); }
        const m = media(id);
        const isVid = m.mime.startsWith('video/');
        const node = isVid
          ? h('video', { class: `gimg fit-${fit}`, src: m.url, muted: true, playsinline: true, preload: 'auto' })
          : h('img', { class: `gimg fit-${fit}`, src: m.url, alt: '' });
        if (isVid) node.muted = true;
        imgs.push(node); g.append(node);
      });
      const caption = h('div', { class: 'caption', hidden: true });
      if (d.captions) g.append(caption);
      const dots = d.show_dots ? h('div', { class: 'dots' }, ids.map(() => h('i'))) : null;
      if (dots) g.append(dots);
      el.append(g);
      if (!ids.length) { el.append(h('div', { class: 'empty-slide' }, h('p', {}, 'Nincs kép kiválasztva'))); return { duration: 5 }; }
      let i = -1;
      const showImg = () => {
        const prev = i;
        i = (i + 1) % ids.length;
        if (prev >= 0 && ids.length > 1) {
          imgs[prev].classList.remove('on');
          imgs[prev].classList.add('off');
          blurs[prev]?.classList.remove('on');
          const p = imgs[prev];
          setTimeout(() => p.classList.remove('off'), 1100);
        }
        imgs[i].classList.remove('off');
        void imgs[i].offsetWidth; // animáció újraindítása
        imgs[i].classList.add('on');
        blurs[i]?.classList.add('on');
        if (imgs[i].tagName === 'VIDEO') { imgs[i].currentTime = 0; imgs[i].play().catch(() => {}); }
        if (dots) [...dots.children].forEach((dot, k) => dot.classList.toggle('on', k === i));
        const cap = d.captions?.[ids[i]];
        caption.hidden = !cap; caption.textContent = cap || '';
      };
      // A képek léptetése: videónál a videó végéig, egyébként az intervallum szerint
      const loop = () => {
        showImg();
        const v = imgs[i];
        if (v.tagName === 'VIDEO') {
          v.onended = () => { if (!d.once || i < ids.length - 1) loop(); else done(); };
        } else later(() => { if (d.once && i === ids.length - 1) done(); else loop(); }, interval * 1000);
      };
      return {
        start: loop,
        duration: s.duration || ids.length * interval,
        manual: !!d.once,
      };
    },

    video(el, s, { done }) {
      const d = s.data;
      const m = media(d.media_id);
      if (!m) { el.append(h('div', { class: 'empty-slide' }, h('p', {}, 'Nincs videó kiválasztva'))); return { duration: 5 }; }
      const v = h('video', { class: `full ${d.fit === 'cover' ? 'cover' : ''}`, src: m.url, autoplay: true, playsinline: true, preload: 'auto' });
      v.muted = d.muted !== false;
      v.loop = !!d.loop && !!s.duration;
      v.addEventListener('ended', () => { if (!v.loop) done(); });
      v.addEventListener('error', () => later(done, 2000));
      el.append(v);
      return { start: () => v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }), manual: !s.duration, destroy: () => { v.pause(); v.removeAttribute('src'); v.load(); } };
    },

    web(el, s) {
      const d = s.data;
      const zoom = (+d.zoom || 100) / 100;
      const f = h('iframe', {
        class: 'full', src: d.url, allow: 'autoplay; fullscreen',
        style: zoom !== 1 ? { width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: '0 0' } : {},
      });
      el.append(f);
      if (!d.interactive) el.append(h('div', { class: 'web-cover' }));
      if (+d.reload_sec) every(() => { f.src = d.url; }, +d.reload_sec * 1000);
    },

    pdf(el, s) {
      const m = media(s.data.media_id);
      el.append(m ? h('iframe', { class: 'full', src: `${m.url}#toolbar=0&navpanes=0&view=Fit&page=${+s.data.page || 1}` }) : h('div', { class: 'empty-slide' }, h('p', {}, 'Nincs PDF kiválasztva')));
      el.append(h('div', { class: 'web-cover' }));
    },

    html(el, s) {
      el.append(h('iframe', { class: 'htmlslide', sandbox: 'allow-scripts', srcdoc: s.data.html || '' }));
    },

    text(el, s) {
      const d = s.data;
      const org = state.cfg.org || {};
      const w = h('div', { class: `textslide align-${d.align || 'left'}`, style: { '--fs': (+d.font_scale || 100) / 100 } });
      if (d.bg_media_id && media(d.bg_media_id)) {
        const m = media(d.bg_media_id);
        w.append(m.mime.startsWith('video/') ? h('video', { class: 'bgimg', src: m.url, autoplay: true, muted: true, loop: true, playsinline: true }) : h('img', { class: 'bgimg', src: m.url }));
        if (d.shade !== false) w.append(h('div', { class: 'shade' }));
      }
      if (d.show_logo && org.logo_media_id) w.append(h('img', { class: 'logo', src: mediaUrl(org.logo_media_id) }));
      if (d.kicker) w.append(h('div', { class: 'kicker' }, d.kicker));
      if (d.title) w.append(h('h1', {}, d.title));
      if (d.body) w.append(h('div', { class: 'body' }, d.body));
      el.append(w);
      w.querySelector('video')?.play().catch(() => {});
    },

    cards(el, s) {
      const d = s.data;
      const cards = d.cards || [];
      const w = h('div', { class: 'cards-wrap' },
        d.title ? h('h1', {}, d.title) : null,
        d.subtitle ? h('p', { class: 'subtitle' }, d.subtitle) : null,
        h('div', { class: 'cards', style: { '--cols': +d.columns || Math.min(cards.length, 3) || 1 } },
          cards.map((c, i) => {
            const link = linkHandler(c);
            const img = c.media_id && mediaUrl(c.media_id);
            return h('div', {
              class: `card ${link ? 'link' : ''} ${img ? 'has-img' : ''}`,
              style: { animationDelay: `${0.12 * i + 0.2}s`, background: c.color || null, color: c.text_color || null },
              onclick: link,
            },
            img ? h('div', { class: 'cimg', style: { backgroundImage: `url("${img}")` } }) : null,
            c.badge ? h('span', { class: 'badge' }, c.badge) : null,
            c.icon ? h('div', { class: 'icon' }, c.icon) : null,
            c.title ? h('h3', {}, c.title) : null,
            c.text ? h('p', {}, c.text) : null);
          })));
      el.append(w);
    },

    menu(el, s) {
      const d = s.data;
      const btns = d.buttons || [];
      const w = h('div', { class: 'menu-wrap' });
      if (d.bg_media_id && mediaUrl(d.bg_media_id)) w.append(h('img', { class: 'bgimg', src: mediaUrl(d.bg_media_id) }));
      w.append(
        d.title ? h('h1', {}, d.title) : null,
        d.subtitle ? h('p', { class: 'subtitle' }, d.subtitle) : null,
        h('div', { class: 'menu-grid', style: { '--cols': +d.columns || Math.min(btns.length, 3) || 1 } },
          btns.map((b, i) => {
            const img = b.media_id && mediaUrl(b.media_id);
            return h('button', {
              class: 'menu-btn',
              style: { '--btn': b.color || null, '--btn-fg': b.text_color || null, animation: `cardIn .6s ${0.1 * i + 0.15}s both`, backgroundImage: img ? `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.55)), url("${img}")` : null, color: img ? '#fff' : null },
              onclick: linkHandler(b),
            }, b.icon ? h('span', { class: 'bi' }, b.icon) : null, b.label || '', b.sub ? h('small', {}, b.sub) : null);
          })),
        d.hint !== '' ? h('div', { class: 'touch-hint' }, d.hint || '👆 Érintsd meg a képernyőt') : null,
      );
      el.append(w);
    },

    calendar(el, s) {
      const d = s.data;
      const evs = [];
      for (const cid of d.calendar_ids || []) evs.push(...(state.cfg.calendars[cid] || []));
      evs.sort((a, b) => evStart(a) - evStart(b));
      const now = new Date();
      const w = h('div', { class: 'cal-wrap' },
        h('div', { class: 'cal-head' }, h('h1', {}, d.title || 'Események'), h('div', { class: 'today' }, fmtDateLong(now))));
      const view = d.view || 'list';
      const evTime = (e) => (e.all_day ? 'Egész nap' : fmtTime(evStart(e)));
      if (view === 'list') {
        const ahead = (+d.days_ahead || 14) * 864e5;
        const list = evs.filter((e) => evEnd(e) >= now && evStart(e) - now <= ahead).slice(0, +d.max_items || 8);
        const box = h('div', { class: 'cal-list' });
        let lastDay = '';
        list.forEach((e, i) => {
          const st = evStart(e), en = evEnd(e);
          const dayLabel = sameDay(st, now) ? 'Ma' : sameDay(st, new Date(now.getTime() + 864e5)) ? 'Holnap' : fmtDay(st);
          if (dayLabel !== lastDay && st > now) { box.append(h('div', { class: 'cal-day' }, dayLabel)); lastDay = dayLabel; }
          else if (st <= now && lastDay !== 'Most') { box.append(h('div', { class: 'cal-day' }, 'Most zajlik')); lastDay = 'Most'; }
          const live = st <= now && en >= now;
          box.append(h('div', { class: `cal-ev ${live ? 'now' : ''}`, style: { '--c': e.color, animationDelay: `${i * 0.08}s` } },
            h('div', { class: 'time' }, evTime(e), !e.all_day && e.end ? h('div', { class: 'meta' }, '– ' + fmtTime(en)) : null),
            h('div', {}, h('div', { class: 'title' }, e.title, live ? h('span', { class: 'live' }, 'MOST') : null),
              e.location || e.description ? h('div', { class: 'meta' }, [e.location && `📍 ${e.location}`, e.description].filter(Boolean).join(' · ').slice(0, 160)) : null)));
        });
        if (!list.length) box.append(h('div', { class: 'cal-empty' }, 'Nincs közelgő esemény 🎉'));
        w.append(box);
      } else if (view === 'week') {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const wk = h('div', { class: 'week' });
        for (let i = 0; i < 7; i++) {
          const day = new Date(start.getTime() + i * 864e5);
          const dayEvs = evs.filter((e) => evStart(e) < new Date(day.getTime() + 864e5) && evEnd(e) >= day);
          wk.append(h('div', { class: `col ${i === 0 ? 'today' : ''}` },
            h('h4', {}, `${HU_DAYS_SHORT[day.getDay()]} ${day.getDate()}.`),
            dayEvs.slice(0, 6).map((e) => h('div', { class: 'ev', style: { '--c': e.color } }, h('small', {}, evTime(e)), e.title))));
        }
        w.append(wk);
      } else {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const offset = (first.getDay() + 6) % 7;
        const grid = h('div', { class: 'month' }, ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((x) => h('div', { class: 'dow' }, x)));
        w.querySelector('h1').textContent = `${d.title || 'Események'} – ${HU_MONTHS[now.getMonth()]}`;
        for (let i = 0; i < 42; i++) {
          const day = new Date(now.getFullYear(), now.getMonth(), 1 - offset + i);
          const dayEvs = evs.filter((e) => evStart(e) < new Date(day.getTime() + 864e5) && evEnd(e) >= day);
          grid.append(h('div', { class: `cell ${day.getMonth() !== now.getMonth() ? 'other' : ''} ${sameDay(day, now) ? 'today' : ''}` },
            h('b', {}, day.getDate()), dayEvs.slice(0, 3).map((e) => h('span', { class: 'chip', style: { '--c': e.color } }, e.title)),
            dayEvs.length > 3 ? h('span', {}, `+${dayEvs.length - 3}`) : null));
        }
        w.append(grid);
      }
      el.append(w);
    },

    form(el, s) {
      const form = state.cfg.forms[s.data.form_id];
      if (!form) { el.append(h('div', { class: 'empty-slide' }, h('p', {}, 'Az űrlap nem található'))); return; }
      const values = {};
      const wrap = h('div', { class: 'form-wrap' });
      const err = h('div', { class: 'err' });
      const fieldEl = (f) => {
        const id = 'f_' + f.key;
        const lab = h('label', { for: id }, f.label, f.required ? h('span', { class: 'req' }, ' *') : null);
        const wide = ['textarea', 'choice', 'rating', 'smiley', 'checkbox'].includes(f.type) || f.wide;
        switch (f.type) {
          case 'textarea':
            return h('div', { class: 'f wide' }, lab, h('textarea', { id, name: f.key, placeholder: f.placeholder || '' }));
          case 'select':
            return h('div', { class: `f ${wide ? 'wide' : ''}` }, lab, h('select', { id, name: f.key }, h('option', { value: '' }, '— válassz —'), (f.options || []).map((o) => h('option', { value: o }, o))));
          case 'choice': {
            const box = h('div', { class: 'choices' });
            (f.options || []).forEach((o) => box.append(h('button', { type: 'button', class: 'choice', onclick: (e) => {
              values[f.key] = o; [...box.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget));
            } }, o)));
            return h('div', { class: 'f wide' }, lab, box);
          }
          case 'rating':
          case 'smiley': {
            const icons = f.type === 'smiley' ? ['😞', '🙁', '😐', '🙂', '😍'] : ['★', '★', '★', '★', '★'];
            const box = h('div', { class: `rating ${f.type === 'smiley' ? 'smile' : ''}` });
            icons.forEach((ic, i) => box.append(h('button', { type: 'button', onclick: () => {
              values[f.key] = i + 1;
              [...box.children].forEach((b, k) => b.classList.toggle('on', f.type === 'smiley' ? k === i : k <= i));
            } }, ic)));
            return h('div', { class: 'f wide' }, lab, box);
          }
          case 'checkbox':
            return h('label', { class: 'f wide check' }, h('input', { type: 'checkbox', name: f.key }), f.label, f.required ? h('span', { class: 'req' }, ' *') : null);
          default: {
            const mode = { email: 'email', tel: 'tel', number: 'numeric' }[f.type] || 'text';
            return h('div', { class: `f ${wide ? 'wide' : ''}` }, lab, h('input', { id, name: f.key, type: 'text', inputmode: mode, autocomplete: 'off', placeholder: f.placeholder || '' }));
          }
        }
      };
      const formEl = h('form', { novalidate: true }, form.fields.map(fieldEl), err, h('button', { type: 'submit', class: 'submit' }, form.submit_text || 'Küldés'));
      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideKeyboard();
        const data = { ...values };
        for (const f of form.fields) {
          const inp = formEl.elements[f.key];
          if (!inp) continue;
          data[f.key] = f.type === 'checkbox' ? inp.checked : inp.value;
        }
        for (const f of form.fields) {
          const v = data[f.key];
          if (f.required && (v == null || v === '' || v === false)) { err.textContent = `Kérjük, töltsd ki: ${f.label}`; return; }
          if (f.type === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { err.textContent = `Érvénytelen e-mail cím: ${f.label}`; return; }
        }
        err.textContent = 'Küldés…';
        try {
          if (PREVIEW) await new Promise((r) => setTimeout(r, 400));
          else await api(`/api/player/forms/${form.id}`, { method: 'POST', body: JSON.stringify({ device: DEVICE, data }) });
          wrap.replaceChildren(h('div', { class: 'form-thanks' }, h('div', { class: 'ok' }, '✓'), h('h2', {}, form.thanks_text || 'Köszönjük!')));
          later(() => { if (state.stack.length) goHome(); else advance(); }, 6000);
        } catch (ex) {
          err.textContent = ex.status ? ex.message : 'Nincs kapcsolat a szerverrel, próbáld újra később.';
        }
      });
      wrap.append(h('h1', {}, form.title), form.intro ? h('p', { class: 'subtitle' }, form.intro) : null, formEl);
      el.append(wrap);
      return { duration: s.duration || 30 };
    },

    clock(el, s) {
      const d = s.data;
      const w = h('div', { class: 'clock-wrap' });
      const isAnalog = d.style === 'analog';
      const big = isAnalog ? analogClock() : h('div', { class: 'big' });
      const date = h('div', { class: 'date' });
      const wx = h('div', { class: 'wx' });
      w.append(big.el || big, d.show_date !== false ? date : null, d.title ? h('div', { class: 'nameday' }, d.title) : null, wx);
      el.append(w);
      const tick = () => {
        const n = new Date();
        if (isAnalog) big.set(n);
        else big.innerHTML = `${pad(n.getHours())}:${pad(n.getMinutes())}${d.show_seconds ? `<span class="sec">:${pad(n.getSeconds())}</span>` : ''}`;
        date.textContent = fmtDateLong(n);
      };
      tick(); every(tick, 1000);
      if (d.show_weather !== false && d.lat != null && d.lon != null) loadWeather(d, wx);
    },

    rss(el, s) {
      const d = s.data;
      const w = h('div', { class: 'rss-wrap' }, h('h1', {}, d.title || 'Hírek'));
      const box = h('div', { style: { flex: 1, display: 'flex' } });
      w.append(box); el.append(w);
      const per = Math.max(4, +d.per_item || 8);
      const max = +d.max || 5;
      api(`/api/player/rss?url=${encodeURIComponent(d.url)}`).then((feed) => {
        LS.set('rss:' + d.url, feed);
        run(feed);
      }).catch(() => run(LS.get('rss:' + d.url, { items: [] })));
      function run(feed) {
        const items = feed.items.slice(0, max);
        if (!d.title && feed.title) w.firstChild.textContent = feed.title;
        if (!items.length) { box.append(h('div', { class: 'cal-empty' }, 'A hírfolyam nem érhető el')); return; }
        let i = 0;
        const one = () => {
          const it = items[i++ % items.length];
          const dt = it.date ? new Date(it.date) : null;
          box.replaceChildren(h('div', { class: `rss-item ${it.image && d.show_images !== false ? '' : 'noimg'}` },
            it.image && d.show_images !== false ? h('div', { class: 'img', style: { backgroundImage: `url("${it.image}")` } }) : null,
            h('div', {}, dt && !isNaN(dt) ? h('div', { class: 'date' }, `${fmtDay(dt)} ${fmtTime(dt)}`) : null, h('h2', {}, it.title), h('p', {}, it.summary))));
        };
        one(); every(one, per * 1000);
      }
      return { duration: s.duration || per * max };
    },

    countdown(el, s) {
      const d = s.data;
      const target = new Date(d.target);
      const units = h('div', { class: 'units' });
      const w = h('div', { class: 'countdown' }, h('h1', {}, d.title || 'Visszaszámlálás'), units, d.subtitle ? h('p', { class: 'subtitle' }, d.subtitle) : null);
      el.append(w);
      const tick = () => {
        let diff = Math.max(0, target - Date.now()) / 1000;
        if (!diff) { units.replaceChildren(h('div', { class: 'done' }, d.done_text || 'Elkezdődött! 🎉')); return; }
        const parts = [['nap', Math.floor(diff / 86400)], ['óra', Math.floor(diff / 3600) % 24], ['perc', Math.floor(diff / 60) % 60], ['mp', Math.floor(diff) % 60]];
        units.replaceChildren(...parts.map(([l, v]) => h('div', { class: 'u' }, h('b', {}, pad(v)), h('span', {}, l))));
      };
      tick(); every(tick, 1000);
    },

    qr(el, s) {
      const d = s.data;
      const canvas = h('canvas');
      try { drawQr(canvas, d.url || ' '); } catch { /* túl hosszú */ }
      el.append(h('div', { class: 'qr-wrap' }, canvas,
        h('div', {}, h('h1', {}, d.title || 'Olvasd be!'), d.text ? h('p', {}, d.text) : null, d.show_url !== false ? h('p', { class: 'url' }, d.url) : null)));
    },

    unknown(el, s) {
      el.append(h('div', { class: 'empty-slide' }, h('p', {}, `Ismeretlen tartalomtípus: ${s.type}`)));
    },
  };

  function analogClock() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '-100 -100 200 200');
    svg.setAttribute('class', 'analog');
    let marks = '<circle r="96" style="fill:var(--surface)" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/>';
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 * Math.PI) / 180, r1 = i % 5 ? 88 : 80;
      marks += `<line x1="${Math.sin(a) * r1}" y1="${-Math.cos(a) * r1}" x2="${Math.sin(a) * 92}" y2="${-Math.cos(a) * 92}" stroke="currentColor" stroke-opacity="${i % 5 ? 0.35 : 1}" stroke-width="${i % 5 ? 1 : 3}"/>`;
    }
    svg.innerHTML = marks + '<line id="hh" y2="-48" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><line id="mm" y2="-72" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><line id="ss" y1="14" y2="-82" style="stroke:var(--accent)" stroke-width="2"/><circle r="5" style="fill:var(--accent)"/>';
    return {
      el: svg,
      set(n) {
        const s = n.getSeconds(), m = n.getMinutes() + s / 60, hr = (n.getHours() % 12) + m / 60;
        svg.querySelector('#hh').setAttribute('transform', `rotate(${hr * 30})`);
        svg.querySelector('#mm').setAttribute('transform', `rotate(${m * 6})`);
        svg.querySelector('#ss').setAttribute('transform', `rotate(${s * 6})`);
      },
    };
  }

  const WX = {
    0: ['☀️', 'Derült'], 1: ['🌤️', 'Túlnyomóan derült'], 2: ['⛅', 'Részben felhős'], 3: ['☁️', 'Borult'], 45: ['🌫️', 'Köd'], 48: ['🌫️', 'Zúzmarás köd'],
    51: ['🌦️', 'Szitálás'], 53: ['🌦️', 'Szitálás'], 55: ['🌧️', 'Erős szitálás'], 56: ['🌧️', 'Ónos szitálás'], 57: ['🌧️', 'Ónos szitálás'],
    61: ['🌧️', 'Gyenge eső'], 63: ['🌧️', 'Eső'], 65: ['🌧️', 'Erős eső'], 66: ['🌧️', 'Ónos eső'], 67: ['🌧️', 'Ónos eső'],
    71: ['🌨️', 'Gyenge havazás'], 73: ['🌨️', 'Havazás'], 75: ['❄️', 'Erős havazás'], 77: ['🌨️', 'Hószemcse'],
    80: ['🌦️', 'Zápor'], 81: ['🌧️', 'Zápor'], 82: ['⛈️', 'Heves zápor'], 85: ['🌨️', 'Hózápor'], 86: ['🌨️', 'Hózápor'],
    95: ['⛈️', 'Zivatar'], 96: ['⛈️', 'Zivatar jégesővel'], 99: ['⛈️', 'Zivatar jégesővel'],
  };
  async function loadWeather(d, box) {
    const key = `wx:${d.lat},${d.lon}`;
    let j;
    try { j = await api(`/api/player/weather?lat=${d.lat}&lon=${d.lon}`); LS.set(key, j); } catch { j = LS.get(key); }
    if (!j?.current) return;
    const c = j.current;
    const [ic, desc] = WX[c.weather_code] || ['🌡️', ''];
    const icon = c.is_day === 0 && c.weather_code <= 1 ? '🌙' : ic;
    box.replaceChildren(h('div', { class: 'now' }, h('div', { class: 'ic' }, icon),
      h('div', {}, h('div', { class: 't' }, `${Math.round(c.temperature_2m)}°`), h('div', { class: 'd' }, `${d.city || ''} · ${desc}`), h('div', { class: 'd' }, `💧 ${c.relative_humidity_2m}%  💨 ${Math.round(c.wind_speed_10m)} km/h`))));
    if (d.show_forecast !== false && j.daily) {
      j.daily.time.slice(1, 5).forEach((t, i) => {
        const dd = new Date(t);
        box.append(h('div', { class: 'day' }, h('div', {}, HU_DAYS_SHORT[dd.getDay()]), h('div', { class: 'ic' }, (WX[j.daily.weather_code[i + 1]] || ['🌡️'])[0]),
          h('div', {}, `${Math.round(j.daily.temperature_2m_max[i + 1])}° / ${Math.round(j.daily.temperature_2m_min[i + 1])}°`)));
      });
    }
  }

  // ------------------------------------------------------------------
  //  QR kód generátor (bájt mód, M hibajavítás) – külső könyvtár nélkül
  // ------------------------------------------------------------------
  const QR = (() => {
    const ECC_LEN = { L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28] };
    const BLOCKS = { L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
      M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49] };
    const FMT = { L: 1, M: 0 };
    const rawModules = (v) => {
      let r = (16 * v + 128) * v + 64;
      if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
      return r;
    };
    const dataCodewords = (v, e) => Math.floor(rawModules(v) / 8) - ECC_LEN[e][v] * BLOCKS[e][v];
    const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z; };
    const divisor = (deg) => {
      const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
      for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = mul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = mul(root, 2); }
      return r;
    };
    const remainder = (data, div) => {
      const r = div.map(() => 0);
      for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); }
      return r;
    };
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];

    return function encode(text, ecl = 'M') {
      const data = new TextEncoder().encode(text);
      let ver = 1, cap = 0;
      for (; ver <= 40; ver++) { cap = dataCodewords(ver, ecl) * 8; if (4 + (ver < 10 ? 8 : 16) + data.length * 8 <= cap) break; }
      if (ver > 40) throw new Error('Túl hosszú szöveg a QR kódhoz');
      const bits = [];
      const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      push(4, 4); push(data.length, ver < 10 ? 8 : 16); data.forEach((b) => push(b, 8));
      push(0, Math.min(4, cap - bits.length)); push(0, (8 - (bits.length % 8)) % 8);
      for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) push(p, 8);
      const cw = [];
      for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; cw.push(v); }
      // hibajavító blokkok és átfésülés
      const nb = BLOCKS[ecl][ver], el = ECC_LEN[ecl][ver], raw = Math.floor(rawModules(ver) / 8);
      const nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb), div = divisor(el);
      const blocks = [];
      for (let i = 0, k = 0; i < nb; i++) {
        const dat = cw.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length;
        const ecc = remainder(dat, div);
        if (i < nShort) dat.push(0);
        blocks.push(dat.concat(ecc));
      }
      const all = [];
      for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) all.push(b[i]); });

      const size = ver * 4 + 17;
      const mod = Array.from({ length: size }, () => new Array(size).fill(false));
      const fn = Array.from({ length: size }, () => new Array(size).fill(false));
      const set = (x, y, v) => { mod[y][x] = v; fn[y][x] = true; };
      for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
      const finder = (cx, cy) => {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, dist !== 2 && dist !== 4);
        }
      };
      finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
      const align = [];
      if (ver > 1) {
        const n = Math.floor(ver / 7) + 2, step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
        align.push(6);
        for (let pos = size - 7; align.length < n; pos -= step) align.splice(1, 0, pos);
      }
      align.forEach((ax, i) => align.forEach((ay, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }));
      const drawFormat = (mask) => {
        const d = (FMT[ecl] << 3) | mask;
        let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412, g = (i) => ((b >>> i) & 1) !== 0;
        for (let i = 0; i <= 5; i++) set(8, i, g(i));
        set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
        for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
        for (let i = 0; i < 8; i++) set(size - 1 - i, 8, g(i));
        for (let i = 8; i < 15; i++) set(8, size - 15 + i, g(i));
        set(8, size - 8, true);
      };
      drawFormat(0);
      if (ver >= 7) {
        let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
        const b = (ver << 12) | r;
        for (let i = 0; i < 18; i++) { const c = ((b >>> i) & 1) !== 0, a = size - 11 + (i % 3), bb = Math.floor(i / 3); set(a, bb, c); set(bb, a, c); }
      }
      let bi = 0;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
          const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
          if (!fn[y][x] && bi < all.length * 8) { mod[y][x] = ((all[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
        }
      }
      // maszk kiválasztása egyszerűsített büntetőpontokkal
      const applyMask = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x]; };
      const penalty = () => {
        let p = 0, dark = 0;
        for (let y = 0; y < size; y++) {
          let rx = 1, ry = 1;
          for (let x = 0; x < size; x++) {
            if (mod[y][x]) dark++;
            if (x > 0) {
              if (mod[y][x] === mod[y][x - 1]) { rx++; if (rx === 5) p += 3; else if (rx > 5) p++; } else rx = 1;
              if (mod[x][y] === mod[x - 1][y]) { ry++; if (ry === 5) p += 3; else if (ry > 5) p++; } else ry = 1;
            }
            if (x < size - 1 && y < size - 1 && mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) p += 3;
          }
        }
        return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      };
      let best = 0, bestP = Infinity;
      for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } applyMask(m); }
      applyMask(best); drawFormat(best);
      return mod;
    };
  })();

  function drawQr(canvas, text) {
    const m = QR(text);
    const n = m.length, q = 4, sc = Math.max(4, Math.floor(600 / (n + q * 2)));
    canvas.width = canvas.height = (n + q * 2) * sc;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m[y][x]) ctx.fillRect((x + q) * sc, (y + q) * sc, sc, sc);
  }
  window.__signageQR = QR; // teszteléshez

  // ------------------------------------------------------------------
  //  Virtuális billentyűzet érintőképernyőkhöz
  // ------------------------------------------------------------------
  const KB_ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'ö', 'ü', 'ó'],
    ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ő', 'ú'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'é', 'á', 'ű'],
    ['⇧', 'í', 'y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '-', '⌫'],
    ['@', '.hu', '.com', ' ', '✓'],
  ];
  let kbTarget = null, kbShift = false;
  const kb = $('#keyboard');
  function renderKeyboard() {
    kb.replaceChildren(...KB_ROWS.map((row) => h('div', { class: 'row' }, row.map((k) => {
      const cls = k === ' ' ? 'space' : k === '✓' ? 'wide act' : ['⇧', '⌫', '.com', '.hu'].includes(k) ? `wide ${k === '⇧' && kbShift ? 'on' : ''}` : '';
      const label = k === ' ' ? 'szóköz' : k === '✓' ? 'Kész' : kbShift && k.length === 1 ? k.toUpperCase() : k;
      return h('button', { type: 'button', class: cls, 'data-k': k }, label);
    }))));
  }
  kb.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // a fókusz maradjon a mezőn
    e.stopPropagation(); // újrarajzoláskor a leválasztott gomb ne számítson „kívülre kattintásnak”
    const b = e.target.closest('button');
    if (!b || !kbTarget) return;
    const k = b.dataset.k;
    if (k === '⇧') { kbShift = !kbShift; renderKeyboard(); return; }
    if (k === '✓') { hideKeyboard(); return; }
    const t = kbTarget;
    const s = t.selectionStart ?? t.value.length, en = t.selectionEnd ?? t.value.length;
    if (k === '⌫') {
      if (s === en && s > 0) t.setRangeText('', s - 1, s, 'end'); else t.setRangeText('', s, en, 'end');
    } else {
      t.setRangeText(kbShift && k.length === 1 ? k.toUpperCase() : k, s, en, 'end');
      if (kbShift) { kbShift = false; renderKeyboard(); }
    }
    t.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (settings().virtual_keyboard === false) return;
    if (!t.matches?.('.form-wrap input:not([type=checkbox]), .form-wrap textarea')) return;
    kbTarget = t;
    kbShift = !t.value && t.getAttribute('inputmode') === 'text';
    renderKeyboard();
    kb.hidden = false;
    t.closest('.form-wrap')?.classList.add('kb-open');
    setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  });
  function hideKeyboard() {
    kb.hidden = true;
    document.querySelector('.kb-open')?.classList.remove('kb-open');
    kbTarget?.blur();
    kbTarget = null;
  }
  document.addEventListener('pointerdown', (e) => {
    if (!kb.hidden && !kb.contains(e.target) && e.target !== kbTarget && !e.target.matches?.('input, textarea')) hideKeyboard();
  });

  // ------------------------------------------------------------------
  //  Átfedések: óra, hírszalag, riasztások, tájolás, kikapcsolás
  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  //  Arculat: színek, betűk, lekerekítés, logó vízjel, fejléc sáv
  // ------------------------------------------------------------------
  const COLOR_VARS = { accent: '--accent', accent_fg: '--accent-fg', bg: '--bg', bg2: '--bg2', fg: '--fg', surface: '--surface', muted: '--muted' };
  function applyBranding() {
    const T = window.SIGNAGE_THEMES;
    if (!T || !state.cfg) return;
    const org = state.cfg.org || {};
    const b = org.branding || {};
    const r = T.resolve(b, settings().theme || '');
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(r.colors)) if (COLOR_VARS[k]) root.setProperty(COLOR_VARS[k], v);
    root.setProperty('--font', (T.FONTS[r.font] || T.FONTS.system).css);
    root.setProperty('--font-head', (T.FONTS[r.head_font] || T.FONTS[r.font] || T.FONTS.system).css);
    root.setProperty('--radius', (T.RADIUS[r.radius] || T.RADIUS.round).v);
    // Google betűk (ha van internet; különben a tartalék betűtípus marad)
    const fams = [...new Set([r.font, r.head_font])].map((f) => T.FONTS[f]?.google).filter(Boolean);
    let link = document.getElementById('brand-fonts');
    const href = fams.length ? `https://fonts.googleapis.com/css2?${fams.map((f) => `family=${f}`).join('&')}&display=swap` : '';
    if (href && (!link || link.href !== href)) {
      if (!link) { link = h('link', { rel: 'stylesheet', id: 'brand-fonts' }); document.head.append(link); }
      link.href = href;
    } else if (!href && link) link.remove();
    renderBrandChrome(org, b);
  }

  function renderBrandChrome(org, b) {
    const logo = org.logo_media_id && mediaUrl(org.logo_media_id);
    // logó vízjel a sarokban
    const wm = $('#brand-logo');
    const corner = b.logo_corner || 'none';
    wm.hidden = !logo || corner === 'none';
    if (!wm.hidden) {
      wm.src = logo;
      wm.className = `corner-${corner}`;
      wm.style.height = `${+b.logo_size || 9}vmin`;
      wm.style.opacity = String((+b.logo_opacity || 90) / 100);
    }
    // fejléc sáv
    const hd = b.header || {};
    const bar = $('#brand-header');
    bar.hidden = !hd.enabled;
    document.body.classList.toggle('has-header', !!hd.enabled);
    if (!hd.enabled) return;
    bar.className = `hstyle-${hd.style || 'surface'}`;
    const title = hd.title || org.name || '';
    const sub = hd.subtitle ?? org.slogan ?? '';
    bar.replaceChildren(
      hd.show_logo !== false && logo ? h('img', { class: 'hlogo', src: logo }) : null,
      h('div', { class: 'htext' }, title ? h('div', { class: 'htitle' }, title) : null, sub ? h('div', { class: 'hsub' }, sub) : null),
      hd.show_clock !== false ? h('div', { class: 'hclock' }, h('b'), h('span')) : null);
    tickHeader();
  }
  function tickHeader() {
    const c = document.querySelector('#brand-header .hclock');
    if (!c) return;
    const n = new Date();
    c.firstChild.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    c.lastChild.textContent = `${HU_MONTHS[n.getMonth()]} ${n.getDate()}., ${HU_DAYS[n.getDay()]}`;
  }

  // Admin arculat-szerkesztő élő előnézete: a még nem mentett beállítások azonnal látszanak
  if (PREVIEW) window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !state.cfg) return;
    const m = e.data || {};
    if (m.type === 'branding') {
      state.cfg.org = { ...state.cfg.org, ...m.org };
      state.cfg.media = { ...state.cfg.media, ...(m.media || {}) };
      if (m.theme !== undefined) state.cfg.screen.settings = { ...state.cfg.screen.settings, theme: m.theme };
      applyOverlays();
      if (state.current?.slide?.type === 'text') { state.index--; next(); } // a logó újrarajzolásához
    } else if (m.type === 'nav') { state.interactUntil = 0; next(m.step || 1); }
  });

  function applyOverlays() {
    applyBranding();
    const st = settings();
    const rotor = $('#rotor');
    rotor.className = { portrait: 'rot-90', 'portrait-flipped': 'rot-270', 'landscape-flipped': 'rot-180' }[st.orientation] || '';
    const clock = $('#overlay-clock');
    clock.hidden = !st.show_clock;
    const lines = String(st.ticker || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const ticker = $('#ticker');
    ticker.hidden = !lines.length;
    document.body.classList.toggle('has-ticker', !!lines.length);
    if (lines.length) {
      const track = ticker.querySelector('.ticker-track');
      const sig = lines.join('|');
      if (track.dataset.sig !== sig) {
        track.dataset.sig = sig;
        track.replaceChildren(...lines.map((l) => h('span', {}, l)));
        const len = lines.join('').length;
        track.style.setProperty('--tick', `${Math.max(15, len * (0.25 / ((+st.ticker_speed || 100) / 100)))}s`);
      }
      if (st.ticker_color) ticker.style.background = st.ticker_color;
    }
    if (st.accent) document.documentElement.style.setProperty('--accent', st.accent);
    renderAlerts();
  }
  setInterval(() => {
    const n = new Date();
    $('#overlay-clock').textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}`;
    if (n.getSeconds() === 0) tickHeader();
  }, 1000);

  const ALERT_ICONS = { info: 'ℹ️', success: '✅', warning: '⚠️', danger: '🚨' };
  function renderAlerts() {
    const box = $('#alerts');
    const list = (state.cfg?.alerts || []).filter((a) => !a.expires_at || a.expires_at > Date.now());
    const a = list[0];
    const sig = a ? `${a.id}` : '';
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.replaceChildren(a ? h('div', { class: `alert ${a.level}` }, h('div', { class: 'ai' }, ALERT_ICONS[a.level] || 'ℹ️'), a.title ? h('h1', {}, a.title) : null, h('p', {}, a.message)) : '');
    if (a?.expires_at) setTimeout(renderAlerts, a.expires_at - Date.now() + 500);
  }

  function checkPower() {
    const off = screenIsOff();
    $('#blank').hidden = !off;
    const v = state.current?.el?.querySelector('video');
    if (off && v && !v.paused) v.pause();
  }

  function identify(sec = 10) {
    const el = $('#identify');
    el.replaceChildren(state.cfg?.screen?.name || 'Képernyő', h('small', {}, `Eszköz: ${DEVICE.slice(0, 8)} · ${screen.width}×${screen.height}`));
    el.hidden = false;
    setTimeout(() => { el.hidden = true; }, sec * 1000);
  }

  // ------------------------------------------------------------------
  //  Kapcsolat a szerverrel
  // ------------------------------------------------------------------
  function track(slideId, kind) {
    if (PREVIEW || !slideId) return;
    state.stats.push({ slide_id: slideId, kind, t: Date.now() });
    if (state.stats.length > 1000) state.stats.splice(0, 500);
  }

  function applyConfig(cfg, fromCache = false) {
    const changed = !state.cfg || state.cfg.version !== cfg.version;
    state.cfg = cfg;
    if (!fromCache && !PREVIEW) LS.set('config:' + DEVICE, cfg);
    $('#pairing').hidden = true;
    showStatus(null);
    applyOverlays();
    // folyamatjelző 100%, majd az első tartalom (ami már a háttérben rajzolódik) előtűnik
    const bb = document.querySelector('#boot .bbar i');
    if (bb) { bb.style.width = '100%'; document.querySelector('#boot .btxt').textContent = 'Kész'; }
    setTimeout(hideBoot, 500);
    if (changed) {
      if (state.current?.slide && cfg.slides[state.current.slide.id] && JSON.stringify(cfg.slides[state.current.slide.id]) !== JSON.stringify(state.current.slide)) {
        // az éppen látható dia megváltozott → azonnal újrarajzoljuk
        state.itemsSig = null;
        state.index--;
      }
      state.stack = []; updateNav();
      loadPlaylist(true);
      precache(cfg);
    }
  }

  function precache(cfg) {
    if (!('caches' in window) || PREVIEW) return;
    const urls = Object.values(cfg.media || {}).map((m) => m.url);
    caches.open('signage-media').then(async (c) => {
      for (const u of urls) { if (!(await c.match(u))) c.add(u).catch(() => {}); }
    }).catch(() => {});
  }

  async function fetchConfig() {
    const url = PREVIEW ? `/api/preview?${PREVIEW.replace(':', '=')}` : `/api/player/config?device=${DEVICE}`;
    try {
      const cfg = await api(url);
      setOnline(true);
      if (!cfg.paired) { showPairing(cfg.code); return; }
      applyConfig(cfg);
    } catch (e) {
      if (e.status === 404 && !PREVIEW) { await hello(); return; }
      setOnline(false);
      if (!state.cfg) { const cached = LS.get('config:' + DEVICE); if (cached) applyConfig(cached, true); }
    }
  }

  function setOnline(on) {
    state.online = on;
    $('#offline').hidden = on || PREVIEW;
  }

  function showPairing(code) {
    state.cfg = null;
    clearTimeout(state.timer);
    $('#stage').replaceChildren();
    showStatus(null);
    hideBoot();
    $('#pairing').hidden = false;
    $('#pair-code').textContent = code;
    $('#pair-url').textContent = `${location.origin}/admin/`;
    $('#pair-info').textContent = `Eszköz: ${DEVICE.slice(0, 8)} · ${screen.width}×${screen.height}`;
  }

  async function hello() {
    try {
      const r = await api('/api/player/hello', {
        method: 'POST',
        body: JSON.stringify({ device: DEVICE, info: { ua: navigator.userAgent, w: screen.width, h: screen.height, platform: navigator.platform, lang: navigator.language } }),
      });
      setOnline(true);
      showStatus(null);
      if (!r.paired) showPairing(r.code);
      return r;
    } catch (e) {
      setOnline(false);
      state.lastError = e.status ? `${e.status}: ${e.message}` : 'a szerver nem érhető el';
      return null;
    }
  }

  // Regisztráció újrapróbálása, amíg a szerver el nem érhető (pl. a hálózat később áll fel)
  async function helloUntilOk() {
    for (let attempt = 1; ; attempt++) {
      const r = await hello();
      if (r) return r;
      // az első sikertelen próbánál még a logós indulókép marad, utána kiírjuk a hibát
      if (!state.cfg && attempt >= 2) showStatus('Kapcsolódás a szerverhez…', `${location.origin} – ${state.lastError} (${attempt}. próbálkozás, újra 5 mp múlva)`);
      await new Promise((ok) => setTimeout(ok, 5000));
    }
  }

  function hideBoot() {
    const b = $('#boot');
    if (!b || b.classList.contains('gone')) return;
    b.classList.add('gone');
    setTimeout(() => b.remove(), 700);
  }

  function showStatus(title, detail) {
    if (title) hideBoot();
    const el = $('#status');
    if (!title) { el.hidden = true; return; }
    $('#status-title').textContent = title;
    $('#status-detail').textContent = detail || '';
    $('#status-info').textContent = `Eszköz: ${DEVICE.slice(0, 14)} · ${screen.width}×${screen.height}`;
    el.hidden = false;
  }

  function connectStream() {
    if (PREVIEW || !window.EventSource) return;
    const es = new EventSource(`/api/player/stream?device=${DEVICE}`);
    es.addEventListener('hello', () => { setOnline(true); fetchConfig(); });
    es.addEventListener('refresh', () => fetchConfig());
    es.addEventListener('alerts', () => fetchConfig());
    es.addEventListener('unpaired', () => { LS.set('config:' + DEVICE, null); location.reload(); });
    es.addEventListener('command', (e) => {
      const { command, args } = JSON.parse(e.data || '{}');
      if (command === 'reload') location.reload();
      else if (command === 'identify') identify();
      else if (command === 'next') { state.interactUntil = 0; next(1); }
      else if (command === 'prev') { state.interactUntil = 0; next(-1); }
      else if (command === 'goto' && args?.slide_id) goTo(+args.slide_id);
      else if (command === 'refresh') { state.cfg && (state.cfg.version = 'x'); fetchConfig(); }
      else if (command === 'diag') sendDiag();
      else if (command === 'clear-cache') { caches?.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).finally(() => location.reload()); }
    });
    es.onerror = () => {
      setOnline(false);
      if (es.readyState === EventSource.CLOSED) setTimeout(async () => { await helloUntilOk(); connectStream(); }, 5000);
    };
  }

  // Távoli diagnosztika: megjelenítési állapot visszaküldése (párosítás nélkül is)
  async function sendDiag() {
    let frames = 0;
    const t0 = performance.now();
    await new Promise((done) => {
      const tick = () => { frames++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else done(); };
      requestAnimationFrame(tick);
      setTimeout(done, 1500);
    });
    const diag = {
      t: new Date().toISOString(), visibility: document.visibilityState, hidden: document.hidden, focus: document.hasFocus(),
      inner: `${innerWidth}x${innerHeight}`, outer: `${outerWidth}x${outerHeight}`, screen: `${screen.width}x${screen.height}`, dpr: devicePixelRatio,
      raf_fps: frames, pairing_visible: !$('#pairing').hidden, status_visible: !$('#status').hidden, code: $('#pair-code').textContent,
      fullscreen: !!document.fullscreenElement, sw: !!navigator.serviceWorker?.controller, ua: navigator.userAgent,
    };
    await api('/api/player/heartbeat', { method: 'POST', body: JSON.stringify({ device: DEVICE, info: { diag } }) }).catch(() => {});
  }

  async function heartbeat() {
    if (PREVIEW || !state.cfg) return;
    const stats = state.stats.splice(0);
    try {
      await api('/api/player/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ device: DEVICE, stats, current: state.current?.slide ? { id: state.current.slide.id, name: state.current.slide.name, type: state.current.slide.type } : null, info: { w: screen.width, h: screen.height, uptime: Math.round(performance.now() / 1000), offline_cache: 'caches' in window } }),
      });
      setOnline(true);
    } catch {
      state.stats.unshift(...stats);
      setOnline(false);
    }
  }

  // ------------------------------------------------------------------
  //  Indítás
  // ------------------------------------------------------------------
  async function boot() {
    if (PREVIEW) $('#boot')?.remove(); // az admin előnézetben nem kell indulási kép
    if ('serviceWorker' in navigator && !PREVIEW) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (!PREVIEW) {
      const cached = LS.get('config:' + DEVICE);
      if (cached) applyConfig(cached, true); // offline indulás: a tárolt tartalom azonnal megy
      await helloUntilOk();
      connectStream();
    }
    await fetchConfig();
    setInterval(() => { if (state.cfg) { loadPlaylist(); checkPower(); renderAlerts(); } }, 20000);
    setInterval(fetchConfig, PREVIEW ? 60000 : 5 * 60000);
    setInterval(heartbeat, 30000);
    setTimeout(heartbeat, 3000);
    // Napi egyszeri újratöltés hajnalban a memóriaszivárgások ellen
    if (!PREVIEW) setInterval(() => { const n = new Date(); if (n.getHours() === 4 && n.getMinutes() === 0 && performance.now() > 3600e3) location.reload(); }, 50000);
    checkPower();
  }

  window.addEventListener('keydown', (e) => {
    if (e.target.matches?.('input, textarea, select')) return;
    if (e.key === 'ArrowRight') next(1);
    if (e.key === 'ArrowLeft') next(-1);
    if (e.key === 'i') identify(4);
  });

  boot();
})();
