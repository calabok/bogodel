#!/bin/bash
# Сборка одного файла игры: build.sh [BUILD_ID] [OUT]
set -e
cd "$(dirname "$0")"
B="${1:-local}"; OUT="${2:-index.html}"
cat src/part1.html src/part2.js src/part2b.js src/part2c.js src/part2d.js src/part2e.js src/part3.js src/part3b.js src/part3h.js src/part3f.js src/part3g.js src/part3c.js src/part3d.js src/part3e.js src/part3w.js src/part4.js src/part4d.js src/part4o.js src/part4b.js src/part4v.js src/part4c.js src/part9.html | sed "s/__BUILD__/$B/g" > "$OUT"
node -e "const s=require('fs').readFileSync('$OUT','utf8');new Function(s.split('<script>')[1].split('</script>')[0]);" 
echo "built $OUT ($B)"
