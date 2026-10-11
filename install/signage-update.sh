#!/usr/bin/env bash
# =============================================================================
#  Narancs Signage – update to the latest release (started from the admin panel)
#
#     sudo signage-update      – update now (same as the admin panel button)
#
#  The admin panel writes <data>/update/request.json; the narancs-signage-update.path
#  unit runs this script as root, in its own service, so it survives the restart of
#  the server. The request has no parameters: it always installs the latest release.
# =============================================================================
set -uo pipefail

DATA_DIR="${SIGNAGE_DATA:-/var/lib/narancs-signage}"
PORT="${SIGNAGE_PORT:-8080}"
UP="$DATA_DIR/update"
URL=https://github.com/mzzg-bazsi/narancs-signage/releases/latest/download/install.sh

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo signage-update"; exit 1; }
mkdir -p "$UP"
rm -f "$UP/request.json"
date +%s000 > "$UP/running"
result() { # ok üzenet
  node -e 'const [f, ok, msg] = process.argv.slice(1); require("fs").writeFileSync(f, JSON.stringify({ ok: ok === "1", error: msg || null, at: Date.now() }));' "$UP/result.json" "$1" "$2"
  chown signage:signage "$UP/result.json" "$UP/log.txt" 2>/dev/null || true
  rm -f "$UP/running"
}

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
{
  echo "== $(date -Is) update started"
  curl -fsSL "$URL" -o "$TMP" && bash "$TMP" --port "$PORT" --data "$DATA_DIR" </dev/null
} > "$UP/log.txt" 2>&1
if [[ $? -eq 0 ]]; then result 1 ""; echo "Update complete."; else result 0 "The update failed – see the log."; tail -20 "$UP/log.txt"; exit 1; fi
