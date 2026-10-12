# Narancs Signage – projekt jegyzetek

Saját fejlesztésű digital signage rendszer. A felhasználó magyarul kommunikál, a kód és a kommentek magyarok.

## Nyelvek (i18n)
- A felület nyelve választható (Beállítások → Nyelv, `settings.language`: `en` | `hu`), **alapból angol**. Egy beállítás az egész rendszerre (admin + kijelzők + szerverüzenetek).
- Minden látható szöveg `tr('magyar eredeti')` hívással: a kulcs a magyar szöveg, az angol a `server/public/shared/i18n.js` `EN` szótárában. Paraméter: `tr('{n} fájl', { n })`, többes szám: `pl(egyes, többes)`. Azonos magyar szó eltérő jelentéshez: `'Lista#lejátszási lista'` (magyarul a `#` előtti rész látszik). Ezért **a kulcsban nem lehet más `#`** (pl. színkód) – az paraméterként menjen: `tr('pl. {c} vagy …', { c: '#222' })`.
- **Új szöveg felvételekor az `EN` szótárba is kell bejegyzés**, különben angolul is magyarul jelenik meg.
- Admin: a nyelvet a `/api/lang.js` szinkron szkript adja még az `admin.js` előtt (a modul szintű állandók is fordítottak) → nyelvváltás után újratöltés. Lejátszó: `cfg.org.lang` / hello válasz, `localStorage`-ben tárolva az offline induláshoz; modul szintű táblákba (pl. `WX`) ne kerüljön `tr()`, a használat helyén fordíts.
- Szerver: `src/i18n.js` (`tr`, `lang`, `locale`); a hibaüzeneteket a központi hibakezelő fordítja.
- A telepítő szkriptek kimenete (terminál, `--help`, `signage-diag`, Plymouth bootkép szövegei) **angol**, a kódkommentek magyarok. A `splash-1/2/3/restart.png` képekbe égetett angol szöveg van (a szöveg nélküli `splash.png` hátterére rajzolva, Helvetica Neue 26px, alapvonal y=821, sáv 700–1220 × 767–775).

## Felépítés
- `server/src/` – Node.js (≥22.13) szerver, **nulla külső függőség** (beépített `node:sqlite`, `http`, `crypto`). Nincs `npm install` – ne vezess be függőséget.
  - `server.js` REST API + SSE (`/api/player/stream`; `?agent=1` = kijelző ügynök csatorna), lejátszó-konfiguráció (`playerConfig`, `buildBundle`), arculat (`orgInfo`, `brandDemo`)
  - `db.js` SQLite séma, JSON oszlopok automatikus kezelése, `crud()` segéd
  - `seed.js` minta tartalmak (alap lejátszási lista): első beállításkor és `POST /api/samples`
- `server/public/admin/` – admin SPA (vanilla JS, build nélkül). Halvány narancs téma. `F.*` űrlap-segédek, `TYPES` = 15 tartalomtípus (a `zones` = osztott képernyő).
- `server/public/player/` – lejátszó (kioszk böngészőben fut). Renderelők a `renderers` objektumban; `fixEmoji` minden emojit színes betűtípusba tesz; `#boot` indulókép.
- `server/public/shared/` – `i18n.js` (fordítások, dátumnevek), `themes.js` (11 arculati téma `dark`/`light` palettával, `mode` = alapértelmezett; `resolve(branding, képernyőTéma, { mode, custom })`; admin + lejátszó közös), `zones.js` (osztott képernyő elrendezések), `splash/` (logó: félnap egy tévén, bootképkockák).
- Osztott képernyő: minden zóna egy beágyazott lejátszó (`player/index.html?zone=3,5`), ami a szülő `window.__signage` állapotából olvassa a konfigurációt – így minden típus a zóna méretéhez igazodik.
- Jogosultság: `auth.js` `authorize()` – szerepkörök `admin` | `editor` | `viewer` (`users.role`), API kulcs `Authorization: Bearer ns_…` (`api_tokens`, csak sha256 hash). Az `A` middleware a `server.js`-ben bejelentkezés + szerepkör. Új admin-only végpontot az `adminOnly()` listába kell felvenni.
- Sémabővítés meglévő adatbázisokhoz: `db.js` `addColumn()` (pl. `events.rrule`, `users.role`).
- Saját témák: `settings.custom_themes` (`my_…` kulcsok), a szerver `src/themes.js` `cleanThemes()`-szel ellenőrzi (a színek CSS-be kerülnek); fájlformátum `narancs-theme` v1; a lejátszó az `org.custom_themes`-ből kapja.
- Riportok: a `stats` táblából (90 napig marad), `/api/reports`. Képernyőkép: az ügynök (`signage-agent`, `scrot`) tölti fel a `screenshots/<id>.jpg`-be.
- iCal ismétlődés: `feeds.js` `expandRrule()`; teszt: `cd server && npm test` (ideiglenes adatkönyvtárral fut).
- Sablonok: `templates.js` (formátum `narancs-template` v1: ref nevek s1/f1/c1/m1, kétnyelvű `{en, hu}` szövegek, `{{org_name}}`/`{{city}}`/`{{date+N}}` helyőrzők; export, ellenőrzött import tranzakcióban, mentés nélküli előnézet), beépítettek: `builtin-templates.js`. Új hivatkozó adatmezőnél a `REF_KEYS`-et bővíteni kell.
- Közösségi galéria: külön repó `mzzg-bazsi/narancs-signage-templates` (`templates/<id>/template.narancs.json`, `tools/build-index.mjs` a fő repó `validateTemplate`-jével ellenőriz és GitHub Pages-re tesz `index.json`-t, `tools/submission.mjs` + issue form → automatikus PR). A szerver `gallery.js`-e tölti le (`SIGNAGE_GALLERY` felülírja). A beépített sablonok változásakor a galéria fájljait is frissíteni kell.
- README képek: `docs/screenshots/*.png` (angol), a `README.hu.md` a `docs/screenshots/hu/` magyar felületű párjait használja.
- `install/install.sh` – egysoros telepítő a GitHub Release-ből (`/releases/latest/download/install.sh`): Ubuntu/Debian → `install-server.sh`, macOS → LaunchAgent (`hu.narancs.signage`, adat: `~/Library/Application Support/Narancs Signage`). A `release.sh` a verziót (`__VERSION__`) beírva tölti fel assetként az `install-player.sh`-val együtt.
- `install/install.ps1` – Windows telepítő (PowerShell 5.1 kompatibilis, `irm … | iex`; asset, `__VERSION__`): `-Mode server|screen|both` vagy menü; szerver: `%ProgramData%\NarancsSignage` (`server`, `install`, `data`, `run.cmd`, `install.json` = előző választás), ütemezett feladat „Narancs Signage Server” (SYSTEM, indításkor); kijelző: Edge `--kiosk` parancsikon az Indítópultban. Hibánál `throw`, nem `exit` (az iex bezárná az ablakot). Csak kijelző mód = kioszk gép: `NarancsKiosk` helyi fiók + Winlogon automatikus bejelentkezés + „Narancs Signage Display” ütemezett feladat + közös Indítópult parancsikon → `kiosk.exe`; `Remove-Kiosk` bontja vissza. A kioszk és az ügynök **C# program** (`install/windows/kiosk.cs`, `agent.cs`, C# 5), amit az `install.ps1` a .NET Framework `csc.exe`-jével fordít `%ProgramData%\NarancsSignage\{kiosk,agent}.exe`-vé – **nem PowerShell szkript, mert a Windows Defender (AMSI) a képernyőképes/monitorkapcsolós szkriptet kártevőnek jelölte**. `kiosk.exe` (kioszk fiók: Edge életben tartása, időzített monitor ki/be, képernyőkép és napló a `%ProgramData%\NarancsSignage\kiosk` mappában), `agent.exe` (SYSTEM, „Narancs Signage Agent”: SSE `?agent=1`, restart/reboot/screenshot, heartbeat). A PowerShell szkriptekben (install.ps1 kódsoraiban, CI lépésekben) csak ASCII legyen (a PowerShell 5.1 BOM nélkül ANSI-ként olvas; pl. az „ő” idézőjellé válik). Tálca ikon: `tray.ps1` (UTF-8 BOM-mal mentve, közös Indítópult + `tray.vbs`). Eszközazonosító: `%ProgramData%\NarancsSignage\device`, az `install.json`-ban is. Grafikus telepítő: `install/windows/setup.iss` (Inno Setup, UTF-8 BOM-mal mentve), a CI fordítja (a Node.js `node.exe`-t is beleteszi) és tagnél feltölti `NarancsSignageSetup.exe` néven. Teszt: `.github/workflows/windows.yml` (valódi Windows runner).
- `image/` – Raspberry Pi image-ek (`screen`, `all-in-one`, `server`): a hivatalos Raspberry Pi OS Lite arm64 + `narancs-firstboot.service` (`firstboot.sh`), ami az első induláskor a legfrissebb kiadás telepítőit futtatja (beállítás: `narancs-signage.txt` a boot partíción, mód: `/etc/narancs-signage/image-mode`). Build csak Linuxon: `.github/workflows/pi-image.yml` (kézi indítás) → `pi-image` kiadás (`--latest=false`, hogy a `/releases/latest/` a kódkiadás maradjon) + Imager tartalomtár JSON. Kódkiadáskor nem kell újraépíteni.
- Hálózat (statikus IP, csak Raspberry Pi + NetworkManager): `src/network.js` (`/api/network`, admin-only) a `<adat>/network/request.json`-ba ír; a `narancs-signage-network.path` → root `signage-network` (`install/signage-network.sh`, újra ellenőriz, `nmcli`) → `status.json` / `result.json`. Az `enabled` jelzőt a szerver telepítő teszi ki Pi-n; teszt: `test/network.test.mjs` (ál-nmcli).
- Rendszer info: `src/system.js` `systemInfo()` (`/api/system`, admin-only): környezet (`docker` / `raspberry-pi` / `vm` / `mac` / `bare-metal`), OS, CPU, memória, tárhely, hőmérséklet.
- Frissítések: `src/updates.js` (`/api/updates*`, admin-only): GitHub API, telepítési mód a program helyéből (`/opt/narancs-signage` = linux, macOS Application Support, `/.dockerenv`). „Frissítés most”: `<adat>/update/request.json` → `narancs-signage-update.path` → root `signage-update` (`install/signage-update.sh`) → `result.json`/`log.txt`; az `update/enabled` jelzőt a szerver telepítő teszi ki.
- `install/install-server.sh` – Ubuntu szerver (systemd `narancs-signage`, adat: `/var/lib/narancs-signage`), `signage-backup`, `signage-reset-password`.
- `Dockerfile`, `docker-compose.yml`, `.github/workflows/docker.yml`: minden push-nál build + `npm test`, a `vX.Y.Z` tagnél a kép a `ghcr.io/mzzg-bazsi/narancs-signage`-be kerül.
- `install/install-player.sh` – kioszk: X11 ablakkezelő nélkül + snap Chromium, autologin tty1, `signage-kiosk`, `signage-power` (DPMS), `signage-agent` (root, újraindítás parancsok), `signage-diag`, Plymouth bootkép folyamatjelzővel. A szerver kiszolgálja: `curl -fsSL http://SZERVER:PORT/install-player.sh | sudo bash` (`__SIGNAGE_SERVER__` helyére a szerver címe kerül).

## Futtatás (a felhasználó gépén)
- Az **éles** példány a VS Code taskból fut (`.vscode/tasks.json`): `PORT=8099`, `SIGNAGE_DATA=./data` (`server/data`, gitignore-olva), `--watch` (a szerverfájlok módosításakor magától újraindul).
- A `server/data` a felhasználó valódi adata (párosított VM, arculat, tartalmak). **Ne töröld, ne írd felül.**

## Tesztelés
- **Soha ne a 8099-es éles szerveren tesztelj.** Indíts külön szervert: `PORT=8199 SIGNAGE_DATA=<scratchpad>/testdata node --disable-warning=ExperimentalWarning src/server.js`, a végén állítsd le és töröld az adatait.
- Böngészős tesztekhez headless Brave (`/Applications/Brave Browser.app`) CDP-n keresztül, **minden futásnál friss ideiglenes profillal** (a megtartott profil visszanyitotta a régi, 8099-re mutató lapokat, és azok „szemét” párosítási kérelmeket hoztak létre).
- Szintaxis: `node --check` a JS fájlokra, `bash -n` a telepítőkre (a beágyazott heredoc szkripteket külön is: `sed -n '/^cat > \/usr\/local\/bin\/signage-kiosk/,/^EOF/p' … | sed '1d;$d' | bash -n`).
- A kijelzőről távoli diagnosztika: `POST /api/screens/:id/command {"command":"diag"}` → a válasz a `screens.info.diag` mezőbe kerül.

## Teszt kijelző: UTM VM (Apple Silicon Mac)
- Ubuntu 26.04 arm64, IP `192.168.64.3`, a Mac a VM felől `192.168.64.1`. Képernyő neve az adminban: „Teszt”.
- Tanulságok: virgl/glamor alatt az X ablakai nem jutottak ki a képre → VM-ben szoftveres X (`AccelMethod none`) és `--disable-gpu`; az Openbox 1×1-es keretbe tette a Chromiumot → nincs ablakkezelő, `xdotool` igazítja az ablakot; a UTM egere `pointerType: 'pen'`-ként érkezik; a DejaVu Sans körvonalas emojikat rajzol.

## Licenc
- `LICENSE`: saját „Narancs Signage License” (szerző: Balázs Mazzag). Az admin felület `COPYRIGHT` felirata (belépő + oldalmenü) a licenc része, ne távolítsd el; a lejátszóra nem kerül felirat.

## Verziókezelés
- GitHub: https://github.com/mzzg-bazsi/narancs-signage (**publikus**, `main`; commit e-mail: GitHub noreply álcím, a repo helyi git beállításában). `gh` be van jelentkezve (`mzzg-bazsi`).
- Minden lezárt módosítás után: bejegyzés a `CHANGELOG.md` tetejére (`## [X.Y.Z] – dátum`, Új / Javítva / Változott), commit (magyar üzenet), majd `./scripts/release.sh patch|minor|major` (verzió emelés, tag, push, **GitHub Release** a `scripts/release-notes.sh` jegyzetével, assetként `install.sh` + `install-player.sh`). A tag indítja a Docker kép buildet (`ghcr.io/mzzg-bazsi/narancs-signage:X.Y.Z` és `latest`).
- A kijelzőt érintő változás után a felhasználónak újra kell futtatnia a lejátszó telepítőt a VM-en; a lejátszó oldali (böngésző) változásokhoz elég egy távoli `reload` parancs.

## Kapcsolódó repók (a `~/Desktop/Projektek/` alatt)
- `narancs-signage-site` → `mzzg-bazsi/narancs-signage-website` (GitHub Pages, statikus, build nélkül): főoldal, `demo/`, `docs/` (`en.html` + `hu.html`, a `docs/index.html` tölti be, tartalomjegyzékkel), `compare/`, `templates/` (közösségi sablongaléria). **A funkciók változásakor ezt is frissíteni kell** (főoldal funkciók, docs EN+HU, összehasonlítás).
  - Nyelv: `i18n.js` HU szótár, kulcs = az angol szöveg (szövegcsomópontonként, vegyes HTML-nél `data-i18n`); minden új angol szöveghez kell HU bejegyzés. A nyelv `localStorage` `site.lang`, `?lang=hu`.
  - Közös fejléc minden oldalon (`.nav-links`; új oldalnál mind az 5 HTML-ben), egy stíluslap (`style.css`) – új stílusnál ügyelj a meglévő osztálynevekre (pl. `.gallery`, `.tv`, `.steps` már foglalt).
  - Képernyőképek: `assets/shots/*.png` (1600×900, angol felület; mindegyiknek van magyar felületű párja az `assets/shots/hu/`-ban – a weboldal `i18n.js`-e magyarul automatikusan erre cseréli, a magyar docs közvetlenül ezt használja; új képnél mindkét nyelven el kell készíteni), tesztszerverről CDP-vel készülnek; a főoldal `a.lb` / `.gallery a` képei a lightboxban nyílnak. `assets/og.png` (1200×630) a megosztási kép, `assets/github-social.png` (1280×640) a GitHub social preview.
  - Demó frissítése a főrepó változásai után: `node tools/build-demo.mjs ../signage` (saját 8199-es tesztszervert indít – a port legyen szabad).
- `narancs-signage-templates` → `mzzg-bazsi/narancs-signage-templates`: sablonfájlok + `index.json` (Pages). A saját oldala csak átirányít a weboldal `templates/` oldalára; a `tools/build-index.mjs` a mini kijelzőkhöz `screens`/`playlist` kivonatot is ír az indexbe, és a fő repó `zones.js`-ét is közzéteszi. Teszt beküldés törlése: a `templates/<id>` mappa törlése a `main`-en.
- A weboldal SEO: Google Search Console (a verifikációs meta a főoldalon szándékosan publikus), `sitemap.xml` hreflang párokkal – új oldalnál bővíteni kell.
