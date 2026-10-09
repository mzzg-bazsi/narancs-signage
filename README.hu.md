<p align="center">
  <img src="server/public/shared/splash/favicon.svg" alt="Narancs Signage logó" width="96" height="96">
</p>

<h1 align="center">Narancs Signage</h1>

<p align="center"><a href="README.md">English</a> · <b>Magyar</b></p>

Teljeskörű, saját üzemeltetésű digital signage rendszer: központi admin felület (halvány narancs témával), böngészőalapú lejátszó, ami ARM-on is fut, és egyparancsos telepítők Ubuntu Serverre.

```
┌──────────────────────────┐        HTTP + SSE (valós idejű push)       ┌───────────────────────────┐
│  Szerver (Ubuntu)        │ ◄────────────────────────────────────────► │  Kijelző (ARM / x86)      │
│  Node.js, SQLite         │                                            │  Chromium kioszk mód      │
│  /admin   admin felület  │                                            │  /player  lejátszó        │
│  /player  lejátszó app   │                                            │  offline gyorsítótár      │
└──────────────────────────┘                                            └───────────────────────────┘
```

<p align="center"><img src="docs/screenshots/admin-dashboard.png" alt="Irányítópult" width="900"></p>

## Képernyőképek

**Admin felület**

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/admin-screens.png" alt="Képernyők"><br><sub>Képernyők</sub></td>
    <td width="50%"><img src="docs/screenshots/admin-playlist.png" alt="Lejátszási lista élő előnézettel"><br><sub>Lejátszási lista élő előnézettel</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/admin-content-editor.png" alt="Tartalomszerkesztő (interaktív menü)"><br><sub>Tartalomszerkesztő (interaktív menü)</sub></td>
    <td width="50%"><img src="docs/screenshots/admin-branding.png" alt="Arculat: 10 téma, élő előnézet"><br><sub>Arculat: 10 téma, élő előnézet</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/admin-alerts.png" alt="Vészjelzés"><br><sub>Vészjelzés</sub></td>
    <td width="50%"><img src="docs/screenshots/admin-dashboard-dark.png" alt="Sötét mód"><br><sub>Sötét mód</sub></td>
  </tr>
</table>

**Lejátszó (a kijelzőn)**

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/player-welcome.png" alt="Hirdetmény"><br><sub>Hirdetmény</sub></td>
    <td width="50%"><img src="docs/screenshots/player-clock.png" alt="Óra és időjárás"><br><sub>Óra és időjárás</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/player-calendar.png" alt="Naptár"><br><sub>Naptár</sub></td>
    <td width="50%"><img src="docs/screenshots/player-cards.png" alt="Kártyák"><br><sub>Kártyák</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/player-menu.png" alt="Interaktív menü"><br><sub>Interaktív menü</sub></td>
    <td width="50%"><img src="docs/screenshots/player-form.png" alt="Érintőképernyős űrlap"><br><sub>Érintőképernyős űrlap</sub></td>
  </tr>
</table>

## Funkciók

**Tartalomtípusok (14 db)**
| Típus | Leírás |
|---|---|
| 🖼️ Képváltó | Több kép/videó automatikus váltakozása – áttűnés, csúsztatás, Ken Burns effekt, feliratok, lapozó pöttyök, elmosott háttér |
| 🎬 Videó | Lejátszás a végéig vagy adott ideig, hanggal/némítva |
| 📝 Hirdetmény | Cím, szöveg, háttérkép/-videó, színátmenetek, logó |
| 🃏 Kártyák | Csempe elrendezés ikonokkal, képekkel, címkékkel – érintésre más tartalmat nyithat |
| 👆 Interaktív menü | Érintőgombok, amik más tartalmakra navigálnak (Vissza/Kezdőlap gombbal, tétlenség után automatikus visszatérés) |
| 📋 Űrlap | Kérdőívek, regisztráció – virtuális billentyűzettel (magyar/angol kiosztás), smiley/csillagos értékeléssel, CSV exporttal |
| 📅 Naptár | Lista, heti és havi nézet; saját események + Google/Outlook iCal import (15 percenként frissül) |
| 🕒 Óra és időjárás | Digitális/analóg óra, aktuális időjárás és 5 napos előrejelzés (Open-Meteo, API kulcs nélkül) |
| 📰 Hírfolyam | Bármely RSS/Atom forrás képekkel |
| ⏳ Visszaszámláló | Eseményig hátralévő idő |
| 🔳 QR kód | Beépített QR generátor (link, Wi-Fi belépés stb.) |
| 🌐 Weboldal | Külső oldal/dashboard beágyazása, nagyítás, időzített újratöltés |
| 📄 PDF | Dokumentum megjelenítése |
| 🧩 Egyedi HTML | Saját HTML/CSS/JS kód elszigetelt keretben |

**Lejátszás és ütemezés**
- Lejátszási listák drag & drop sorrendezéssel, tartalmankénti időtartammal, ki/bekapcsolással és érvényességi dátumokkal
- Képernyőnkénti ütemezés: napok + időszak + dátumtartomány szerint más-más lista (pl. reggeli menü 7–10 között)
- Időzített képernyő kikapcsolás (üzemidő) – telepített lejátszón a monitort is lekapcsolja (DPMS)
- Átmenetek: áttűnés, becsúszás, nagyítás, felúszás

**Képernyőkezelés**
- Párosítás 6 jegyű kóddal, online/offline állapot, éppen futó tartalom, felbontás
- Távoli parancsok: azonosítás, előző/következő, újratöltés, gyorsítótár ürítés
- Tájolás szoftveresen (fekvő/álló/fejjel lefelé), sarokóra, hírszalag, folyamatjelző, egyedi kiemelő szín
- Élő előnézet minden tartalomról, listáról és képernyőről az admin felületen

**Egyéb**
- 🌍 Választható nyelv (English / Magyar, alapból angol): admin felület, kijelzők, szerverüzenetek
- 🚀 Első telepítéskor alap lejátszási lista minta tartalmakkal – a képernyő párosítás után azonnal mutat valamit
- 🎨 Arculat: 10 előre megadott téma (Narancs, Óceán, Erdő, Éjféli lila, Bordó, Fekete-arany, Neon, Tiszta világos, Vállalati kék, Pasztell), egyedi színek, betűtípusok, lekerekítés, logó vízjel, fejléc sáv címmel/alcímmel/órával, képernyőnként eltérő téma – élő előnézettel
- 🚨 Vészjelzés / közlemény: azonnali, teljes képernyős üzenet minden vagy kiválasztott képernyőre (sablonok: tűzriadó, evakuálás…), lejárati idővel
- 📊 Irányítópult: online képernyők, megjelenések és érintések statisztikája, legnézettebb tartalmak, beküldések
- 📴 Offline működés: a lejátszó gyorsítótárazza a konfigurációt és a médiafájlokat, szerverkiesés alatt is megy tovább
- 👥 Több admin felhasználó, munkamenet-kezelés, brute-force védelem, CSRF védelem
- 💾 Napi automatikus mentés + letölthető adatbázis mentés
- 🌗 Világos/sötét mód az admin felületen, mobilon is használható

## Telepítés

### 1. Szerver (Ubuntu Server 22.04 / 24.04, amd64 vagy arm64)

Másold fel a projekt mappát a szerverre (pl. `scp -r signage user@szerver:~` vagy git), majd:

```bash
cd signage
sudo ./install/install-server.sh
```

A telepítő feltelepíti a Node.js 24-et (ha nincs), létrehozza a `narancs-signage` systemd szolgáltatást, beállítja a napi mentést és kiírja az admin felület címét. Más port: `--port 80`.

Nyisd meg a kiírt címet (`http://SZERVER-IP:8080/admin/`) – első alkalommal kiválasztod a nyelvet és létrehozod az admin fiókot; ekkor egy alap lejátszási lista is létrejön minta tartalmakkal.

### 2. Kijelző / lejátszó (Ubuntu Server vagy Raspberry Pi OS Lite – arm64, armhf, amd64)

A kijelzőhöz kötött eszközön egyetlen parancs:

```bash
curl -fsSL http://SZERVER-IP:8080/install-player.sh | sudo bash
```

(A parancs az admin felületen a **Képernyők → Új képernyő** ablakban is megjelenik, másolható formában.)

A telepítő minimális X11 környezetet (ablakkezelő nélkül) és Chromiumot rak fel (asztali környezet nélkül), automatikus bejelentkezést állít be, és kioszk módban indítja a lejátszót. Újraindítás után a képernyőn megjelenik egy **6 jegyű kód** – ezt add meg az admin felületen.

Opciók (a parancs végére `-s --` után, pl. `| sudo bash -s -- --nightly-reboot`):
- `--nightly-reboot` – éjszakai újraindítás 04:30-kor
- `--rotate 90|180|270` – hardveres képernyőforgatás (a szoftveres forgatás az admin felületen is beállítható)

> **Egy eszközön minden:** ugyanarra a gépre először a szervert, majd a lejátszót telepítsd `http://localhost:8080` címmel.

> **Telepítés nélkül:** bármely böngészőben megnyitva a `http://SZERVER-IP:8080/player/` címet is működik (pl. okostévé, tablet, mini PC).

## Fejlesztés helyben

Node.js ≥ 22.13 kell, más függőség nincs (beépített `node:sqlite`).

```bash
cd server
npm run dev
```

Admin: <http://localhost:8080/admin/> · Lejátszó: <http://localhost:8080/player/>

## Felépítés

```
server/
  src/server.js        HTTP szerver, REST API, SSE push, lejátszó-konfiguráció összeállítása
  src/db.js            SQLite séma és adatréteg (node:sqlite)
  src/auth.js          felhasználók, munkamenetek (scrypt)
  src/feeds.js         iCal, RSS, időjárás (Open-Meteo)
  src/i18n.js          szerver oldali fordítások
  src/seed.js          minta tartalmak (alap lejátszási lista)
  src/http.js          mini router, statikus fájlok Range támogatással (videó)
  public/admin/        admin SPA (vanilla JS, build lépés nélkül)
  public/player/       lejátszó (vanilla JS, service worker, QR generátor, virtuális billentyűzet)
  public/shared/       közös: fordítások (i18n.js), arculati témák (themes.js), logó
install/
  install-server.sh    szerver telepítő (systemd, mentés, tűzfal)
  install-player.sh    kioszk telepítő (X11, Chromium, autologin, monitor időzítés)
```

## Üzemeltetés

| Feladat | Parancs |
|---|---|
| Állapot | `systemctl status narancs-signage` |
| Napló | `journalctl -u narancs-signage -f` |
| Kézi mentés | `sudo signage-backup` (→ `/var/backups/narancs-signage/`) |
| Frissítés | `git pull`, majd `sudo ./install/install-server.sh` (az adatok megmaradnak) |
| Adatok helye | `/var/lib/narancs-signage` (adatbázis + média) |
| Lejátszó beállítás | `/etc/narancs-signage/player.conf` a kijelző eszközön |

**HTTPS:** tegyél elé egy reverse proxyt (pl. Caddy: `signage.ceg.hu { reverse_proxy localhost:8080 }`). Az SSE miatt a proxyban a válasz-pufferelést kapcsold ki (nginx: `proxy_buffering off;`).

## Megjegyzések

- Egyes weboldalak (Google, Facebook stb.) tiltják a beágyazást, ezek a „Weboldal” típusban nem jelennek meg.
- Az iCal import az ismétlődő eseményeket (RRULE) nem bontja ki, csak az első előfordulást mutatja.
- A videók hangja telepített lejátszón működik (a kioszk engedélyezi az automatikus lejátszást hanggal); sima böngészőben a böngésző némíthatja.

## Verziókezelés

A forráskód a GitHubon van, a verziók [szemantikus verziózást](https://semver.org/lang/hu/) követnek (`FŐ.MELLÉK.JAVÍTÁS`), a változások a [CHANGELOG.md](CHANGELOG.md)-ben.

**Szerver telepítése / frissítése a GitHubról:**

```bash
git clone https://github.com/mzzg-bazsi/narancs-signage.git
cd narancs-signage
sudo ./install/install-server.sh
```

Frissítés később: `git pull && sudo ./install/install-server.sh`. Egy adott verzióra: `git checkout v1.1.0`.

**Új verzió kiadása:**
1. Írd le a változásokat a `CHANGELOG.md` tetejére egy új `## [X.Y.Z] – dátum` szakaszba, és commitold.
2. `./scripts/release.sh patch` (hibajavítás), `minor` (új funkció) vagy `major` (nem kompatibilis változás) – emeli a verziószámot, commitol, címkét (tag) készít és feltölti.

## Licenc

© 2026 Balázs Mazzag – [Narancs Signage License](LICENSE)

Bárki szabadon és ingyen használhatja, módosíthatja, továbbadhatja – üzleti célra, nagyvállalatnál is. **A szoftvert pénzért csak a szerző adhatja:** más nem adhatja el, nem adhatja bérbe és nem árulhatja fizetős szolgáltatásként (telepítésért, üzemeltetésért, tartalomkészítésért lehet díjat kérni). **Kötelező a névfeltüntetés:** a licencfájl és a szerzői jogi megjegyzés maradjon meg, az admin felületen látható „© 2026 Balázs Mazzag” felirat nem távolítható el, továbbadáskor pedig jelezni kell, hogy a rendszer a „Narancs Signage by Balázs Mazzag”-on alapul. A kijelzőkön nem jelenik meg felirat.
