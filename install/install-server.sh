#!/usr/bin/env bash
# =============================================================================
#  Narancs Signage – SERVER installer (Ubuntu Server 22.04 / 24.04, amd64 + arm64)
#
#  Usage (from the project folder):
#     sudo ./install/install-server.sh [--port 8080] [--data /var/lib/narancs-signage]
#
#  Running it again updates the program; your data (database, media) is kept.
# =============================================================================
set -euo pipefail

PORT=8080
APP_DIR=/opt/narancs-signage
DATA_DIR=/var/lib/narancs-signage
SERVICE=narancs-signage
NODE_MAJOR=24

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --data) DATA_DIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

c_ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
c_info() { printf '\033[1;33m➜ %s\033[0m\n' "$*"; }
c_err()  { printf '\033[1;31m✘ %s\033[0m\n' "$*" >&2; }

[[ $EUID -eq 0 ]] || { c_err "Run as root: sudo $0"; exit 1; }
command -v apt-get >/dev/null || { c_err "This installer is for Ubuntu/Debian (apt is required)."; exit 1; }

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$SRC_DIR/server/src/server.js" ]] || { c_err "Server files not found in: $SRC_DIR/server"; exit 1; }

ARCH="$(dpkg --print-architecture)"
c_info "Installing the Narancs Signage server ($ARCH, port: $PORT)"

# ---------- Node.js ----------
need_node=1
if command -v node >/dev/null; then
  v="$(node -p 'process.versions.node')"
  maj="${v%%.*}"; rest="${v#*.}"; min="${rest%%.*}"
  if (( maj > 22 || (maj == 22 && min >= 13) )); then need_node=0; c_ok "Node.js $v is already installed"; fi
fi
if (( need_node )); then
  case "$ARCH" in
    amd64|arm64) ;;
    *) c_err "The server needs a 64-bit system (amd64/arm64). On 32-bit ARM only the player runs."; exit 1 ;;
  esac
  c_info "Installing Node.js $NODE_MAJOR (NodeSource)…"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg >/dev/null
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
  c_ok "Node.js $(node -v) installed"
fi

# ---------- Felhasználó és fájlok ----------
id signage >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin signage
install -d -o signage -g signage -m 0750 "$DATA_DIR" "$DATA_DIR/media"
install -d -m 0755 "$APP_DIR"
c_info "Copying program files to $APP_DIR"
rm -rf "$APP_DIR/server.new"
cp -r "$SRC_DIR/server" "$APP_DIR/server.new"
rm -rf "$APP_DIR/server.new/data"
rm -rf "$APP_DIR/server.old"; [[ -d "$APP_DIR/server" ]] && mv "$APP_DIR/server" "$APP_DIR/server.old"
mv "$APP_DIR/server.new" "$APP_DIR/server"
rm -rf "$APP_DIR/install"; cp -r "$SRC_DIR/install" "$APP_DIR/install"
chown -R root:root "$APP_DIR"

# ---------- systemd szolgáltatás ----------
cat > /etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=Narancs Signage server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=signage
Group=signage
WorkingDirectory=$APP_DIR/server
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=SIGNAGE_DATA=$DATA_DIR
ExecStart=$(command -v node) --disable-warning=ExperimentalWarning $APP_DIR/server/src/server.js
Restart=always
RestartSec=3
# Biztonsági korlátozások
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA_DIR
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

# ---------- Mentés segédprogram ----------
cat > /usr/local/bin/signage-backup <<EOF
#!/usr/bin/env bash
# Teljes mentés (adatbázis + média) a /var/backups/narancs-signage mappába
set -e
DEST=/var/backups/narancs-signage
mkdir -p "\$DEST"
STAMP=\$(date +%Y%m%d-%H%M%S)
sqlite_tmp="$DATA_DIR/backup-\$STAMP.db"
# konzisztens adatbázis pillanatkép a futó szerver mellett
sudo -u signage node --disable-warning=ExperimentalWarning -e "new (require('node:sqlite').DatabaseSync)('$DATA_DIR/signage.db').exec(\"VACUUM INTO '\$sqlite_tmp'\")"
tar -czf "\$DEST/signage-\$STAMP.tar.gz" -C "$DATA_DIR" media "backup-\$STAMP.db"
rm -f "\$sqlite_tmp"
ls -1t "\$DEST"/signage-*.tar.gz | tail -n +15 | xargs -r rm -f   # 14 mentést tartunk meg
echo "Backup done: \$DEST/signage-\$STAMP.tar.gz"
EOF
chmod +x /usr/local/bin/signage-backup
# napi automatikus mentés hajnali 3-kor
echo "0 3 * * * root /usr/local/bin/signage-backup >/dev/null 2>&1" > /etc/cron.d/narancs-signage-backup

systemctl daemon-reload
systemctl enable --now $SERVICE >/dev/null 2>&1
systemctl restart $SERVICE

# ---------- Tűzfal ----------
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow "$PORT"/tcp >/dev/null && c_ok "Firewall: $PORT/tcp allowed"
fi

# ---------- Ellenőrzés ----------
for i in {1..20}; do
  curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break
  sleep 0.5
done
if ! curl -fs "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
  c_err "The server did not start. Logs: journalctl -u $SERVICE -n 50"
  exit 1
fi
rm -rf "$APP_DIR/server.old"

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
c_ok "The Narancs Signage server is running!"
echo
echo "  Admin panel:        http://${IP:-<server-ip>}:$PORT/admin/"
echo "  Player (browser):   http://${IP:-<server-ip>}:$PORT/player/"
echo
echo "  Install a display (run this on the display device):"
echo "     curl -fsSL http://${IP:-<server-ip>}:$PORT/install-player.sh | sudo bash"
echo
echo "  Useful commands:"
echo "     systemctl status $SERVICE      – status"
echo "     journalctl -u $SERVICE -f      – logs"
echo "     sudo signage-backup            – backup (also runs automatically every day)"
echo
