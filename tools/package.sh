#!/bin/sh
# Builds the zip to upload to the Chrome Web Store: only the files the extension
# needs at runtime (no tests, tools, store docs or git history).
set -e
cd "$(dirname "$0")/.."
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
OUT="dist/datatag-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
zip -q -r "$OUT" manifest.json *.js *.html *.css lib icons -x '.*'
echo "$OUT"
unzip -l "$OUT" | tail -n +4 | sed '$d' | sed '$d' | awk '{print "  " $4}'
