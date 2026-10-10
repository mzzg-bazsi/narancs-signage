# Változásnapló

A verziószámozás a [szemantikus verziózást](https://semver.org/lang/hu/) követi: `FŐ.MELLÉK.JAVÍTÁS`
- **FŐ** – nem visszafelé kompatibilis változás (pl. adatbázis átalakítás, ami kézi lépést igényel)
- **MELLÉK** – új funkció, visszafelé kompatibilis
- **JAVÍTÁS** – hibajavítás

Az aktuális verzió a `server/package.json`-ban van, az admin felület Beállítások oldalán is látszik.

## [1.15.1] – 2026-10-10

### Változott
- README-k: osztott képernyő, riportok, szerepkörök és API kulcsok, képernyőkép, Docker; kikerült az ismétlődő iCal események korábbi korlátja. CLAUDE.md frissítve az új részekkel.

## [1.15.0] – 2026-10-10

### Új
- **Docker kép** (amd64 + arm64): `ghcr.io/mzzg-bazsi/narancs-signage`, `Dockerfile` és `docker-compose.yml` a repóban; az adatok a `/data` kötetben. A GitHub Actions minden push-nál felépíti és lefuttatja a teszteket, kiadáskor közzéteszi a képet.
- **`sudo signage-reset-password <felhasználónév> [új jelszó] [--admin]`** a szerveren: elfelejtett jelszó visszaállítása (jelszó nélkül véletlent generál, minden munkamenetet kiléptet).

## [1.14.0] – 2026-10-10

### Új
- **Távoli képernyőkép**: a Képernyők → Vezérlés ablakban a „Képernyőkép” gombra a kijelző ügynöke lefényképezi, mi látszik éppen a valódi kijelzőn, és pár másodperc alatt megjelenik az admin felületen (a legutóbbi kép megmarad). Szerkesztők is használhatják.
- API: `GET /api/screens/:id/screenshot`, parancs: `screenshot`.

### Változott
- A lejátszó telepítő a `scrot` csomagot is telepíti, a `player.conf` a kioszk felhasználó nevét is tárolja; az ügynök 2-es verzió. **A képernyőképhez a kijelzőn újra kell futtatni a lejátszó telepítőt.**

## [1.13.0] – 2026-10-10

### Új
- **Szerepkörök**: Adminisztrátor (minden), Szerkesztő (tartalmak, listák, naptárak, űrlapok, képernyők beállítása és parancsai, vészjelzés), Megtekintő (csak olvasás). Új felhasználónál választható, meglévőnél a Beállításokban módosítható. A felhasználók, API kulcsok, rendszerbeállítások, arculat, mentés, párosítás, képernyő törlése és az eszköz újraindítása csak adminisztrátornak elérhető. A meglévő felhasználók adminisztrátorok maradnak.
- **API kulcsok** (Beállítások → API kulcsok): más rendszerek (Home Assistant, Zapier, saját szkript) a kulccsal hívhatják az API-t (`Authorization: Bearer ns_…`), saját szerepkörrel; a kulcs csak létrehozáskor látszik, a szerver csak a hash-ét tárolja, bármikor visszavonható.

## [1.12.0] – 2026-10-10

### Új
- **Riportok (lejátszási igazolás / proof of play)**: új menüpont az Áttekintés alatt. Időszak (dátumtól–dátumig, 7 nap, 30 nap, ez a hónap) és képernyő szerinti szűrés; megjelenések és érintések összesítve, napi diagram, toplista tartalmak és képernyők szerint arányokkal. **CSV export** soronként egy eseménnyel (időpont, képernyő, tartalom, típus, esemény) – pl. hirdetőknek.
- API: `GET /api/reports`, `GET /api/reports/export.csv` (`from`, `to`, `screen_id` paraméterekkel).

## [1.11.0] – 2026-10-10

### Új
- **Ismétlődő naptáresemények**: a kézi eseményeknél beállítható ismétlődés (naponta, hetente, havonta, évente) opcionális befejező dátummal; a listában 🔁 jelzi.
- Automatikus tesztek: `npm test` (a szerver mappában), elsőként az iCal ismétlődés kibontásra.

### Javítva
- Az importált iCal naptárak (Google, Outlook) ismétlődő eseményei (RRULE) mostantól minden előfordulással megjelennek, nem csak az elsővel: DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY (pl. „minden hónap utolsó péntekje”), BYMONTHDAY, BYMONTH, kihagyott (EXDATE) és áthelyezett (RECURRENCE-ID) alkalmak.

## [1.10.0] – 2026-10-10

### Új
- **Osztott képernyő (zónák)** – új tartalomtípus: több tartalom egyszerre, 8 elrendezéssel (oldalsáv jobbra/balra, alsó/felső sáv, L alak, 2 és 3 oszlop, 2 × 2 rács), állítható mellékzóna mérettel és réssel. Minden zónában egy vagy több meglévő tartalom váltakozik a saját idejével; a zónák beágyazott lejátszóként futnak, így minden tartalomtípus helyesen méreteződik.

## [1.9.10] – 2026-10-10

### Változott
- A README-kben a karakteres ábra helyett rajzolt architektúra ábra (SVG, angol és magyar, világos/sötét mód): admin felület, szerver, kijelzők

## [1.9.9] – 2026-10-10

### Változott
- A Claude jelzés pontosítva: „Teljes egészében a Claude programozta” („Programmed entirely by Claude”) az admin felületen és a README-kben

## [1.9.8] – 2026-10-10

### Új
- „Claude-dal fejlesztve” („Built with Claude”) jelzés az admin felület belépő oldalán és oldalmenüjében, a szerzői jogi felirat alatt, valamint a README-kben

## [1.9.7] – 2026-10-10

### Új
- Link a bemutató weboldalra (https://mzzg-bazsi.github.io/narancs-signage-website/) a README-ben (angol és magyar)

## [1.9.6] – 2026-10-09

### Új
- Képernyőképek a README-ben (angol és magyar): irányítópult, képernyők, lejátszási lista, tartalomszerkesztő, arculat, vészjelzés, sötét mód, valamint a lejátszó minta tartalmai (`docs/screenshots/`)

### Javítva
- A háttér mező helykitöltője („pl. #222 vagy linear-gradient(...)”) angol felületen is magyarul jelent meg
- A képernyő kártyán az „Egér” jelvény ikonja színes emojiként jelenik meg

## [1.9.5] – 2026-10-09

### Változott
- A telepítők angolul: a szerver és a lejátszó telepítő minden kiírása, a `--help` súgó, a `signage-diag` hibakereső, az ügynök naplóbejegyzései, a systemd szolgáltatások leírása és a Plymouth bootképernyő állapotszövegei
- A lejátszó indulóképei (`splash-1/2/3/restart.png`) angol szöveggel: „Starting graphical interface…”, „Connecting to the server…”, „Starting player…”, „Restarting player…”
- A kioszk Chromium nyelve `en-US` (a lejátszó felirata továbbra is az admin felületen választott nyelvet követi)

## [1.9.4] – 2026-10-09

### Javítva
- Raspberry Pi-n (egér nélkül) az egérmutató a kijelző közepén maradt, tablet módban is: a Chromium a rejtett mutatót csak egérmozgás után alkalmazza. A lejátszó telepítő most `unclutter`-t telepít, ami X szinten rejti el a mutatót (rejtve indul, mozgatáskor megjelenik, 3 mp után és érintéskor eltűnik), induláskor pedig a mutatót a képernyő sarkába mozgatja
- `signage-diag`: jelzi, fut-e az egérmutató elrejtés

## [1.9.3] – 2026-10-09

### Változott
- A README angol lett (`README.md`), a magyar változat `README.hu.md` néven érhető el, a két nyelv között hivatkozással; mindkettőbe bekerült a nyelvválasztás és a minta tartalmak leírása

## [1.9.2] – 2026-10-09

### Változott
- Licenc 2.1: a szoftvert pénzért csak a szerző adhatja – más nem adhatja el, nem adhatja bérbe, nem árulhatja fizetős felhőszolgáltatásként és nem építheti be pénzért árult termékbe. A kapcsolódó munkáért (telepítés, üzemeltetés, tartalomkészítés) továbbra is lehet díjat kérni; a névfeltüntetés kötelező marad

## [1.9.1] – 2026-10-09

### Változott
- Licenc 2.0: a nagyvállalati és az eladási korlátozás megszűnt – bárki szabadon használhatja, módosíthatja, továbbadhatja és eladhatja, egyetlen feltétel a szerző (Balázs Mazzag) nevének feltüntetése

## [1.9.0] – 2026-10-09

### Új
- Licenc: `LICENSE` – Narancs Signage License 1.0 (forrás elérhető). Ingyenes használat magánszemélyeknek és kis- és középvállalkozásoknak, kötelező névfeltüntetéssel; nagyvállalatoknak (250+ fő vagy 50 M€+ árbevétel) fizetős kereskedelmi licenc; a szoftver eladása csak a szerző engedélyével
- Szerzői jogi megjegyzés („© 2026 Balázs Mazzag”) az admin felületen: belépő képernyő és oldalmenü alja (a lejátszón nincs)

### Változott
- `package.json`: a korábbi „MIT” licencjelölés helyett a saját licencre hivatkozik, szerző megadva
- README: Licenc fejezet

## [1.8.1] – 2026-10-09

### Változott
- README: a ◐ emoji helyett a Narancs Signage logó a címben

## [1.8.0] – 2026-10-09

### Új
- Első telepítéskor automatikusan létrejön egy **alap lejátszási lista** minta tartalmakkal (a kiválasztott nyelven): üdvözlő hirdetmény a szervezet nevével, óra és időjárás, szolgáltatás kártyák, naptár mintaeseményekkel, interaktív menü (Programok → naptár, Szolgáltatások → kártyák, Visszajelzés → elégedettségi kérdőív) és visszaszámláló újévig. A párosított képernyők alapból ezt a listát kapják
- Nyelvválasztó az első beállítás képernyőn (Language / Nyelv), így a minta tartalmak már a választott nyelven készülnek
- Beállítások → Minta tartalmak: meglévő rendszeren is létrehozható ugyanez a bemutató csomag (új listaként, a meglévő tartalmak érintetlenek maradnak)

## [1.7.0] – 2026-10-09

### Új
- Választható nyelv: Beállítások → Nyelv (English / Magyar), **alapértelmezés: angol**. A beállítás az egész rendszerre érvényes: admin felület, belépés, a kijelzők feliratai (dátumok, napok, hónapok, Ma/Holnap, időjárás, visszaszámláló, űrlap üzenetek, párosító és indulóképernyő), a szerver hibaüzenetei, a CSV export fejléce és az arculat bemutató
- Az új tartalmak, űrlapsablonok és vészjelzés sablonok mintaszövegei a kiválasztott nyelven jönnek létre (a meglévő tartalmak szövege nem változik)
- Angol virtuális billentyűzet kiosztás (QWERTY) az érintőképernyős űrlapokhoz
- A település keresés (időjárás) a kiválasztott nyelven adja a neveket

### Változott
- A felület szövegei közös fordítási modulban (`public/shared/i18n.js`, a kulcs a magyar eredeti), a szerver üzenetei a `src/i18n.js`-ben
- Nyelvváltáskor a kijelzők azonnal frissülnek, az admin oldal újratöltődik

## [1.6.3] – 2026-10-09

### Javítva
- Az elhagyott, párosítatlan eszközök örökre az adatbázisban maradtak: a szerver indításkor és óránként törli azokat, amelyek 24 órája nem jelentkeztek

## [1.6.2] – 2026-10-09

### Javítva
- Egyes emojik (pl. 🙂 😐 🙁 az elégedettségi űrlapon) a kijelzőn egyszínű körvonalként jelentek meg: Linuxon a DejaVu Sans saját rajzát használta a böngésző. Most minden emoji – diákon, űrlapokon, menükben, fejlécben, hírszalagon, hírfolyamban – a színes emoji betűtípussal jelenik meg (a csillagos értékelés ★ jele kivétel, az a téma színét kapja)

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
