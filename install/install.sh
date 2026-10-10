#!/usr/bin/env bash
# =============================================================================
#  Narancs Signage – one-line SERVER installer from GitHub (Linux + macOS)
#
#  Ubuntu / Debian:  curl -fsSL https://github.com/mzzg-bazsi/narancs-signage/releases/latest/download/install.sh | sudo bash
#  macOS:            curl -fsSL https://github.com/mzzg-bazsi/narancs-signage/releases/latest/download/install.sh | bash
#  Options:          ... | bash -s -- --port 8080
#
#  Running it again updates the program; your data is kept.
#  Other systems: Docker (ghcr.io/mzzg-bazsi/narancs-signage)
# =============================================================================
set -euo pipefail

REPO=mzzg-bazsi/narancs-signage
VERSION="__VERSION__"   # a kiadáskor a release.sh írja be; kézi futtatásnál a legfrissebb kiadás
PORT=8080
PASS=()   # a Linux szerver telepítőnek továbbadott kapcsolók (--port, --data)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; PASS+=("$1" "$2"); shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    -h|--help) sed -n '2,11p' "$0" 2>/dev/null || true; exit 0 ;;
    *) PASS+=("$1"); shift ;;
  esac
done

c_ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
c_info() { printf '\033[1;33m➜ %s\033[0m\n' "$*"; }
c_err()  { printf '\033[1;31m✘ %s\033[0m\n' "$*" >&2; }

node_ok() {
  command -v node >/dev/null || return 1
  local v maj rest min
  v="$(node -p 'process.versions.node')"; maj="${v%%.*}"; rest="${v#*.}"; min="${rest%%.*}"
  (( maj > 22 || (maj == 22 && min >= 13) ))
}

# ---------- Forrás letöltése a GitHubról ----------
if [[ "$VERSION" == __* || "$VERSION" == latest ]]; then
  VERSION="$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest")"
  VERSION="${VERSION##*/}"
fi
VERSION="${VERSION#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { c_err "Could not determine the version to install."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
c_info "Downloading Narancs Signage v$VERSION"
curl -fsSL "https://github.com/$REPO/archive/refs/tags/v$VERSION.tar.gz" | tar -xz -C "$TMP"
SRC="$TMP/narancs-signage-$VERSION"
[[ -f "$SRC/server/src/server.js" ]] || { c_err "The download is incomplete."; exit 1; }

case "$(uname -s)" in
  # ---------- Linux: a teljes szerver telepítő (systemd, mentés, tűzfal) ----------
  Linux)
    if ! command -v apt-get >/dev/null; then
      c_err "This installer supports Ubuntu/Debian. On other systems use Docker:"
      echo "   docker run -d --name narancs-signage -p $PORT:8080 -v narancs-signage:/data --restart unless-stopped ghcr.io/$REPO:$VERSION"
      exit 1
    fi
    [[ $EUID -eq 0 ]] || { c_err "Run as root: curl -fsSL https://github.com/$REPO/releases/latest/download/install.sh | sudo bash"; exit 1; }
    bash "$SRC/install/install-server.sh" ${PASS[@]+"${PASS[@]}"}
    ;;

  # ---------- macOS: felhasználói LaunchAgent, a gép indításakor (bejelentkezéskor) elindul ----------
  Darwin)
    [[ $EUID -ne 0 ]] || { c_err "On macOS run it without sudo."; exit 1; }
    if ! node_ok; then
      if command -v brew >/dev/null; then
        c_info "Installing Node.js (Homebrew)…"
        brew install node >/dev/null
      else
        c_err "Node.js 22.13 or newer is required. Install it from https://nodejs.org (or Homebrew), then run this again."
        exit 1
      fi
      node_ok || { c_err "Node.js 22.13 or newer is required (found: $(node -v 2>/dev/null || echo none))."; exit 1; }
    fi
    c_ok "Node.js $(node -v)"

    HOME_DIR="$HOME/Library/Application Support/Narancs Signage"
    LABEL=hu.narancs.signage
    PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
    mkdir -p "$HOME_DIR/data" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -rf "$HOME_DIR/server"
    cp -R "$SRC/server" "$HOME_DIR/server"
    rm -rf "$HOME_DIR/server/data"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$(command -v node)</string><string>--disable-warning=ExperimentalWarning</string><string>src/server.js</string>
  </array>
  <key>WorkingDirectory</key><string>$HOME_DIR/server</string>
  <key>EnvironmentVariables</key><dict>
    <key>PORT</key><string>$PORT</string>
    <key>SIGNAGE_DATA</key><string>$HOME_DIR/data</string>
    <key>NODE_ENV</key><string>production</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/narancs-signage.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/narancs-signage.log</string>
</dict></plist>
EOF
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    for _ in {1..30}; do curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 0.5; done
    curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 || { c_err "The server did not start. Log: ~/Library/Logs/narancs-signage.log"; exit 1; }
    IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
    echo
    c_ok "The Narancs Signage server v$VERSION is running!"
    echo
    echo "  Admin panel:   http://localhost:$PORT/admin/"
    echo "  Install a display (run this on the display device):"
    echo "     curl -fsSL http://${IP:-<this-mac-ip>}:$PORT/install-player.sh | sudo bash"
    echo
    echo "  Data:          $HOME_DIR/data"
    echo "  Log:           ~/Library/Logs/narancs-signage.log"
    echo "  Stop / remove: launchctl bootout gui/\$(id -u)/$LABEL && rm \"$PLIST\""
    echo
    ;;

  *) c_err "Unsupported system: $(uname -s). Use Docker instead."; exit 1 ;;
esac
