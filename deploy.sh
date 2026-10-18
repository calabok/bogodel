#!/bin/bash
# БогоДел: сборка + публикация на GitHub Pages (https://calabok.github.io/bogodel/)
#   ./deploy.sh "что изменилось"      — собрать, поднять версию SW, закоммитить и запушить
#   NOPUSH=1 ./deploy.sh              — только собрать сайт в репозиторий (без коммита/пуша)
set -euo pipefail
cd "$(dirname "$0")"
SRC=$(pwd)
REPO="${REPO:-/workspace/bogodel-repo}"
MSG="${1:-обновление}"
BUILD="$(date +%Y%m%d-%H%M%S)"
./build.sh local index.html >/dev/null; cp -r site/icons . ; cp site/manifest.webmanifest .   # локальная копия для тестов
mkdir -p "$REPO/docs/icons" "$REPO/src" "$REPO/tests" "$REPO/tools"
./build.sh "$BUILD" "$REPO/docs/index.html"
sed "s/__BUILD__/$BUILD/g" site/sw.js.tpl > "$REPO/docs/sw.js"   # новая версия SW → обновление у игроков
cp site/manifest.webmanifest "$REPO/docs/"
cp site/icons/*.png "$REPO/docs/icons/"
printf '{"build":"%s"}\n' "$BUILD" > "$REPO/docs/version.json"
touch "$REPO/docs/.nojekyll"
cp src/*.html src/*.js "$REPO/src/"
cp build.sh deploy.sh "$REPO/"
cp site/sw.js.tpl site/manifest.webmanifest "$REPO/tools/" 2>/dev/null || true
cp tools_icons.py "$REPO/tools/make_icons.py"
cp fuzz5.py targeted5.py targeted5_v5.py balance5.js bal5.py baltab.py dun5.py shots5.py fuzz4.py targeted4.py balance4.py online4.py shots4.py migrate_test.py pace.py online.py shots3.py shots_hp.py pwa_test.py "$REPO/tests/" 2>/dev/null || true
cp PACING.md "$REPO/" 2>/dev/null || true
if [ "${NOPUSH:-0}" = "1" ]; then echo "Собрано: $BUILD (без пуша)"; exit 0; fi
cd "$REPO"
git add -A
git commit -q -m "Деплой $BUILD: $MSG" || { echo "Нет изменений"; exit 0; }
timeout 120 git push -q origin main
echo "Опубликовано: $BUILD → https://calabok.github.io/bogodel/"
