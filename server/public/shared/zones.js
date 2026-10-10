/* Narancs Signage – osztott képernyő (zónák) elrendezései, az admin és a lejátszó közösen használja.
   Minden elrendezés CSS grid: a zónák sorrendje = az areas betűi (a, b, c, d). A „size” a mellékzóna mérete %-ban. */
(function () {
  'use strict';
  const LAYOUTS = {
    right: { name: 'Fő terület + oldalsáv jobbra', zones: ['Fő terület', 'Oldalsáv'], sized: true,
      css: (s) => ({ areas: '"a b"', cols: `1fr ${s}%`, rows: '1fr' }) },
    left: { name: 'Oldalsáv balra + fő terület', zones: ['Fő terület', 'Oldalsáv'], sized: true,
      css: (s) => ({ areas: '"b a"', cols: `${s}% 1fr`, rows: '1fr' }) },
    bottom: { name: 'Fő terület + alsó sáv', zones: ['Fő terület', 'Alsó sáv'], sized: true,
      css: (s) => ({ areas: '"a" "b"', cols: '1fr', rows: `1fr ${s}%` }) },
    top: { name: 'Felső sáv + fő terület', zones: ['Fő terület', 'Felső sáv'], sized: true,
      css: (s) => ({ areas: '"b" "a"', cols: '1fr', rows: `${s}% 1fr` }) },
    lshape: { name: 'L alak: fő terület, oldalsáv, alsó sáv', zones: ['Fő terület', 'Oldalsáv', 'Alsó sáv'], sized: true,
      css: (s) => ({ areas: '"a b" "c c"', cols: `1fr ${s}%`, rows: `1fr ${Math.round(s * 0.6)}%` }) },
    split: { name: 'Két egyenlő oszlop', zones: ['Bal', 'Jobb'],
      css: () => ({ areas: '"a b"', cols: '1fr 1fr', rows: '1fr' }) },
    three: { name: 'Három oszlop', zones: ['Bal', 'Közép', 'Jobb'],
      css: () => ({ areas: '"a b c"', cols: '1fr 1fr 1fr', rows: '1fr' }) },
    grid4: { name: '2 × 2 rács', zones: ['Bal fent', 'Jobb fent', 'Bal lent', 'Jobb lent'],
      css: () => ({ areas: '"a b" "c d"', cols: '1fr 1fr', rows: '1fr 1fr' }) },
  };
  const AREAS = ['a', 'b', 'c', 'd'];
  const clampSize = (v) => Math.max(15, Math.min(50, +v || 30));
  // a grid stílusa egy elrendezéshez (style objektum)
  function gridStyle(key, size) {
    const L = LAYOUTS[key] || LAYOUTS.right;
    const c = L.css(clampSize(size));
    return { gridTemplateAreas: c.areas, gridTemplateColumns: c.cols, gridTemplateRows: c.rows };
  }
  window.SIGNAGE_ZONES = { LAYOUTS, AREAS, gridStyle, clampSize };
})();
