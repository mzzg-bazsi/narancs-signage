#!/usr/bin/env bash
# =============================================================================
#  Narancs Signage – first boot setup on the Raspberry Pi image
#  Runs once (narancs-firstboot.service): waits for the network, downloads the
#  latest installers from GitHub, installs, then restarts the device.
#  Settings: narancs-signage.txt on the boot partition.
# =============================================================================
set -uo pipefail

REPO=https://github.com/mzzg-bazsi/narancs-signage/releases/latest/download
DONE=/var/lib/narancs-signage-firstboot.done
MODE="$(cat /etc/narancs-signage/image-mode 2>/dev/null || echo screen)"   # screen | all-in-one | server

say() { printf '\n\033[1;33m[Narancs Signage] %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m[Narancs Signage] %s\033[0m\n' "$*"; echo "Details: journalctl -u narancs-firstboot. It will be retried at the next start."; exit 1; }

# beállítások a boot partícióról (KULCS=érték sorok; nem futtatjuk, csak kiolvassuk)
CFG=""
for f in /boot/firmware/narancs-signage.txt /boot/narancs-signage.txt; do [[ -f "$f" ]] && CFG="$f" && break; done
conf() { [[ -n "$CFG" ]] && sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$CFG" | tr -d '\r"' | tail -1; }
SERVER="$(conf SERVER)"; SERVER="${SERVER%/}"
PORT="$(conf PORT)"; PORT="${PORT:-8080}"
ROTATE="$(conf ROTATE)"
NIGHTLY="$(conf NIGHTLY_REBOOT)"
[[ "$PORT" =~ ^[0-9]+$ ]] || fail "PORT must be a number in narancs-signage.txt."

if [[ "$MODE" == screen ]] && [[ ! "$SERVER" =~ ^https?:// ]]; then
  say "This is the display (screen) image. Set the server address in narancs-signage.txt on the"
  say "boot partition, e.g.  SERVER=http://192.168.1.10:8080  – then restart the device."
  exit 0
fi

say "First start: installing Narancs Signage ($MODE). This takes 5–15 minutes, do not turn off the device."

# hálózat (és pontos idő a TLS-hez) – Wi-Fi a Raspberry Pi Imagerben állítható be
for i in $(seq 1 120); do
  curl -fsI --max-time 10 https://github.com >/dev/null 2>&1 && break
  (( i % 6 == 1 )) && say "Waiting for the network (Ethernet, or Wi-Fi set in Raspberry Pi Imager)…"
  sleep 10
done
curl -fsI --max-time 10 https://github.com >/dev/null 2>&1 || fail "No internet connection."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [[ "$MODE" == all-in-one || "$MODE" == server ]]; then
  say "Installing the server…"
  curl -fsSL "$REPO/install.sh" -o "$TMP/install.sh" || fail "Could not download the server installer."
  bash "$TMP/install.sh" --port "$PORT" </dev/null || fail "Server installation failed."
  SERVER="http://localhost:$PORT"
fi

if [[ "$MODE" != server ]]; then
  say "Installing the display (player) → $SERVER"
  curl -fsSL "$REPO/install-player.sh" -o "$TMP/install-player.sh" || fail "Could not download the player installer."
  ARGS=("$SERVER")
  [[ -n "$ROTATE" ]] && ARGS+=(--rotate "$ROTATE")
  [[ "$NIGHTLY" =~ ^(1|yes|true|on)$ ]] && ARGS+=(--nightly-reboot)
  bash "$TMP/install-player.sh" "${ARGS[@]}" </dev/null || fail "Player installation failed."
fi

mkdir -p "$(dirname "$DONE")" && date -Is > "$DONE"
systemctl disable narancs-firstboot.service >/dev/null 2>&1 || true
say "Installation complete. Restarting…"
if [[ "$MODE" == server ]]; then
  # a bejelentkező képernyőn (és SSH-nál) látsszon az admin felület címe (\4 = az eszköz IPv4 címe)
  mkdir -p /etc/issue.d
  printf 'Narancs Signage admin panel: http://\\4:%s/admin/\n\n' "$PORT" > /etc/issue.d/narancs-signage.issue
fi
if [[ "$MODE" != screen ]]; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  say "Admin panel: http://${IP:-<this-device>}:$PORT/admin/  (create your account$([[ "$MODE" == all-in-one ]] && echo ", then pair this screen with the code it shows"))"
fi
sleep 10
systemctl reboot
