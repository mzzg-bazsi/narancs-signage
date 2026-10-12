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
  // Minden témának van sötét és világos változata; a „mode” az alapértelmezett
  const THEMES = {
    narancs: { name: 'Narancs', desc: 'Meleg, barátságos – az alapértelmezett', font: 'system', head_font: 'system', radius: 'round', mode: 'dark',
      dark: { accent: '#f59e5b', accent_fg: '#2a1300', bg: '#16100c', bg2: '#3b2312', fg: '#ffffff', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(255,255,255,0.72)' },
      light: { accent: '#ea7a2c', accent_fg: '#ffffff', bg: '#fff8f2', bg2: '#ffe2c7', fg: '#2a1608', surface: 'rgba(42,22,8,0.06)', muted: 'rgba(42,22,8,0.66)' } },
    ocean: { name: 'Óceán', desc: 'Hűvös kék, modern', font: 'poppins', head_font: 'poppins', radius: 'round', mode: 'dark',
      dark: { accent: '#38bdf8', accent_fg: '#04263a', bg: '#0b1724', bg2: '#12395a', fg: '#ffffff', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(226,240,255,0.72)' },
      light: { accent: '#0284c7', accent_fg: '#ffffff', bg: '#f2f9fe', bg2: '#cdeafc', fg: '#0b2235', surface: 'rgba(11,34,53,0.06)', muted: 'rgba(11,34,53,0.64)' } },
    erdo: { name: 'Erdő', desc: 'Természetes zöld, nyugodt', font: 'nunito', head_font: 'nunito', radius: 'round', mode: 'dark',
      dark: { accent: '#4ade80', accent_fg: '#052e16', bg: '#0d1a12', bg2: '#1f4630', fg: '#f0fdf4', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(240,253,244,0.72)' },
      light: { accent: '#16a34a', accent_fg: '#ffffff', bg: '#f3faf5', bg2: '#d3efdc', fg: '#0f2a1a', surface: 'rgba(15,42,26,0.06)', muted: 'rgba(15,42,26,0.64)' } },
    ejfel: { name: 'Éjféli lila', desc: 'Elegáns, esti hangulat', font: 'raleway', head_font: 'raleway', radius: 'soft', mode: 'dark',
      dark: { accent: '#a78bfa', accent_fg: '#1e1036', bg: '#0f0b1e', bg2: '#2e1f5e', fg: '#ffffff', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(237,233,254,0.72)' },
      light: { accent: '#7c3aed', accent_fg: '#ffffff', bg: '#f7f5ff', bg2: '#e2dafc', fg: '#1e1238', surface: 'rgba(30,18,56,0.06)', muted: 'rgba(30,18,56,0.64)' } },
    bordo: { name: 'Bordó', desc: 'Klasszikus, éttermekhez, borbárokhoz', font: 'lora', head_font: 'playfair', radius: 'soft', mode: 'dark',
      dark: { accent: '#f2c57c', accent_fg: '#2b0a0f', bg: '#1f080d', bg2: '#5a1424', fg: '#fff7ed', surface: 'rgba(255,255,255,0.07)', muted: 'rgba(255,247,237,0.72)' },
      light: { accent: '#8c1d33', accent_fg: '#fff7ed', bg: '#fdf6ef', bg2: '#f3dccd', fg: '#3a0c16', surface: 'rgba(58,12,22,0.06)', muted: 'rgba(58,12,22,0.66)' } },
    arany: { name: 'Fekete-arany', desc: 'Prémium, luxus megjelenés', font: 'montserrat', head_font: 'playfair', radius: 'sharp', mode: 'dark',
      dark: { accent: '#d4af37', accent_fg: '#1a1400', bg: '#0b0b0b', bg2: '#2a2414', fg: '#fafaf9', surface: 'rgba(212,175,55,0.08)', muted: 'rgba(250,250,249,0.68)' },
      light: { accent: '#a8841c', accent_fg: '#ffffff', bg: '#faf8f2', bg2: '#eee4c6', fg: '#1a1708', surface: 'rgba(168,132,28,0.10)', muted: 'rgba(26,23,8,0.64)' } },
    neon: { name: 'Neon', desc: 'Fiatalos, élénk, rendezvényekhez', font: 'oswald', head_font: 'oswald', radius: 'sharp', mode: 'dark',
      dark: { accent: '#22d3ee', accent_fg: '#001018', bg: '#05010f', bg2: '#3b0764', fg: '#ffffff', surface: 'rgba(34,211,238,0.08)', muted: 'rgba(255,255,255,0.7)' },
      light: { accent: '#c026d3', accent_fg: '#ffffff', bg: '#f6f4ff', bg2: '#d9f7fc', fg: '#140a2a', surface: 'rgba(192,38,211,0.07)', muted: 'rgba(20,10,42,0.66)' } },
    pasztell: { name: 'Pasztell', desc: 'Lágy, vidám – iskolák, óvodák', font: 'nunito', head_font: 'nunito', radius: 'round', mode: 'light',
      light: { accent: '#f472b6', accent_fg: '#ffffff', bg: '#fff7fb', bg2: '#e0f2fe', fg: '#2d2438', surface: 'rgba(45,36,56,0.05)', muted: 'rgba(45,36,56,0.62)' },
      dark: { accent: '#f9a8d4', accent_fg: '#3a0d24', bg: '#1e1a2b', bg2: '#2d3a55', fg: '#fdf2f8', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(253,242,248,0.7)' } },
    grafit: { name: 'Grafit', desc: 'Minimalista fekete-fehér, piros kiemelés', font: 'inter', head_font: 'inter', radius: 'sharp', mode: 'light',
      light: { accent: '#dc2626', accent_fg: '#ffffff', bg: '#ffffff', bg2: '#e9e9e9', fg: '#111111', surface: 'rgba(17,17,17,0.05)', muted: 'rgba(17,17,17,0.62)' },
      dark: { accent: '#ef4444', accent_fg: '#ffffff', bg: '#101010', bg2: '#2a2a2a', fg: '#fafafa', surface: 'rgba(255,255,255,0.07)', muted: 'rgba(250,250,250,0.68)' } },
    napfeny: { name: 'Napfény', desc: 'Napsárga és mélykék – üzletek, iskolák', font: 'poppins', head_font: 'montserrat', radius: 'round', mode: 'dark',
      dark: { accent: '#facc15', accent_fg: '#1a1500', bg: '#0b1633', bg2: '#1d3b8f', fg: '#ffffff', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(255,255,255,0.72)' },
      light: { accent: '#1d4ed8', accent_fg: '#ffffff', bg: '#fffdf0', bg2: '#fde68a', fg: '#0f1d40', surface: 'rgba(15,29,64,0.06)', muted: 'rgba(15,29,64,0.66)' } },
    korall: { name: 'Korall', desc: 'Élénk korall és mély türkiz – éttermek, fitnesz', font: 'roboto', head_font: 'poppins', radius: 'soft', mode: 'dark',
      dark: { accent: '#ff7f6b', accent_fg: '#2a0a05', bg: '#052628', bg2: '#0f4c4f', fg: '#f0fdfa', surface: 'rgba(255,255,255,0.08)', muted: 'rgba(240,253,250,0.72)' },
      light: { accent: '#d4472f', accent_fg: '#ffffff', bg: '#f4fbfa', bg2: '#cdeeea', fg: '#0b2f30', surface: 'rgba(11,47,48,0.06)', muted: 'rgba(11,47,48,0.64)' } },
  };

  const COLOR_LABELS = {
    accent: 'Kiemelő szín', accent_fg: 'Szöveg a kiemelő színen', bg: 'Háttér', bg2: 'Háttér (átmenet)',
    fg: 'Szöveg', surface: 'Kártyák / dobozok', muted: 'Halvány szöveg',
  };

  // A tárolt arculat (preset + mód + egyedi felülírások) feloldása konkrét értékekre.
  // o.custom = saját (importált) témák, o.mode = képernyőnkénti sötét/világos felülírás
  function resolve(branding, themeOverride, o = {}) {
    const b = branding || {};
    const all = { ...(o.custom || {}), ...THEMES };
    const presetKey = all[themeOverride] ? themeOverride : all[b.preset] ? b.preset : 'narancs';
    const own = presetKey === b.preset && !themeOverride; // a globális arculat egyedi beállításai csak a saját témájukra
    const p = all[presetKey];
    const baseMode = (own && b.mode) || p.mode || 'dark';
    const mode = o.mode === 'light' || o.mode === 'dark' ? o.mode : baseMode;
    // az egyedi színek ahhoz a módhoz készültek, amiben beállították őket
    const custom = Object.fromEntries(Object.entries(own && mode === baseMode ? (b.colors || {}) : {}).filter(([, v]) => v));
    // ha egyedi szövegszín van, a kártyák és a halvány szöveg ahhoz igazodik (világos/sötét háttérhez is jó)
    if (custom.fg) {
      custom.surface ||= `color-mix(in srgb, ${custom.fg} 8%, transparent)`;
      custom.muted ||= `color-mix(in srgb, ${custom.fg} 70%, transparent)`;
    }
    return {
      preset: presetKey, mode,
      colors: { ...palette(p, mode), ...custom },
      font: (own && b.font) || p.font,
      head_font: (own && b.head_font) || p.head_font,
      radius: (own && b.radius) || p.radius,
    };
  }
  const palette = (t, mode) => t[mode] || t[t.mode] || THEMES.narancs.dark;

  window.SIGNAGE_THEMES = { THEMES, FONTS, RADIUS, COLOR_LABELS, resolve, palette };
})();
