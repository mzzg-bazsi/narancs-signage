# Változásnapló

A verziószámozás a [szemantikus verziózást](https://semver.org/lang/hu/) követi: `FŐ.MELLÉK.JAVÍTÁS`
- **FŐ** – nem visszafelé kompatibilis változás (pl. adatbázis átalakítás, ami kézi lépést igényel)
- **MELLÉK** – új funkció, visszafelé kompatibilis
- **JAVÍTÁS** – hibajavítás

Az aktuális verzió a `server/package.json`-ban van, az admin felület Beállítások oldalán is látszik.

## [1.6.1] – 2026-10-09

### Javítva
- Egér módban nem jelent meg a mutató virtuális gépen: a UTM az egeret „pen” (toll) eszközként jelenti – most minden nem-érintéses mutatóeszköz megjeleníti

### Változott
- Képernyő kártya újratervezve: állapot és mód (Tablet/Egér) a kép sarkaiban, „Most játszik” középen, előző/következő gombok a képen; adatok rendezett táblázatban; alul két gomb: Szerkesztés és Vezérlés
- Vezérlés ablak: azonosítás, előnézet, oldal újratöltése, lejátszó és eszköz újraindítása egy helyen („Összes vezérlése” az összes képernyőre)
- Távoli diagnosztika: mutatóeszköz adatok (finom mutató, érintési pontok, utolsó mutatóesemény)

## [1.6.0] – 2026-10-09

### Új
- **Tablet mód** képernyőnként (Képernyők → Szerkesztés → Általános): bekapcsolva soha nincs egérmutató, csak érintés; kikapcsolva (egér mód) egér mozgatásakor 3 másodpercig látszik a mutató
- A képernyő kártyáján látszik, hogy tablet vagy egér módban van

### Eltávolítva
- Az „Egérmutató mindig látszik” kapcsoló (a Tablet mód váltja ki)

## [1.5.0] – 2026-10-09

### Új
- Egérmutató a kijelzőn: egér mozgatásakor 3 másodpercig látszik, utána eltűnik (érintésnél nem jelenik meg)
- Képernyők → Szerkesztés → Megjelenés: „Egérmutató mindig látszik” (teszteléshez, egérrel kezelt kijelzőhöz)

### Változott
- A kioszk X szervere már nem tiltja le teljesen az egérmutatót (`-nocursor` helyett üres háttér-mutató, a lejátszó kezeli a láthatóságot)

## [1.4.1] – 2026-10-09

### Új
- Képernyők → párosításra váró eszközök: „Elvetés” gomb a nem kívánt eszközökhöz
- `.vscode/tasks.json`: a VS Code a mappa megnyitásakor automatikusan elindítja a szervert (8099-es port, `server/data` adatkönyvtár, fájlfigyeléssel)

## [1.4.0] – 2026-10-09

### Új
- **Új logó**: a félnap egy tévé képernyőjén – bootképernyőn, lejátszón (párosítás, kapcsolódás), admin felületen és a böngésző fülön (favicon)
- **Folyamatjelző indulás közben** állapotszöveggel, végig egységes elrendezéssel:
  - 0–60%: rendszer betöltése (Plymouth: „Rendszer betöltése… / Eszközök és szolgáltatások indítása… / Hálózat csatlakoztatása… / Kijelző indítása…”)
  - 65–85%: grafikus felület („Grafikus felület indítása… / Kapcsolódás a szerverhez… / Lejátszó indítása…”)
  - 90–100%: lejátszó („Tartalom betöltése… / Kész”)
- Leállításkor / újraindításkor „Leállítás…” / „Újraindítás…” felirat, böngésző újraindításakor „Lejátszó újraindítása…”
- `plymouth display-message --text=…` üzenetek megjelennek a bootképernyőn

## [1.3.0] – 2026-10-09

### Új
- **Bootképernyő**: induláskor és leállításkor a félnap logó látszik narancs háttéren (Plymouth téma) a szöveges `[ OK ]` sorok helyett
- Csendes indulás: rejtett GRUB menü (Shift/Esc lenyomva előhozható), kernel- és systemd-üzenetek elrejtve, kurzor nélkül; Raspberry Pi-n a `cmdline.txt`-ben
- A konzol (tty1) sosem mutat szöveget: minden színe narancsra áll, nincs bejelentkezési üzenet
- A lejátszó indulóképe és a böngésző mögötti háttér ugyanaz a logós kép, így a boot → lejátszás átmenet folyamatos
- `server/public/shared/splash/`: logó (SVG, PNG) és teljes képernyős bootkép

### Változott
- „Lejátszó újraindítása” már csak a böngészőt indítja újra (a grafikus felület fut tovább, közben a logó látszik)
- Az eltávolító (`--uninstall`) a bootképet és a GRUB / cmdline beállításokat is visszaállítja

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
