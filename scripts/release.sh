#!/usr/bin/env bash
# Új verzió kiadása: verziószám emelés, változásnapló ellenőrzés, commit + címke (tag), feltöltés
#   ./scripts/release.sh patch|minor|major   vagy   ./scripts/release.sh 1.2.3
set -euo pipefail
cd "$(dirname "$0")/.."

[[ -z "$(git status --porcelain)" ]] || { echo "✘ Előbb commitold a változtatásokat (git status)."; exit 1; }
CUR="$(node -p "require('./server/package.json').version")"
IFS=. read -r MA MI PA <<< "$CUR"
case "${1:-}" in
  patch) NEW="$MA.$MI.$((PA + 1))" ;;
  minor) NEW="$MA.$((MI + 1)).0" ;;
  major) NEW="$((MA + 1)).0.0" ;;
  [0-9]*.[0-9]*.[0-9]*) NEW="$1" ;;
  *) echo "Használat: $0 patch|minor|major|X.Y.Z   (jelenlegi: $CUR)"; exit 1 ;;
esac
grep -q "^## \[$NEW\]" CHANGELOG.md || { echo "✘ A CHANGELOG.md-ben nincs „## [$NEW]” bejegyzés. Írd meg előbb, mi változott."; exit 1; }

node -e "const f='./server/package.json',p=require(f);p.version='$NEW';require('fs').writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
git add server/package.json CHANGELOG.md
git commit -q -m "Kiadás v$NEW"
git tag -a "v$NEW" -m "v$NEW"
echo "✔ v$CUR → v$NEW"
# a taget külön küldjük fel, hogy a GitHub Actions kiadás (Docker kép) biztosan elinduljon
if git remote get-url origin >/dev/null 2>&1; then git push -q origin HEAD && git push -q origin "v$NEW" && echo "✔ Feltöltve a GitHubra"; fi
