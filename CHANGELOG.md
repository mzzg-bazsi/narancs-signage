# Változásnapló

A verziószámozás a [szemantikus verziózást](https://semver.org/lang/hu/) követi: `FŐ.MELLÉK.JAVÍTÁS`
- **FŐ** – nem visszafelé kompatibilis változás (pl. adatbázis átalakítás, ami kézi lépést igényel)
- **MELLÉK** – új funkció, visszafelé kompatibilis
- **JAVÍTÁS** – hibajavítás

Az aktuális verzió a `server/package.json`-ban van, az admin felület Beállítások oldalán is látszik.

## [1.2.0] – 2026-10-09

### Új
- **Távoli újraindítás** az admin felületről (Képernyők → ⏻ gomb, vagy „Újraindítás…” az összes képernyőre):
  - *Oldal újratöltése* – a lejátszó oldal frissül
  - *Lejátszó újraindítása* – a böngésző és a grafikus felület teljes újraindítása
  - *Eszköz újraindítása* – a kijelző számítógép újraindítása (megerősítéssel)
- Kijelző ügynök (`narancs-signage-agent` szolgáltatás) a telepített lejátszókon: élő kapcsolaton fogadja a parancsokat, percenként jelenti az eszköz adatait (gépnév, IP, OS, futásidő)
- Képernyő → Eszköz fül: ügynök állapota és eszközadatok
- `signage-diag` az ügynök állapotát is mutatja

### Javítva
- Az ügynök heartbeatje nem törli a „most játszott” tartalom adatát

## [1.1.0] – 2026-10-09

### Új
- **Arculat** menü: 10 előre megadott téma (Narancs, Óceán, Erdő, Éjféli lila, Bordó, Fekete-arany, Neon, Tiszta világos, Vállalati kék, Pasztell), egyedi színek, Google betűtípusok, lekerekítés, logó vízjel, fejléc sáv (cím, alcím, óra), élő előnézet
- Képernyőnként eltérő téma (Képernyők → Szerkesztés → Megjelenés)
- Tartalmak színezése az arculat szerint: témaszínek minden színmezőben, „Arculat szerint” gomb tartalmanként, tömeges átszínezés
- Előre megadott színkódok (17 szín) minden színválasztóban, a naptárak színénél is
- Lejátszó telepítő: `--uninstall` / `--purge`, `--gpu` / `--no-gpu` kapcsolók
- `signage-diag` hibakereső parancs a kijelzőn
- Távoli diagnosztika parancs a lejátszónak

### Javítva
- Első indításkor (lassan felálló hálózatnál) a lejátszó nem mutatta a párosító kódot – most újrapróbálkozik és kiírja az állapotot
- VM-ekben (UTM/virgl) a képernyő narancs maradt: szoftveres X rajzolás és GPU nélküli Chromium virtuális gépen
- Az Openbox 1×1 pixeles keretbe tette a böngészőt – a kioszk ablakkezelő nélkül fut
- 1 pixeles csík a képernyő szélén – az ablak pontosan a képernyő méretére igazodik
- Google Fordító felugró ablak a kioszkon
- A naptárak és menügombok egyedi színei nem jelentek meg (CSS változók beállítása)
- A tárolt offline tartalom eszközazonosítóhoz kötve

## [1.0.0] – 2026-10-09

### Első kiadás
- Node.js szerver külső függőség nélkül (SQLite, SSE), admin felület, böngészőalapú lejátszó
- 14 tartalomtípus: képváltó, videó, hirdetmény, kártyák, interaktív menü, űrlap, naptár, óra és időjárás, RSS, visszaszámláló, QR kód, weboldal, PDF, egyedi HTML
- Lejátszási listák, ütemezés, képernyő párosítás, távvezérlés, vészjelzés, statisztika, offline működés
- Telepítők Ubuntu Serverre (szerver és kioszk, ARM és x86)
