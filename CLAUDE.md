# Narancs Signage – projekt jegyzetek

Saját fejlesztésű digital signage rendszer. A felhasználó magyarul kommunikál, a kód és a kommentek magyarok.

## Nyelvek (i18n)
- A felület nyelve választható (Beállítások → Nyelv, `settings.language`: `en` | `hu`), **alapból angol**. Egy beállítás az egész rendszerre (admin + kijelzők + szerverüzenetek).
- Minden látható szöveg `tr('magyar eredeti')` hívással: a kulcs a magyar szöveg, az angol a `server/public/shared/i18n.js` `EN` szótárában. Paraméter: `tr('{n} fájl', { n })`, többes szám: `pl(egyes, többes)`. Azonos magyar szó eltérő jelentéshez: `'Lista#lejátszási lista'` (magyarul a `#` előtti rész látszik).
- **Új szöveg felvételekor az `EN` szótárba is kell bejegyzés**, különben angolul is magyarul jelenik meg.
- Admin: a nyelvet a `/api/lang.js` szinkron szkript adja még az `admin.js` előtt (a modul szintű állandók is fordítottak) → nyelvváltás után újratöltés. Lejátszó: `cfg.org.lang` / hello válasz, `localStorage`-ben tárolva az offline induláshoz; modul szintű táblákba (pl. `WX`) ne kerüljön `tr()`, a használat helyén fordíts.
- Szerver: `src/i18n.js` (`tr`, `lang`, `locale`); a hibaüzeneteket a központi hibakezelő fordítja.
- A telepítő szkriptek (Plymouth, terminál kimenet) magyarok maradtak.

## Felépítés
- `server/src/` – Node.js (≥22.13) szerver, **nulla külső függőség** (beépített `node:sqlite`, `http`, `crypto`). Nincs `npm install` – ne vezess be függőséget.
  - `server.js` REST API + SSE (`/api/player/stream`; `?agent=1` = kijelző ügynök csatorna), lejátszó-konfiguráció (`playerConfig`, `buildBundle`), arculat (`orgInfo`, `brandDemo`)
  - `db.js` SQLite séma, JSON oszlopok automatikus kezelése, `crud()` segéd
  - `seed.js` minta tartalmak (alap lejátszási lista): első beállításkor és `POST /api/samples`
- `server/public/admin/` – admin SPA (vanilla JS, build nélkül). Halvány narancs téma. `F.*` űrlap-segédek, `TYPES` = 14 tartalomtípus.
- `server/public/player/` – lejátszó (kioszk böngészőben fut). Renderelők a `renderers` objektumban; `fixEmoji` minden emojit színes betűtípusba tesz; `#boot` indulókép.
- `server/public/shared/` – `i18n.js` (fordítások, dátumnevek), `themes.js` (10 arculati téma, admin + lejátszó közös), `splash/` (logó: félnap egy tévén, bootképkockák).
- `install/install-server.sh` – Ubuntu szerver (systemd `narancs-signage`, adat: `/var/lib/narancs-signage`).
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
- Minden lezárt módosítás után: bejegyzés a `CHANGELOG.md` tetejére (`## [X.Y.Z] – dátum`, Új / Javítva / Változott), commit (magyar üzenet), majd `./scripts/release.sh patch|minor|major` (verzió emelés, tag, push).
- A kijelzőt érintő változás után a felhasználónak újra kell futtatnia a lejátszó telepítőt a VM-en; a lejátszó oldali (böngésző) változásokhoz elég egy távoli `reload` parancs.
