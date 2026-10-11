#!/usr/bin/env bash
# =============================================================================
#  Narancs Signage – network settings of the server (Raspberry Pi, NetworkManager)
#
#     sudo signage-network status        – show the current settings
#     sudo signage-network dhcp          – back to automatic address (DHCP)
#     signage-network apply <file>       – apply a request from the admin panel (run by systemd)
#
#  The admin panel writes the request to <data>/network/request.json; the
#  narancs-signage-network.path unit runs this script as root. Every value is
#  validated here: the request comes from the web server.
# =============================================================================
set -uo pipefail

DATA_DIR="${SIGNAGE_DATA:-/var/lib/narancs-signage}"
NET_DIR="$DATA_DIR/network"

IP4='((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])'
is_ip() { [[ "$1" =~ ^${IP4}$ ]]; }
is_cidr() { [[ "$1" =~ ^${IP4}/([0-9]|[12][0-9]|3[0-2])$ ]]; }

# az alapértelmezett útvonal eszköze és a hozzá tartozó NetworkManager kapcsolat
DEV="$(ip -4 route show default 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit }}')"
CON=""
[[ -n "$DEV" ]] && CON="$(nmcli -g GENERAL.CONNECTION device show "$DEV" 2>/dev/null | head -1)"

# állapot JSON-ként (a node állítja elő, hogy az idézőjelek és különleges karakterek ne okozzanak gondot)
write_status() {
  local method="" addr="" gw="" dns=""
  if [[ -n "$CON" ]]; then
    method="$(nmcli -g ipv4.method connection show "$CON" 2>/dev/null)"
    addr="$(nmcli -g IP4.ADDRESS device show "$DEV" 2>/dev/null | head -1 | cut -d'|' -f1)"
    gw="$(nmcli -g IP4.GATEWAY device show "$DEV" 2>/dev/null | head -1)"
    dns="$(nmcli -g IP4.DNS device show "$DEV" 2>/dev/null | tr '|\n' ',,' | sed 's/,*$//')"
  fi
  mkdir -p "$NET_DIR"
  node -e 'const [f, dev, con, method, addr, gw, dns] = process.argv.slice(1);
    require("fs").writeFileSync(f, JSON.stringify({ device: dev, connection: con, method, address: addr, gateway: gw, dns: dns ? dns.split(",").filter(Boolean) : [], updated_at: Date.now() }));' \
    "$NET_DIR/status.json.tmp" "$DEV" "$CON" "$method" "$addr" "$gw" "$dns" && mv "$NET_DIR/status.json.tmp" "$NET_DIR/status.json"
  chown signage:signage "$NET_DIR/status.json" 2>/dev/null || true
}
write_result() { # id ok üzenet
  node -e 'const [f, id, ok, msg] = process.argv.slice(1); require("fs").writeFileSync(f, JSON.stringify({ id, ok: ok === "1", error: msg || null, at: Date.now() }));' \
    "$NET_DIR/result.json" "$1" "$2" "$3"
  chown signage:signage "$NET_DIR/result.json" 2>/dev/null || true
}

set_dhcp() {
  nmcli connection modify "$CON" ipv4.method auto ipv4.addresses "" ipv4.gateway "" ipv4.dns "" && nmcli connection up "$CON" >/dev/null
}
set_static() { # cím/előtag átjáró dns (vesszővel)
  nmcli connection modify "$CON" ipv4.method manual ipv4.addresses "$1" ipv4.gateway "$2" ipv4.dns "${3//,/ }" && nmcli connection up "$CON" >/dev/null
}

case "${1:-status}" in
  status)
    write_status
    cat "$NET_DIR/status.json"; echo ;;
  dhcp)
    [[ $EUID -eq 0 ]] || { echo "Run as root: sudo signage-network dhcp"; exit 1; }
    [[ -n "$CON" ]] || { echo "No active network connection found."; exit 1; }
    set_dhcp && echo "Automatic address (DHCP) set on $DEV." ; write_status ;;
  apply)
    REQ="${2:-$NET_DIR/request.json}"
    [[ -f "$REQ" ]] || exit 0
    # \x1f elválasztó: a tabulátort a read összevonná, és az üres mezők elcsúsznának
    IFS=$'\x1f' read -r ACTION MODE ADDR GW DNS ID < <(node -e 'try { const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      const s = (v) => String(v ?? "").replace(/[\x1f\n]/g, "");
      console.log([s(r.action || "apply"), s(r.mode), s(r.address), s(r.gateway), (Array.isArray(r.dns) ? r.dns : []).map(s).join(","), s(r.id)].join("\x1f")); } catch { console.log("invalid"); }' "$REQ")
    [[ "$ID" =~ ^[0-9]{1,16}$ ]] || ID=0
    if [[ "${ACTION:-}" == status ]]; then rm -f "$REQ"; write_status; exit 0; fi
    [[ -n "$CON" ]] || { write_result "$ID" 0 "No active network connection found."; exit 0; }
    if [[ "${MODE:-}" == dhcp ]]; then
      set_dhcp && write_result "$ID" 1 "" || write_result "$ID" 0 "NetworkManager could not apply the setting."
    elif [[ "${MODE:-}" == static ]]; then
      ok=1
      is_cidr "${ADDR:-}" || ok=0
      is_ip "${GW:-}" || ok=0
      IFS=',' read -r -a DNS_LIST <<< "${DNS:-}"
      (( ${#DNS_LIST[@]} >= 1 && ${#DNS_LIST[@]} <= 3 )) || ok=0
      for d in "${DNS_LIST[@]}"; do is_ip "$d" || ok=0; done
      if (( ok )); then
        set_static "$ADDR" "$GW" "$DNS" && write_result "$ID" 1 "" || write_result "$ID" 0 "NetworkManager could not apply the setting."
      else
        write_result "$ID" 0 "Invalid address, gateway or DNS."
      fi
    else
      write_result "$ID" 0 "Invalid request."
    fi
    rm -f "$REQ"
    write_status ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac
