#!/usr/bin/env bash
# =============================================================================
#  Narancs Signage – LEJÁTSZÓ (kijelző) telepítő
#  Ubuntu Server 22.04/24.04 és Raspberry Pi OS Lite – arm64, armhf és amd64
#
#  Legegyszerűbben a szerverről:
#     curl -fsSL http://SZERVER:8080/install-player.sh | sudo bash
#  vagy kézzel:
#     sudo ./install-player.sh http://SZERVER:8080 [--rotate 90] [--nightly-reboot]
#
#  Grafika: virtuális gépen vagy GPU nélkül automatikusan szoftveres megjelenítés.
#     --no-gpu / --gpu  a felismerés felülbírálása
#
#  Eltávolítás:
#     curl -fsSL http://SZERVER:8080/install-player.sh | sudo bash -s -- --uninstall
#     (--purge: a Chromiumot és a grafikus csomagokat is eltávolítja)
#
#  Mit csinál?
#   - minimális grafikus környezet (X11, ablakkezelő nélkül) asztal nélkül
#   - Chromium kioszk módban, automatikus újraindítással ha összeomlik
#   - automatikus bejelentkezés a tty1-en egy dedikált "kiosk" felhasználóval
#   - képernyőkímélő/energiatakarékos mód kikapcsolása, egérkurzor elrejtése (X -nocursor)
#   - monitor ki/bekapcsolás az admin felületen beállított üzemidő szerint
# =============================================================================
set -euo pipefail

SERVER="${SIGNAGE_SERVER:-__SIGNAGE_SERVER__}"
KIOSK_USER=kiosk
NIGHTLY_REBOOT=0
ROTATE=""
UNINSTALL=0
PURGE=0
GPU=auto

while [[ $# -gt 0 ]]; do
  case "$1" in
    http://*|https://*) SERVER="${1%/}"; shift ;;
    --user) KIOSK_USER="$2"; shift 2 ;;
    --nightly-reboot) NIGHTLY_REBOOT=1; shift ;;
    --rotate) ROTATE="$2"; shift 2 ;;
    --gpu) GPU=on; shift ;;
    --no-gpu) GPU=off; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --purge) UNINSTALL=1; PURGE=1; shift ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "Ismeretlen kapcsoló: $1"; exit 1 ;;
  esac
done

c_ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
c_info() { printf '\033[1;33m➜ %s\033[0m\n' "$*"; }
c_err()  { printf '\033[1;31m✘ %s\033[0m\n' "$*" >&2; }

[[ $EUID -eq 0 ]] || { c_err "Rootként futtasd (sudo)."; exit 1; }

# ---------- Eltávolítás ----------
if [[ $UNINSTALL -eq 1 ]]; then
  c_info "Narancs Signage lejátszó eltávolítása…"
  if id "$KIOSK_USER" >/dev/null 2>&1; then
    loginctl terminate-user "$KIOSK_USER" 2>/dev/null || true
    pkill -KILL -u "$KIOSK_USER" 2>/dev/null || true
    sleep 1
    userdel -r "$KIOSK_USER" 2>/dev/null || userdel "$KIOSK_USER" 2>/dev/null || true
    c_ok "Kiosk felhasználó és a Chromium profil törölve"
  fi
  rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf
  rmdir /etc/systemd/system/getty@tty1.service.d 2>/dev/null || true
  systemctl disable --now narancs-signage-agent.service >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/narancs-signage-agent.service
  rm -f /usr/local/bin/signage-kiosk /usr/local/bin/signage-power /usr/local/bin/signage-diag /usr/local/bin/signage-agent
  rm -f /etc/cron.d/narancs-signage-reboot
  rm -rf /etc/narancs-signage
  rm -f /etc/X11/xorg.conf.d/20-signage-vm.conf
  systemctl daemon-reload
  systemctl restart getty@tty1.service 2>/dev/null || true
  c_ok "Automatikus bejelentkezés, indítószkriptek és eszközazonosító törölve"
  if [[ $PURGE -eq 1 ]]; then
    c_info "Csomagok eltávolítása…"
    snap remove chromium >/dev/null 2>&1 || true
    apt-get purge -y -qq chromium chromium-browser >/dev/null 2>&1 || true
    apt-get purge -y -qq xserver-xorg xinit openbox >/dev/null 2>&1 || true
    apt-get autoremove -y -qq >/dev/null 2>&1 || true
    c_ok "Csomagok eltávolítva"
  fi
  echo
  c_ok "Kész. Az admin felületen a Képernyők menüben töröld a régi képernyőt is (ha párosítva volt)."
  exit 0
fi
if [[ "$SERVER" == *__SIGNAGE_SERVER__* || -z "$SERVER" ]]; then
  if [[ -t 0 ]]; then read -rp "Signage szerver címe (pl. http://192.168.1.10:8080): " SERVER; SERVER="${SERVER%/}"; fi
  [[ "$SERVER" =~ ^https?:// ]] || { c_err "Add meg a szerver címét: sudo $0 http://SZERVER:8080"; exit 1; }
fi

ARCH="$(dpkg --print-architecture)"
. /etc/os-release
c_info "Lejátszó telepítése – $PRETTY_NAME ($ARCH) → $SERVER"

if ! curl -fs --max-time 5 "$SERVER/healthz" >/dev/null 2>&1; then
  c_info "Figyelem: a szerver most nem érhető el ($SERVER). A telepítés folytatódik, a lejátszó később csatlakozik."
fi

# ---------- Csomagok ----------
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
c_info "Grafikus környezet telepítése (X11)…"
apt-get install -y -qq --no-install-recommends \
  xserver-xorg xserver-xorg-input-libinput x11-xserver-utils x11-utils xdotool xinit \
  curl jq ca-certificates fonts-noto-color-emoji fonts-dejavu-core dbus-x11 >/dev/null

c_info "Chromium telepítése…"
CHROMIUM=""
if [[ "$ID" == "ubuntu" ]]; then
  # Ubuntun a Chromium csak snap csomagként érhető el
  command -v snap >/dev/null || apt-get install -y -qq snapd >/dev/null
  snap list chromium >/dev/null 2>&1 || snap install chromium
  CHROMIUM=/snap/bin/chromium
else
  apt-get install -y -qq --no-install-recommends chromium >/dev/null 2>&1 \
    || apt-get install -y -qq --no-install-recommends chromium-browser >/dev/null
  CHROMIUM="$(command -v chromium || command -v chromium-browser)"
fi
[[ -x "$CHROMIUM" ]] || { c_err "A Chromium telepítése nem sikerült."; exit 1; }
c_ok "Chromium: $CHROMIUM"

# ---------- Kioszk felhasználó ----------
if ! id "$KIOSK_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$KIOSK_USER"
  passwd -l "$KIOSK_USER" >/dev/null
fi
usermod -aG video,input,render,audio,tty "$KIOSK_USER" 2>/dev/null || usermod -aG video,input,audio,tty "$KIOSK_USER"
HOME_DIR="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"

# Állandó eszközazonosító – így a képernyő újratelepítés után is ugyanaz marad
install -d -m 0755 /etc/narancs-signage
if [[ ! -s /etc/narancs-signage/device ]]; then
  echo "kiosk-$(tr -dc 'a-f0-9' </dev/urandom | head -c 20)" > /etc/narancs-signage/device
fi
DEVICE="$(cat /etc/narancs-signage/device)"

# GPU felismerés: VM-ben (UTM, VirtualBox, VMware, Hyper-V…) vagy render eszköz nélkül a Chromium
# GPU folyamata elindulás után kilép, és nem rajzol semmit → szoftveres megjelenítés kell
if [[ "$GPU" == auto ]]; then
  VIRT="$(systemd-detect-virt 2>/dev/null || true)"
  if [[ -n "$VIRT" && "$VIRT" != none ]] || ! ls /dev/dri/renderD* >/dev/null 2>&1; then GPU=off; else GPU=on; fi
  c_info "Grafikus gyorsítás: $GPU${VIRT:+ (virtualizáció: $VIRT)}"
fi
EXTRA_FLAGS=""
[[ "$GPU" == off ]] && EXTRA_FLAGS="--disable-gpu --disable-gpu-compositing"

# VM-ben (pl. UTM + virgl) az X gyorsított (glamor) rajzolása nem jut ki a képernyőre:
# csak az első kép látszik, az ablakok nem. Szoftveres X rajzolás kell.
install -d /etc/X11/xorg.conf.d
if [[ -n "${VIRT:-}" && "${VIRT:-none}" != none && "$GPU" == off ]]; then
  cat > /etc/X11/xorg.conf.d/20-signage-vm.conf <<'XEOF'
# Narancs Signage: szoftveres X rajzolás virtuális gépen
Section "Device"
  Identifier "signage-vm"
  Driver "modesetting"
  Option "AccelMethod" "none"
EndSection
XEOF
  c_ok "VM grafika: szoftveres X rajzolás beállítva"
else
  rm -f /etc/X11/xorg.conf.d/20-signage-vm.conf
fi

cat > /etc/narancs-signage/player.conf <<EOF
SERVER="$SERVER"
DEVICE="$DEVICE"
CHROMIUM="$CHROMIUM"
ROTATE="$ROTATE"
# További Chromium kapcsolók (pl. GPU nélküli megjelenítés). Módosítás után: sudo reboot
EXTRA_FLAGS="$EXTRA_FLAGS"
EOF

# ---------- Automatikus bejelentkezés a tty1-en ----------
install -d /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear %I \$TERM
EOF

# Csak X engedélyezése nem-konzol felhasználónak
if [[ -f /etc/X11/Xwrapper.config ]]; then
  sed -i 's/^allowed_users=.*/allowed_users=anybody/' /etc/X11/Xwrapper.config
  grep -q needs_root_rights /etc/X11/Xwrapper.config || echo "needs_root_rights=yes" >> /etc/X11/Xwrapper.config
else
  printf 'allowed_users=anybody\nneeds_root_rights=yes\n' > /etc/X11/Xwrapper.config
fi

# ---------- Indító szkriptek ----------
cat > "$HOME_DIR/.bash_profile" <<'EOF'
# Narancs Signage: a tty1-en automatikusan elindul a kioszk
if [[ -z "$DISPLAY" && "$(tty)" == "/dev/tty1" ]]; then
  exec startx -- -nocursor >"$HOME/.signage-x.log" 2>&1
fi
EOF

cat > /usr/local/bin/signage-kiosk <<'EOF'
#!/usr/bin/env bash
# Chromium kioszk indítása, összeomlás esetén újraindítás
. /etc/narancs-signage/player.conf
# a snap-es Chromium csak a saját snap mappájába írhat
if [[ "$CHROMIUM" == /snap/* ]]; then PROFILE="$HOME/snap/chromium/common/signage-profile"; else PROFILE="$HOME/.config/signage-chromium"; fi
mkdir -p "$PROFILE"

xset s off; xset s noblank; xset -dpms

# Opcionális hardveres forgatás (a lejátszó szoftveresen is tud forgatni)
if [[ -n "$ROTATE" ]]; then
  OUT="$(xrandr | awk '/ connected/{print $1; exit}')"
  case "$ROTATE" in
    90)  xrandr --output "$OUT" --rotate right ;;
    180) xrandr --output "$OUT" --rotate inverted ;;
    270) xrandr --output "$OUT" --rotate left ;;
  esac
fi

ORIGIN="$(echo "$SERVER" | sed -E 's#^(https?://[^/]+).*#\1#')"

# Kifejezett ablakméret: egyes környezetekben (pl. VM) a Chromium kioszk ablaka különben 1×1 pixeles marad
screen_size() { xrandr 2>/dev/null | sed -n 's/.*current \([0-9]*\) x \([0-9]*\).*/\1,\2/p' | head -1; }
/usr/local/bin/signage-power &

# Várakozás a hálózatra és a szerverre (VM-en / Wi-Fi-n a hálózat később áll fel, mint az X).
# Közben narancs háttér jelzi, hogy az eszköz él. Max. 3 perc, utána mindenképp indul
# (a lejátszó maga is újrapróbálkozik és kiírja a hibát).
xsetroot -solid '#f59e5b' 2>/dev/null || true
for i in $(seq 1 90); do
  curl -fs --max-time 3 "$ORIGIN/healthz" >/dev/null 2>&1 && break
  sleep 2
done
# a böngésző alatt fekete háttér (ha bármi kilógna, ne narancs legyen)
xsetroot -solid '#000000' 2>/dev/null || true

# Ablakkezelő nélkül a Chromium ablaka néha 1 pixellel kisebb a képernyőnél:
# az indulás után pontosan a képernyő méretére igazítjuk
fit_window() {
  local w h
  for i in $(seq 1 40); do
    sleep 1
    IFS=, read -r w h <<< "$(screen_size)"
    [[ -n "$w" ]] || continue
    for win in $(xdotool search --onlyvisible --class chromium 2>/dev/null); do
      xdotool windowmove "$win" 0 0 windowsize "$win" "$w" "$h" 2>/dev/null
    done
  done
}

while true; do
  . /etc/narancs-signage/player.conf   # módosított kapcsolók érvényesítése újraindításkor
  SIZE="$(screen_size)"
  SIZE_FLAGS=""
  [[ -n "$SIZE" ]] && SIZE_FLAGS="--window-position=0,0 --window-size=$SIZE"
  # profil beállítások: hibás ablakpozíció törlése, Google Fordító kikapcsolása
  mkdir -p "$PROFILE/Default"
  [[ -s "$PROFILE/Default/Preferences" ]] || echo '{}' > "$PROFILE/Default/Preferences"
  jq 'del(.browser.window_placement, .browser.app_window_placement)
      | .translate.enabled = false | .translate_blocked_languages = ["hu"]
      | .intl.accept_languages = "hu-HU,hu"' "$PROFILE/Default/Preferences" > "$PROFILE/prefs.tmp" 2>/dev/null \
    && mv "$PROFILE/prefs.tmp" "$PROFILE/Default/Preferences"
  # "Chromium nem állt le megfelelően" buborék elkerülése
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PROFILE/Default/Preferences" 2>/dev/null || true
  "$CHROMIUM" \
    --kiosk --start-fullscreen --noerrdialogs --disable-infobars --no-first-run \
    --disable-session-crashed-bubble --disable-translate --lang=hu-HU --accept-lang=hu-HU,hu \
    --disable-features=Translate,TranslateUI,TranslateBubbleUpdate \
    --check-for-update-interval=31536000 --overscroll-history-navigation=0 --disable-pinch \
    --autoplay-policy=no-user-gesture-required --password-store=basic \
    --unsafely-treat-insecure-origin-as-secure="$ORIGIN" \
    --disable-background-networking \
    --user-data-dir="$PROFILE" \
    $SIZE_FLAGS $EXTRA_FLAGS \
    "$SERVER/player/?device=$DEVICE" &
  CPID=$!
  fit_window &
  FPID=$!
  wait "$CPID"
  kill "$FPID" 2>/dev/null
  sleep 3
done
EOF
chmod +x /usr/local/bin/signage-kiosk

# Monitor be/kikapcsolás az admin felületen megadott üzemidő szerint (DPMS)
cat > /usr/local/bin/signage-power <<'EOF'
#!/usr/bin/env bash
. /etc/narancs-signage/player.conf
state=on
while true; do
  cfg="$(curl -fs --max-time 10 "$SERVER/api/player/config?device=$DEVICE" 2>/dev/null || true)"
  if [[ -n "$cfg" ]]; then
    want="$(echo "$cfg" | jq -r '
      .screen.settings as $s
      | if ($s.power_schedule // false) | not then "on" else
          (now | localtime) as $t
          | ($t[6] | if . == 0 then 7 else . end) as $dow
          | ($t[3]*60 + $t[4]) as $m
          | (($s.on_time // "00:00") | split(":") | (.[0]|tonumber)*60 + (.[1]|tonumber)) as $f
          | (($s.off_time // "24:00") | split(":") | (.[0]|tonumber)*60 + (.[1]|tonumber)) as $e
          | if (($s.on_days // []) | length) > 0 and (($s.on_days | index($dow)) == null) then "off"
            elif $f <= $e then (if $m >= $f and $m < $e then "on" else "off" end)
            else (if $m >= $f or $m < $e then "on" else "off" end) end
        end' 2>/dev/null || echo on)"
    if [[ "$want" != "$state" ]]; then
      if [[ "$want" == off ]]; then xset +dpms; xset dpms force off; else xset dpms force on; xset -dpms; xset s reset; fi
      state="$want"
    fi
  fi
  sleep 60
done
EOF
chmod +x /usr/local/bin/signage-power

cat > /usr/local/bin/signage-diag <<'EOF'
#!/usr/bin/env bash
# Narancs Signage lejátszó – hibakereső
. /etc/narancs-signage/player.conf
ok() { printf '\033[1;32m✔\033[0m %s\n' "$*"; }; bad() { printf '\033[1;31m✘\033[0m %s\n' "$*"; }
echo "Szerver: $SERVER   Eszköz: $DEVICE"
ip -4 -br addr | grep -v '^lo' || true
ip route | grep -q default && ok "Van alapértelmezett átjáró" || bad "Nincs hálózati útvonal (DHCP?)"
if curl -fs --max-time 5 "$SERVER/healthz" >/dev/null; then ok "A szerver elérhető"; else
  bad "A szerver NEM érhető el: $SERVER"
  case "$SERVER" in *localhost*|*127.0.0.1*) echo "   ↳ A cím localhost – a telepítőt a szerver IP címével kell futtatni (nem localhost-tal)!";; esac
fi
r="$(curl -fs --max-time 5 "$SERVER/api/player/config?device=$DEVICE" 2>/dev/null)"
if [[ -n "$r" ]]; then
  if echo "$r" | jq -e '.paired' >/dev/null; then ok "Párosítva"; else echo "   Párosító kód: $(echo "$r" | jq -r '.code // "—"')"; fi
else bad "Az eszköz még nincs regisztrálva a szerveren (a lejátszó még nem kapcsolódott)"; fi
pgrep -f signage-kiosk >/dev/null && ok "Kioszk fut" || bad "A kioszk nem fut (nincs automatikus bejelentkezés a tty1-en?)"
pgrep -f -- "--kiosk" >/dev/null && ok "Chromium fut" || bad "A Chromium nem fut"
systemctl is-active -q narancs-signage-agent && ok "Távvezérlő ügynök fut" || bad "A távvezérlő ügynök nem fut (systemctl status narancs-signage-agent)"
echo "Virtualizáció: $(systemd-detect-virt 2>/dev/null || echo none)   Kapcsolók: ${EXTRA_FLAGS:-(nincs)}"
echo "GPU eszközök: $(ls /dev/dri 2>/dev/null | tr '\n' ' ')"
if command -v xdpyinfo >/dev/null; then
  sudo -u kiosk DISPLAY=:0 xdpyinfo 2>/dev/null | grep -E "dimensions|depth of root" | sed 's/^ */X: /'
  sudo -u kiosk DISPLAY=:0 xwininfo -root -children 2>/dev/null | grep -iE "chrom|[0-9]+x[0-9]+\+" | head -5 | sed 's/^ */Ablak: /'
fi
XLOG="$(ls -t /home/kiosk/.local/share/xorg/Xorg.0.log /var/log/Xorg.0.log 2>/dev/null | head -1)"
[[ -n "$XLOG" ]] && grep -E "\(II\) (modeset|fbdev|vesa)\(0\): (Output|Using|Depth|glamor)|Loading.*drivers" "$XLOG" | head -6 | sed 's/^/Xorg: /'
KH="$(getent passwd kiosk | cut -d: -f6)"
echo "--- X napló (utolsó 15 sor): $KH/.signage-x.log"
tail -n 15 "$KH/.signage-x.log" 2>/dev/null
EOF
chmod +x /usr/local/bin/signage-diag

# ---------- Távvezérlő ügynök (lejátszó / eszköz újraindítás az admin felületről) ----------
cat > /usr/local/bin/signage-agent <<'EOF'
#!/usr/bin/env bash
# Narancs Signage ügynök: a szerver élő csatornáján (SSE) érkező parancsokat hajtja végre.
#   restart – a lejátszó (X + Chromium kioszk) teljes újraindítása
#   reboot  – az eszköz újraindítása
. /etc/narancs-signage/player.conf
AGENT_VERSION=1

report() {
  local up ip os
  up="$(cut -d. -f1 /proc/uptime)"
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  os="$(. /etc/os-release; echo "$PRETTY_NAME")"
  curl -fs --max-time 10 -H 'Content-Type: application/json' -X POST "$SERVER/api/player/heartbeat" \
    -d "$(jq -nc --arg d "$DEVICE" --arg h "$(hostname)" --arg os "$os" --arg ip "$ip" --argjson up "${up:-0}" --argjson v "$AGENT_VERSION" \
      '{device: $d, info: {agent: {version: $v, seen: (now * 1000 | floor), host: $h, os: $os, ip: $ip, sys_uptime: $up}}}')" >/dev/null 2>&1 || true
}

handle() {
  case "$1" in
    restart)
      logger -t signage-agent "Parancs: lejátszó újraindítása"
      systemctl restart getty@tty1.service ;;
    reboot)
      logger -t signage-agent "Parancs: eszköz újraindítása"
      sleep 2; systemctl reboot ;;
  esac
}

# állapotjelentés percenként
( while true; do report; sleep 60; done ) &

while true; do
  curl -sN --max-time 0 "$SERVER/api/player/stream?device=$DEVICE&agent=1" 2>/dev/null | while IFS= read -r line; do
    [[ "$line" == data:* ]] || continue
    cmd="$(printf '%s' "${line#data:}" | jq -r '.command // empty' 2>/dev/null)"
    [[ -n "$cmd" ]] && handle "$cmd"
  done
  sleep 5   # kapcsolat megszakadt → újracsatlakozás
done
EOF
chmod +x /usr/local/bin/signage-agent

cat > /etc/systemd/system/narancs-signage-agent.service <<'EOF'
[Unit]
Description=Narancs Signage távvezérlő ügynök
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/signage-agent
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable narancs-signage-agent.service >/dev/null 2>&1
systemctl restart narancs-signage-agent.service
c_ok "Távvezérlő ügynök telepítve (újraindítás az admin felületről)"

# Ablakkezelő nélkül: egyetlen teljes képernyős ablakhoz nem kell, és VM-ekben (hiányos monitor
# információ mellett) az Openbox 1×1 pixeles keretbe tette a Chromiumot
cat > "$HOME_DIR/.xinitrc" <<'EOF'
#!/bin/sh
exec /usr/local/bin/signage-kiosk
EOF
chown "$KIOSK_USER:$KIOSK_USER" "$HOME_DIR/.bash_profile" "$HOME_DIR/.xinitrc"

# ---------- Rendszer finomhangolás ----------
# konzol elsötétítés kikapcsolása, gyors boot hálózat nélkül is
systemctl disable --now systemd-networkd-wait-online.service >/dev/null 2>&1 || true
systemctl set-default multi-user.target >/dev/null
if [[ $NIGHTLY_REBOOT -eq 1 ]]; then
  echo "30 4 * * * root /sbin/shutdown -r now" > /etc/cron.d/narancs-signage-reboot
  c_ok "Éjszakai újraindítás beállítva (04:30)"
fi

# Raspberry Pi: GPU memória és képernyő-kitöltés
for cfgfile in /boot/firmware/config.txt /boot/config.txt; do
  if [[ -f "$cfgfile" ]] && ! grep -q "narancs-signage" "$cfgfile"; then
    printf '\n# narancs-signage\ndisable_overscan=1\n' >> "$cfgfile"
    c_ok "Raspberry Pi beállítások: $cfgfile"
    break
  fi
done

systemctl daemon-reload
c_ok "A lejátszó telepítve! Eszköz azonosító: $DEVICE"
echo
echo "  Újraindítás után a képernyőn megjelenik egy 6 jegyű párosító kód."
echo "  Add meg az admin felületen: $SERVER/admin/  →  Képernyők → Új képernyő"
echo
echo "  Hibakeresés: sudo signage-diag"
echo "  Beállítások: /etc/narancs-signage/player.conf"
echo "  Napló:       $HOME_DIR/.signage-x.log"
echo
if [[ -t 0 ]]; then
  read -rp "Újraindítsam most? [I/n] " ans
  [[ "${ans:-i}" =~ ^[IiYy]$ ]] && reboot
else
  c_info "Indítsd újra az eszközt: sudo reboot"
fi
