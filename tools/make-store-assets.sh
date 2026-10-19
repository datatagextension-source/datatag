#!/bin/sh
# Renders Chrome Web Store screenshots (1280x800) and the small promo tile (440x280)
# into store/screenshots/, using headless Chrome and the extension's real pages
# with demo data (store/assets/stub.js).
set -e
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8767
OUT=store/screenshots
mkdir -p "$OUT"

# Refresh the stubbed copies of the real pages so screenshots match the current UI.
python3 - <<'PY'
import re
for src, dst, css in [
  ('popup.html', 'store/assets/popup-frame.html', 'body { overflow: hidden; }'),
  ('report.html', 'store/assets/report-frame.html',
   'body { padding: 0; overflow: hidden; } main > :not(canvas) { display: none !important; } main { max-width: none; } canvas { margin: 0; border: 0; border-radius: 0; }'),
  ('options.html', 'store/assets/options-frame.html', 'body { padding: 40px 48px; overflow: hidden; }'),
]:
    s = open(src).read()
    s = re.sub(r'(href|src)="(?!http|#|mailto)([^"]+)"', lambda m: f'{m.group(1)}="../../{m.group(2)}"', s)
    s = s.replace('<script type="module"', '<script src="stub.js"></script>\n  <script type="module"', 1)
    s = s.replace('</head>', f'  <style>{css}</style>\n</head>', 1)
    open(dst, 'w').write(s)
PY

python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER=$!
PROFILE=$(mktemp -d)
trap 'kill $SERVER 2>/dev/null; rm -rf "$PROFILE"' EXIT
sleep 1

shoot() { # url size file
  "$CHROME" --headless=new --user-data-dir="$PROFILE" --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --blink-settings=preferredColorScheme=1 \
    --window-size="$2" --virtual-time-budget=5000 --screenshot="$3" "$1" >/dev/null 2>&1
  echo "$3"
}

for n in 1 2 3 4; do
  shoot "http://localhost:$PORT/store/assets/shot.html?n=$n" 1280,800 "$OUT/screenshot-$n.png"
done
shoot "http://localhost:$PORT/store/assets/tile.html" 440,280 "$OUT/promo-tile-440x280.png"
