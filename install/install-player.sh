#!/usr/bin/env bash
# =============================================================================
#  Narancs Signage – PLAYER (display) installer
#  Ubuntu Server 22.04/24.04 and Raspberry Pi OS Lite – arm64, armhf and amd64
#
#  Easiest, straight from the server:
#     curl -fsSL http://SERVER:8080/install-player.sh | sudo bash
#  or manually:
#     sudo ./install-player.sh http://SERVER:8080 [--rotate 90] [--nightly-reboot]
#
#  Graphics: software rendering is used automatically in a VM or without a GPU.
#     --no-gpu / --gpu  override the detection
#
#  Uninstall:
#     curl -fsSL http://SERVER:8080/install-player.sh | sudo bash -s -- --uninstall
#     (--purge: also removes Chromium and the graphics packages)
#
#  What does it do?
#   - minimal graphical environment (X11, no window manager, no desktop)
#   - Chromium in kiosk mode, restarted automatically if it crashes
#   - automatic login on tty1 with a dedicated "kiosk" user
#   - screen saver / power saving off; mouse pointer only while the mouse moves
#   - monitor on/off according to the operating hours set in the admin panel
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
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

c_ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
c_info() { printf '\033[1;33m➜ %s\033[0m\n' "$*"; }
c_err()  { printf '\033[1;31m✘ %s\033[0m\n' "$*" >&2; }

[[ $EUID -eq 0 ]] || { c_err "Run as root (sudo)."; exit 1; }

# ---------- Eltávolítás ----------
if [[ $UNINSTALL -eq 1 ]]; then
  c_info "Removing the Narancs Signage player…"
  if id "$KIOSK_USER" >/dev/null 2>&1; then
    loginctl terminate-user "$KIOSK_USER" 2>/dev/null || true
    pkill -KILL -u "$KIOSK_USER" 2>/dev/null || true
    sleep 1
    userdel -r "$KIOSK_USER" 2>/dev/null || userdel "$KIOSK_USER" 2>/dev/null || true
    c_ok "Kiosk user and Chromium profile removed"
  fi
  rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf
  rmdir /etc/systemd/system/getty@tty1.service.d 2>/dev/null || true
  systemctl disable --now narancs-signage-agent.service >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/narancs-signage-agent.service
  rm -f /usr/local/bin/signage-kiosk /usr/local/bin/signage-power /usr/local/bin/signage-diag /usr/local/bin/signage-agent
  rm -f /etc/cron.d/narancs-signage-reboot
  rm -rf /etc/narancs-signage
  rm -f /etc/X11/xorg.conf.d/20-signage-vm.conf /usr/local/bin/signage-tty-colors
  # bootkép és csendes indulás visszaállítása
  if [[ -d /usr/share/plymouth/themes/narancs ]]; then
    update-alternatives --remove default.plymouth /usr/share/plymouth/themes/narancs/narancs.plymouth >/dev/null 2>&1 || true
    rm -rf /usr/share/plymouth/themes/narancs /usr/share/narancs-signage /etc/initramfs-tools/conf.d/narancs-signage-splash
    update-initramfs -u >/dev/null 2>&1 || true
  fi
  if [[ -f /etc/default/grub.d/90-narancs-signage.cfg ]]; then rm -f /etc/default/grub.d/90-narancs-signage.cfg; update-grub >/dev/null 2>&1 || true; fi
  for cmdfile in /boot/firmware/cmdline.txt /boot/cmdline.txt; do
    [[ -f "$cmdfile.narancs-bak" ]] && mv "$cmdfile.narancs-bak" "$cmdfile"
  done
  systemctl daemon-reload
  systemctl restart getty@tty1.service 2>/dev/null || true
  c_ok "Automatic login, start scripts and device ID removed"
  if [[ $PURGE -eq 1 ]]; then
    c_info "Removing packages…"
    snap remove chromium >/dev/null 2>&1 || true
    apt-get purge -y -qq chromium chromium-browser >/dev/null 2>&1 || true
    apt-get purge -y -qq xserver-xorg xinit openbox >/dev/null 2>&1 || true
    apt-get autoremove -y -qq >/dev/null 2>&1 || true
    c_ok "Packages removed"
  fi
  echo
  c_ok "Done. Also delete the old screen in the admin panel under Screens (if it was paired)."
  exit 0
fi
if [[ "$SERVER" == *__SIGNAGE_SERVER__* || -z "$SERVER" ]]; then
  if [[ -t 0 ]]; then read -rp "Signage server address (e.g. http://192.168.1.10:8080): " SERVER; SERVER="${SERVER%/}"; fi
  [[ "$SERVER" =~ ^https?:// ]] || { c_err "Specify the server address: sudo $0 http://SERVER:8080"; exit 1; }
fi

ARCH="$(dpkg --print-architecture)"
. /etc/os-release
c_info "Installing the player – $PRETTY_NAME ($ARCH) → $SERVER"

if ! curl -fs --max-time 5 "$SERVER/healthz" >/dev/null 2>&1; then
  c_info "Warning: the server is not reachable right now ($SERVER). Installation continues; the player will connect later."
fi

# ---------- Csomagok ----------
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
c_info "Installing the graphical environment (X11)…"
apt-get install -y -qq --no-install-recommends \
  xserver-xorg xserver-xorg-input-libinput x11-xserver-utils x11-utils xdotool xinit \
  curl jq ca-certificates fonts-noto-color-emoji fonts-dejavu-core dbus-x11 feh plymouth plymouth-themes plymouth-label >/dev/null
# Egérmutató elrejtése X szinten (az unclutter-xfixes az újabb változat; ha nincs, a régi unclutter)
apt-get install -y -qq --no-install-recommends unclutter-xfixes >/dev/null 2>&1 \
  || apt-get install -y -qq --no-install-recommends unclutter >/dev/null 2>&1 \
  || c_info "Warning: unclutter could not be installed – without a mouse the pointer is moved to the screen corner"

c_info "Installing Chromium…"
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
[[ -x "$CHROMIUM" ]] || { c_err "Chromium installation failed."; exit 1; }
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
  c_info "Graphics acceleration: $GPU${VIRT:+ (virtualization: $VIRT)}"
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
  c_ok "VM graphics: software X rendering configured"
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
cat > /usr/local/bin/signage-tty-colors <<'EOF'
#!/bin/sh
# A tty1 konzol minden színét narancsra állítja és elrejti a kurzort: ha a grafikus felület
# éppen nem fut (indulás, újraindítás), szöveg helyett egyszínű narancs képernyő látszik
TTY=${1:-/dev/tty1}
for i in 0 1 2 3 4 5 6 7 8 9 A B C D E F; do printf '\033]P%sf59e5b' "$i"; done > "$TTY" 2>/dev/null
printf '\033[?25l\033[2J\033[H' > "$TTY" 2>/dev/null
exit 0
EOF
chmod +x /usr/local/bin/signage-tty-colors

cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStartPre=-/usr/local/bin/signage-tty-colors /dev/tty1
ExecStart=
ExecStart=-/sbin/agetty --autologin $KIOSK_USER --noclear --noissue --nohostname --nonewline %I \$TERM
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
  /usr/local/bin/signage-tty-colors "$(tty)"
  # -background none: az X a konzol (narancs) képét hagyja meg induláskor, nem villan fekete
  exec startx -- -background none >"$HOME/.signage-x.log" 2>&1
fi
EOF
touch "$HOME_DIR/.hushlogin"   # nincs „Last login” és MOTD szöveg

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
# háttér: ugyanaz a logós kép, mint a bootképernyő – böngésző újraindításkor is ez látszik
# set_splash 1|2|3|restart → splash-<n>.png (folyamatjelző 65/75/85%), különben a sima logós kép
set_splash() {
  local f="/usr/share/narancs-signage/splash${1:+-$1}.png"
  [[ -f "$f" ]] || f=/usr/share/narancs-signage/splash.png
  if [[ -f "$f" ]] && command -v feh >/dev/null; then feh --no-fehbg --bg-fill "$f"; else xsetroot -solid '#f59e5b'; fi 2>/dev/null || true
}
set_splash 1
# az X saját (kereszt alakú) mutatója helyett üres mutató a háttéren; a lejátszó maga kezeli,
# mikor látszik az egérmutató (egérmozgatáskor, vagy ha az admin felületen mindig látszik)
printf '#define b_width 1\n#define b_height 1\nstatic unsigned char b_bits[] = { 0x00 };\n' > /tmp/signage-blank.xbm
xsetroot -cursor /tmp/signage-blank.xbm /tmp/signage-blank.xbm 2>/dev/null || true
# A Chromium a CSS „cursor: none”-t csak egérmozgás után alkalmazza: egér nélkül (pl. Raspberry Pi
# érintőképernyővel) az X nyila a képernyő közepén maradna. Az unclutter X szinten rejti el:
# rejtve indul, mozgatáskor megjelenik, 3 mp tétlenség és érintés után eltűnik. Tablet módban a
# lejátszó CSS-e mozgatáskor is rejtve tartja.
if command -v unclutter >/dev/null; then
  if unclutter --help 2>&1 | grep -q -- '--start-hidden'; then
    unclutter --timeout 3 --start-hidden --hide-on-touch --fork 2>/dev/null || true
  else
    unclutter -idle 3 -root >/dev/null 2>&1 &
  fi
fi
set_splash 2
for i in $(seq 1 90); do
  curl -fs --max-time 3 "$ORIGIN/healthz" >/dev/null 2>&1 && break
  sleep 2
done

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
    # a mutató a jobb alsó sarokba: így a Chromium megkapja az első egérmozgást (érvényesül a
    # rejtett mutató), és ha unclutter nélkül mégis látszana, nem a kép közepén van
    [[ $i -eq 8 ]] && xdotool mousemove "$((w - 1))" "$((h - 1))" 2>/dev/null
  done
}

FIRST=1
while true; do
  if [[ $FIRST -eq 1 ]]; then set_splash 3; FIRST=0; fi
  . /etc/narancs-signage/player.conf   # módosított kapcsolók érvényesítése újraindításkor
  SIZE="$(screen_size)"
  SIZE_FLAGS=""
  [[ -n "$SIZE" ]] && SIZE_FLAGS="--window-position=0,0 --window-size=$SIZE"
  # profil beállítások: hibás ablakpozíció törlése, Google Fordító kikapcsolása
  mkdir -p "$PROFILE/Default"
  [[ -s "$PROFILE/Default/Preferences" ]] || echo '{}' > "$PROFILE/Default/Preferences"
  jq 'del(.browser.window_placement, .browser.app_window_placement)
      | .translate.enabled = false | .translate_blocked_languages = ["en", "hu"]
      | .intl.accept_languages = "en-US,en,hu-HU,hu"' "$PROFILE/Default/Preferences" > "$PROFILE/prefs.tmp" 2>/dev/null \
    && mv "$PROFILE/prefs.tmp" "$PROFILE/Default/Preferences"
  # "Chromium nem állt le megfelelően" buborék elkerülése
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PROFILE/Default/Preferences" 2>/dev/null || true
  "$CHROMIUM" \
    --kiosk --start-fullscreen --noerrdialogs --disable-infobars --no-first-run \
    --disable-session-crashed-bubble --disable-translate --lang=en-US --accept-lang=en-US,en,hu-HU,hu \
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
  set_splash restart   # a böngésző leállt / újraindul: „Lejátszó újraindítása…”
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
echo "Server: $SERVER   Device: $DEVICE"
ip -4 -br addr | grep -v '^lo' || true
ip route | grep -q default && ok "Default gateway present" || bad "No network route (DHCP?)"
if curl -fs --max-time 5 "$SERVER/healthz" >/dev/null; then ok "Server reachable"; else
  bad "Server NOT reachable: $SERVER"
  case "$SERVER" in *localhost*|*127.0.0.1*) echo "   ↳ The address is localhost – run the installer with the server's IP address (not localhost)!";; esac
fi
r="$(curl -fs --max-time 5 "$SERVER/api/player/config?device=$DEVICE" 2>/dev/null)"
if [[ -n "$r" ]]; then
  if echo "$r" | jq -e '.paired' >/dev/null; then ok "Paired"; else echo "   Pairing code: $(echo "$r" | jq -r '.code // "—"')"; fi
else bad "The device is not registered on the server yet (the player has not connected)"; fi
pgrep -f signage-kiosk >/dev/null && ok "Kiosk running" || bad "Kiosk not running (no automatic login on tty1?)"
pgrep -f -- "--kiosk" >/dev/null && ok "Chromium running" || bad "Chromium not running"
pgrep -x unclutter >/dev/null && ok "Pointer hiding (unclutter) running" || bad "unclutter not running – without a mouse the pointer may be visible (run the installer again)"
systemctl is-active -q narancs-signage-agent && ok "Remote agent running" || bad "Remote agent not running (systemctl status narancs-signage-agent)"
echo "Virtualization: $(systemd-detect-virt 2>/dev/null || echo none)   Flags: ${EXTRA_FLAGS:-(none)}"
echo "GPU devices: $(ls /dev/dri 2>/dev/null | tr '\n' ' ')"
if command -v xdpyinfo >/dev/null; then
  sudo -u kiosk DISPLAY=:0 xdpyinfo 2>/dev/null | grep -E "dimensions|depth of root" | sed 's/^ */X: /'
  sudo -u kiosk DISPLAY=:0 xwininfo -root -children 2>/dev/null | grep -iE "chrom|[0-9]+x[0-9]+\+" | head -5 | sed 's/^ */Window: /'
fi
XLOG="$(ls -t /home/kiosk/.local/share/xorg/Xorg.0.log /var/log/Xorg.0.log 2>/dev/null | head -1)"
[[ -n "$XLOG" ]] && grep -E "\(II\) (modeset|fbdev|vesa)\(0\): (Output|Using|Depth|glamor)|Loading.*drivers" "$XLOG" | head -6 | sed 's/^/Xorg: /'
KH="$(getent passwd kiosk | cut -d: -f6)"
echo "--- X log (last 15 lines): $KH/.signage-x.log"
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
      logger -t signage-agent "Command: restart player"
      # ha fut a grafikus felület, csak a böngészőt indítjuk újra (közben a logós háttér látszik)
      if pgrep -f -- '--kiosk' >/dev/null; then pkill -f -- '--kiosk'; else systemctl restart getty@tty1.service; fi ;;
    reboot)
      logger -t signage-agent "Command: reboot device"
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
Description=Narancs Signage remote agent
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
c_ok "Remote agent installed (restart from the admin panel)"

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
  c_ok "Nightly reboot configured (04:30)"
fi

# ---------- Bootképernyő: logó narancs háttéren, szöveges üzenetek nélkül ----------
install -d /usr/share/narancs-signage
for f in splash.png splash-1.png splash-2.png splash-3.png splash-restart.png logo.png bar_bg.png bar_fg.png; do
  curl -fsS --max-time 20 "${SERVER%/}/shared/splash/$f" -o "/usr/share/narancs-signage/$f" 2>/dev/null \
    || c_info "Boot image ($f) could not be downloaded now – it will be fetched when the installer runs again"
done
THEME_DIR=/usr/share/plymouth/themes/narancs
if [[ -f /usr/share/narancs-signage/logo.png ]]; then
  install -d "$THEME_DIR"
  cp /usr/share/narancs-signage/logo.png /usr/share/narancs-signage/bar_bg.png /usr/share/narancs-signage/bar_fg.png "$THEME_DIR/" 2>/dev/null || true
  cat > "$THEME_DIR/narancs.plymouth" <<'EOF'
[Plymouth Theme]
Name=Narancs Signage
Description=Narancs Signage boot screen
ModuleName=script

[script]
ImageDir=/usr/share/plymouth/themes/narancs
ScriptFile=/usr/share/plymouth/themes/narancs/narancs.script
EOF
  cat > "$THEME_DIR/narancs.script" <<'EOF'
# Narancs Signage bootképernyő: narancs háttér, tévé + félnap logó, folyamatjelző és állapotszöveg.
# Elrendezés = a grafikus felület képkockái és a lejátszó indulóképe (folyamatos átmenet).
Window.SetBackgroundTopColor(0.961, 0.620, 0.357);
Window.SetBackgroundBottomColor(0.878, 0.478, 0.208);
W = Window.GetWidth(); H = Window.GetHeight(); X0 = Window.GetX(); Y0 = Window.GetY();
M = Math.Min(W, H);
size = M * 0.34;
logo = Sprite(Image("logo.png").Scale(size, size));
logo.SetX(X0 + W / 2 - size / 2);
logo.SetY(Y0 + H / 2 - size / 2 - H * 0.04);

barw = Math.Min(W * 0.32, 520);
barh = Math.Max(6, H * 0.008);
bary = Y0 + H / 2 + size / 2 + H * 0.04;
bar_bg = Sprite(Image("bar_bg.png").Scale(barw, barh));
bar_bg.SetX(X0 + W / 2 - barw / 2); bar_bg.SetY(bary); bar_bg.SetZ(1);
fg_img = Image("bar_fg.png");
bar_fg = Sprite(); bar_fg.SetX(X0 + W / 2 - barw / 2); bar_fg.SetY(bary); bar_fg.SetZ(2);
txt = Sprite(); txt.SetY(bary + barh + H * 0.02); txt.SetZ(3);
fontpt = Math.Int(H * 0.018);
if (fontpt < 10) fontpt = 10;

fun set_text(t) {
  img = Image.Text(t, 1, 1, 1, 0.9, "DejaVu Sans " + fontpt);
  txt.SetImage(img);
  txt.SetX(X0 + W / 2 - img.GetWidth() / 2);
}
fun set_progress(p) {
  w = Math.Int(barw * p);
  if (w < 1) w = 1;
  bar_fg.SetImage(fg_img.Scale(w, barh));
}

mode = Plymouth.GetMode();
custom = "";
if (mode == "shutdown" || mode == "reboot") {
  bar_bg.SetOpacity(0);
  if (mode == "reboot") set_text("Restarting…"); else set_text("Shutting down…");
} else {
  set_progress(0.02);
  set_text("Starting system…");
}

# A rendszer betöltése a teljes sáv 0–60%-a; a többit a grafikus felület és a lejátszó adja
fun progress_cb(duration, progress) {
  if (mode == "shutdown" || mode == "reboot") return;
  set_progress(0.02 + progress * 0.58);
  if (custom == "") {
    if (progress < 0.25) set_text("Loading system…");
    else if (progress < 0.55) set_text("Starting devices and services…");
    else if (progress < 0.85) set_text("Connecting to the network…");
    else set_text("Starting display…");
  }
}
Plymouth.SetBootProgressFunction(progress_cb);

# „plymouth display-message --text=…” üzenetek megjelenítése (pl. saját lépések)
fun message_cb(t) { custom = t; set_text(t); }
Plymouth.SetMessageFunction(message_cb);
EOF
  if update-alternatives --list default.plymouth >/dev/null 2>&1; then
    update-alternatives --install /usr/share/plymouth/themes/default.plymouth default.plymouth "$THEME_DIR/narancs.plymouth" 200 >/dev/null
    update-alternatives --set default.plymouth "$THEME_DIR/narancs.plymouth" >/dev/null
  elif command -v plymouth-set-default-theme >/dev/null; then
    plymouth-set-default-theme narancs
  fi
  install -d /etc/initramfs-tools/conf.d
  echo "FRAMEBUFFER=y" > /etc/initramfs-tools/conf.d/narancs-signage-splash
  c_info "Setting up the boot screen (updating initramfs, this may take a minute)…"
  update-initramfs -u >/dev/null 2>&1 || c_info "Updating initramfs failed – the boot image will appear once the system has loaded"
fi
QUIET_ARGS="quiet splash loglevel=3 systemd.show_status=false rd.systemd.show_status=false udev.log_level=3 rd.udev.log_level=3 vt.global_cursor_default=0 plymouth.ignore-serial-consoles"
if command -v update-grub >/dev/null && [[ -d /etc/default ]]; then
  install -d /etc/default/grub.d
  cat > /etc/default/grub.d/90-narancs-signage.cfg <<EOF
# Narancs Signage: rejtett GRUB menü (Shift/Esc lenyomva előhozható), csendes indulás bootképpel
GRUB_TIMEOUT_STYLE=hidden
GRUB_TIMEOUT=0
GRUB_RECORDFAIL_TIMEOUT=0
GRUB_GFXPAYLOAD_LINUX=keep
GRUB_CMDLINE_LINUX_DEFAULT="$QUIET_ARGS"
EOF
  update-grub >/dev/null 2>&1 && c_ok "Quiet boot with boot screen configured (GRUB)"
fi
for cmdfile in /boot/firmware/cmdline.txt /boot/cmdline.txt; do
  if [[ -f "$cmdfile" ]]; then
    [[ -f "$cmdfile.narancs-bak" ]] || cp "$cmdfile" "$cmdfile.narancs-bak"
    line="$(tr -d '\n' < "$cmdfile.narancs-bak")"
    echo "$line $QUIET_ARGS logo.nologo" > "$cmdfile"
    c_ok "Quiet boot with boot screen configured (Raspberry Pi)"
    break
  fi
done

# Raspberry Pi: GPU memória és képernyő-kitöltés
for cfgfile in /boot/firmware/config.txt /boot/config.txt; do
  if [[ -f "$cfgfile" ]] && ! grep -q "narancs-signage" "$cfgfile"; then
    printf '\n# narancs-signage\ndisable_overscan=1\ndisable_splash=1\n' >> "$cfgfile"
    c_ok "Raspberry Pi settings: $cfgfile"
    break
  fi
done

systemctl daemon-reload
c_ok "Player installed! Device ID: $DEVICE"
echo
echo "  After a restart the screen shows a 6-digit pairing code."
echo "  Enter it in the admin panel: $SERVER/admin/  →  Screens → New screen"
echo
echo "  Troubleshooting: sudo signage-diag"
echo "  Settings:        /etc/narancs-signage/player.conf"
echo "  Log:             $HOME_DIR/.signage-x.log"
echo
if [[ -t 0 ]]; then
  read -rp "Restart now? [Y/n] " ans
  [[ "${ans:-y}" =~ ^[YyIi]$ ]] && reboot
else
  c_info "Restart the device: sudo reboot"
fi
