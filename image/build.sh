#!/usr/bin/env bash
# =============================================================================
#  Builds the Narancs Signage Raspberry Pi images (Linux, root – GitHub Actions)
#  The official Raspberry Pi OS Lite (64-bit) + a first boot service that installs
#  the latest Narancs Signage release. Output: out/*.img.xz, *.sha256, the Imager
#  repository JSON (narancs-signage-pi.json) and notes.md.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"
OUT="$(pwd)/out"; WORK="$(pwd)/work"
RELEASE_URL=https://github.com/mzzg-bazsi/narancs-signage/releases/download/pi-image
rm -rf "$OUT" "$WORK"; mkdir -p "$OUT" "$WORK"

# alap: a Raspberry Pi Imager hivatalos listájában a „Raspberry Pi OS Lite (64-bit)” bejegyzés
curl -fsSL https://downloads.raspberrypi.com/os_list_imagingutility_v4.json -o "$WORK/os_list.json"
python3 - "$WORK/os_list.json" > "$WORK/base.json" <<'PY'
import json, sys
def walk(items):
    for it in items:
        yield it
        yield from walk(it.get('subitems', []))
os_list = json.load(open(sys.argv[1]))['os_list']
base = next(i for i in walk(os_list) if i.get('url', '').endswith('.img.xz') and 'raspios_lite_arm64' in i['url'])
print(json.dumps(base))
PY
BASE_URL="$(python3 -c 'import json;print(json.load(open("'"$WORK"'/base.json"))["url"])')"
echo "Base image: $BASE_URL"
curl -fL --retry 3 -o "$WORK/base.img.xz" "$BASE_URL"
xz -d -T0 "$WORK/base.img.xz"

for MODE in screen all-in-one server; do
  IMG="$WORK/narancs-signage-pi-$MODE.img"
  cp "$WORK/base.img" "$IMG"
  LOOP="$(losetup -fP --show "$IMG")"
  MNT="$WORK/mnt"; mkdir -p "$MNT"
  mount "${LOOP}p2" "$MNT"
  mount "${LOOP}p1" "$MNT/boot/firmware"
  install -D -m 0755 firstboot.sh "$MNT/usr/local/lib/narancs-signage/firstboot.sh"
  install -D -m 0644 narancs-firstboot.service "$MNT/etc/systemd/system/narancs-firstboot.service"
  mkdir -p "$MNT/etc/systemd/system/multi-user.target.wants" "$MNT/etc/narancs-signage"
  ln -sf /etc/systemd/system/narancs-firstboot.service "$MNT/etc/systemd/system/multi-user.target.wants/narancs-firstboot.service"
  echo "$MODE" > "$MNT/etc/narancs-signage/image-mode"
  install -m 0644 "narancs-signage-$MODE.txt" "$MNT/boot/firmware/narancs-signage.txt"
  sync; umount "$MNT/boot/firmware" "$MNT"; losetup -d "$LOOP"
  echo "✔ $MODE"
done

# tömörítés, ellenőrzőösszegek, Imager tartalomtár
for MODE in screen all-in-one server; do
  IMG="$WORK/narancs-signage-pi-$MODE.img"
  stat -c %s "$IMG" > "$IMG.size"; sha256sum "$IMG" | cut -d' ' -f1 > "$IMG.sha"
  xz -T0 -6 -c "$IMG" > "$OUT/narancs-signage-pi-$MODE.img.xz"
  (cd "$OUT" && sha256sum "narancs-signage-pi-$MODE.img.xz" > "narancs-signage-pi-$MODE.img.xz.sha256")
done
python3 - "$WORK" "$OUT" "$RELEASE_URL" <<'PY'
import json, os, sys, datetime
work, out, url = sys.argv[1:]
base = json.load(open(f'{work}/base.json'))
desc = {'screen': 'Display only – connects to your Narancs Signage server (set SERVER in narancs-signage.txt on the boot partition).',
        'all-in-one': 'Server and display on one device – the admin panel runs on this Raspberry Pi.',
        'server': 'Server only, without a display – your other screens connect to it.'}
names = {'all-in-one': 'server + display', 'screen': 'display only', 'server': 'server only'}
items = []
for mode in ('all-in-one', 'screen', 'server'):
    f = f'narancs-signage-pi-{mode}.img'
    items.append({
        'name': f'Narancs Signage ({names[mode]})',
        'description': desc[mode] + ' Installs the latest release on first start.',
        'icon': 'https://mzzg-bazsi.github.io/narancs-signage-website/assets/favicon.svg',
        'url': f'{url}/{f}.xz',
        'extract_size': int(open(f'{work}/{f}.size').read()),
        'extract_sha256': open(f'{work}/{f}.sha').read().strip(),
        'image_download_size': os.path.getsize(f'{out}/{f}.xz'),
        'image_download_sha256': open(f'{out}/{f}.xz.sha256').read().split()[0],
        'release_date': datetime.date.today().isoformat(),
        **{k: base[k] for k in ('devices', 'init_format', 'capabilities') if k in base},
    })
json.dump({'os_list': items}, open(f'{out}/narancs-signage-pi.json', 'w'), indent=1)
open(f'{out}/notes.md', 'w').write(f"""Ready-to-flash Raspberry Pi images. They install the **latest Narancs Signage release on first start**, so they don't need to be rebuilt for every version.

| Image | For |
|---|---|
| `narancs-signage-pi-all-in-one.img.xz` | Server + display on one Raspberry Pi |
| `narancs-signage-pi-screen.img.xz` | Display only – set `SERVER=` in `narancs-signage.txt` on the boot partition |
| `narancs-signage-pi-server.img.xz` | Server only, no display – the admin address is shown at login |

**Easiest:** in Raspberry Pi Imager open *App Options → Content Repository → Use custom URL* and enter
`{url}/narancs-signage-pi.json` – all three images appear in the list, and the Wi-Fi / user / SSH settings work.
Or download an image and use *Use custom* (or balenaEtcher).

Base: {base['name']} ({base.get('release_date', '')}), 64-bit – Raspberry Pi 3, 4, 5, Zero 2 W. The first start needs internet and takes 5–15 minutes.
Guide: https://mzzg-bazsi.github.io/narancs-signage-website/docs/#pi-image
""")
PY
ls -la "$OUT"
