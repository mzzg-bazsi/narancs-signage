#!/usr/bin/env bash
# Egy verzió kiadási jegyzete a CHANGELOG.md-ből (a „## [X.Y.Z]” szakasz) + telepítési sor
#   ./scripts/release-notes.sh 1.2.3
set -euo pipefail
cd "$(dirname "$0")/.."
V="${1:?Használat: $0 X.Y.Z}"
awk -v v="$V" 'index($0, "## [" v "]") == 1 { on = 1; next } on && /^## \[/ { exit } on' CHANGELOG.md | sed -e '/./,$!d'
# Docker kép az 1.15.0, telepítő asset az 1.18.0 óta
DOCKER=""
[[ "$(printf '1.15.0\n%s\n' "$V" | sort -V | head -1)" == 1.15.0 ]] && DOCKER="**Docker:** \`docker pull ghcr.io/mzzg-bazsi/narancs-signage:$V\` · "
INSTALL=""
[[ "$(printf '1.18.0\n%s\n' "$V" | sort -V | head -1)" == 1.18.0 ]] && INSTALL="**Server (Ubuntu/Debian):** \`curl -fsSL https://github.com/mzzg-bazsi/narancs-signage/releases/download/v$V/install.sh | sudo bash\` · **macOS:** same without \`sudo\` · "
printf '\n---\n%s%s**Install / update:** [documentation](https://mzzg-bazsi.github.io/narancs-signage-website/docs/#quickstart) · [Full changelog](https://github.com/mzzg-bazsi/narancs-signage/blob/main/CHANGELOG.md)\n' "$INSTALL" "$DOCKER"
