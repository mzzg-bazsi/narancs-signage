/* Narancs Signage – arculati témák (az admin és a lejátszó közösen használja) */
(function () {
  'use strict';

  // Betűtípusok: rendszer betűkészlet vagy Google Fonts (internet nélkül a tartalék betűtípus jelenik meg)
  const FONTS = {
    system: { name: 'Rendszer (alap)', css: '"Inter", "Segoe UI", "Roboto", "Noto Sans", "DejaVu Sans", system-ui, sans-serif' },
    inter: { name: 'Inter', css: '"Inter", "Segoe UI", system-ui, sans-serif', google: 'Inter:wght@300;400;600;700;800' },
    montserrat: { name: 'Montserrat', css: '"Montserrat", "Segoe UI", system-ui, sans-serif', google: 'Montserrat:wght@300;400;600;700;800' },
    poppins: { name: 'Poppins', css: '"Poppins", "Segoe UI", system-ui, sans-serif', google: 'Poppins:wght@300;400;600;700;800' },
    nunito: { name: 'Nunito', css: '"Nunito", "Segoe UI", system-ui, sans-serif', google: 'Nunito:wght@300;400;600;700;800' },
    roboto: { name: 'Roboto', css: '"Roboto", "Segoe UI", system-ui, sans-serif', google: 'Roboto:wght@300;400;500;700;900' },
    raleway: { name: 'Raleway', css: '"Raleway", "Segoe UI", system-ui, sans-serif', google: 'Raleway:wght@300;400;600;700;800' },
    oswald: { name: 'Oswald', css: '"Oswald", "Arial Narrow", system-ui, sans-serif', google: 'Oswald:wght@300;400;500;600;700' },
    playfair: { name: 'Playfair Display (talpas)', css: '"Playfair Display", Georgia, serif', google: 'Playfair+Display:wght@400;600;700;800' },
    lora: { name: 'Lora (talpas)', css: '"Lora", Georgia, serif', google: 'Lora:wght@400;500;600;700' },
  };

  const RADIUS = { sharp: { name: 'Szögletes', v: '0.4vmin' }, soft: { name: 'Lágy', v: '1.4vmin' }, round: { name: 'Kerek', v: '2.6vmin' } };

  // Színkulcsok: accent = kiemelő szín, accent_fg = szöveg a kiemelő színen, bg/bg2 = háttér és átmenet,
  // fg = szöveg, surface = kártyák/dobozok, muted = halványabb szöveg
  const THEMES = {
    narancs: { name: 'Narancs', desc: 'Meleg, barátságos – az alapértelmezett', font: 'system', head_font: 'system', radius: 'round',
      colors: { accent: '#f59e5b', accent_fg: '#2a1300', bg: '#16100c', bg2: '#3b2312', fg: '#ffffff', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(255,255,255,0.72)' } },
    ocean: { name: 'Óceán', desc: 'Hűvös kék, modern', font: 'poppins', head_font: 'poppins', radius: 'round',
      colors: { accent: '#38bdf8', accent_fg: '#04263a', bg: '#0b1724', bg2: '#12395a', fg: '#ffffff', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(226,240,255,0.72)' } },
    erdo: { name: 'Erdő', desc: 'Természetes zöld, nyugodt', font: 'nunito', head_font: 'nunito', radius: 'round',
      colors: { accent: '#4ade80', accent_fg: '#052e16', bg: '#0d1a12', bg2: '#1f4630', fg: '#f0fdf4', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(240,253,244,0.72)' } },
    ejfel: { name: 'Éjféli lila', desc: 'Elegáns, esti hangulat', font: 'raleway', head_font: 'raleway', radius: 'soft',
      colors: { accent: '#a78bfa', accent_fg: '#1e1036', bg: '#0f0b1e', bg2: '#2e1f5e', fg: '#ffffff', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(237,233,254,0.72)' } },
    bordo: { name: 'Bordó', desc: 'Klasszikus, éttermekhez, borbárokhoz', font: 'lora', head_font: 'playfair', radius: 'soft',
      colors: { accent: '#f2c57c', accent_fg: '#2b0a0f', bg: '#1f080d', bg2: '#5a1424', fg: '#fff7ed', surface: 'rgba(255,255,255,0.07)', muted: 'rgba(255,247,237,0.72)' } },
    arany: { name: 'Fekete-arany', desc: 'Prémium, luxus megjelenés', font: 'montserrat', head_font: 'playfair', radius: 'sharp',
      colors: { accent: '#d4af37', accent_fg: '#1a1400', bg: '#0b0b0b', bg2: '#2a2414', fg: '#fafaf9', surface: 'rgba(212,175,55,0.08)', muted: 'rgba(250,250,249,0.68)' } },
    neon: { name: 'Neon', desc: 'Fiatalos, élénk, rendezvényekhez', font: 'oswald', head_font: 'oswald', radius: 'sharp',
      colors: { accent: '#22d3ee', accent_fg: '#001018', bg: '#05010f', bg2: '#3b0764', fg: '#ffffff', surface: 'rgba(34,211,238,0.08)', muted: 'rgba(255,255,255,0.7)' } },
    vilagos: { name: 'Tiszta világos', desc: 'Világos háttér, narancs kiemelés', font: 'inter', head_font: 'inter', radius: 'round',
      colors: { accent: '#f97316', accent_fg: '#ffffff', bg: '#faf7f4', bg2: '#ffe4cc', fg: '#1f1a17', surface: 'rgba(0,0,0,0.05)', muted: 'rgba(31,26,23,0.65)' } },
    vallalati: { name: 'Vállalati kék', desc: 'Letisztult, irodai', font: 'roboto', head_font: 'montserrat', radius: 'soft',
      colors: { accent: '#2563eb', accent_fg: '#ffffff', bg: '#f3f6fb', bg2: '#dbe7ff', fg: '#0f1b33', surface: 'rgba(15,27,51,0.05)', muted: 'rgba(15,27,51,0.62)' } },
    pasztell: { name: 'Pasztell', desc: 'Lágy, vidám – iskolák, óvodák', font: 'nunito', head_font: 'nunito', radius: 'round',
      colors: { accent: '#f472b6', accent_fg: '#ffffff', bg: '#fff7fb', bg2: '#e0f2fe', fg: '#2d2438', surface: 'rgba(45,36,56,0.05)', muted: 'rgba(45,36,56,0.62)' } },
  };

  const COLOR_LABELS = {
    accent: 'Kiemelő szín', accent_fg: 'Szöveg a kiemelő színen', bg: 'Háttér', bg2: 'Háttér (átmenet)',
    fg: 'Szöveg', surface: 'Kártyák / dobozok', muted: 'Halvány szöveg',
  };

  // A tárolt arculat (preset + egyedi felülírások) feloldása konkrét értékekre
  function resolve(branding, themeOverride) {
    const b = branding || {};
    const presetKey = themeOverride || b.preset || 'narancs';
    const p = THEMES[presetKey] || THEMES.narancs;
    const custom = Object.fromEntries(Object.entries(themeOverride ? {} : (b.colors || {})).filter(([, v]) => v));
    // ha egyedi szövegszín van, a kártyák és a halvány szöveg ahhoz igazodik (világos/sötét háttérhez is jó)
    if (custom.fg) {
      custom.surface ||= `color-mix(in srgb, ${custom.fg} 8%, transparent)`;
      custom.muted ||= `color-mix(in srgb, ${custom.fg} 70%, transparent)`;
    }
    return {
      preset: presetKey,
      colors: { ...p.colors, ...custom },
      font: (!themeOverride && b.font) || p.font,
      head_font: (!themeOverride && b.head_font) || p.head_font,
      radius: (!themeOverride && b.radius) || p.radius,
    };
  }

  window.SIGNAGE_THEMES = { THEMES, FONTS, RADIUS, COLOR_LABELS, resolve };
})();
