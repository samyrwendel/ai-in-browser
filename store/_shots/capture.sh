#!/usr/bin/env bash
# Gera as capturas 1280x800 da Chrome Web Store com o Chrome em modo headless.
# Requer um servidor estático na raiz do projeto:  python3 -m http.server 8765
set -uo pipefail
cd "$(dirname "$0")/../.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
BASE="${BASE:-http://localhost:8765}"
OUT="store/screenshots"
mkdir -p "$OUT"

shoot() {
  local file="$1" url="$2"
  local prof; prof=$(mktemp -d /tmp/aib-prof.XXXXXX)
  rm -f "$file"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run \
    --no-default-browser-check --force-device-scale-factor=1 \
    --user-data-dir="$prof" --window-size=1280,800 --virtual-time-budget=7000 \
    --screenshot="$file" "$url" >/dev/null 2>&1 &
  local pid=$!
  for _ in $(seq 1 60); do
    if [ -s "$file" ]; then sleep 0.8; break; fi
    sleep 0.5
  done
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  rm -rf "$prof"
  if [ -s "$file" ]; then echo "  ok  $file  $(file -b "$file" | cut -d, -f2)"; else echo "  FALHOU $file"; fi
}

echo "Gerando capturas em $OUT (base: $BASE)"
shoot "$OUT/01-navegar.png" "$BASE/store/_shots/shot.html?s=navegar"
shoot "$OUT/02-modelos.png" "$BASE/store/_shots/shot.html?s=modelos"
shoot "$OUT/03-pagina.png"  "$BASE/store/_shots/shot.html?s=pagina"
shoot "$OUT/04-local.png"   "$BASE/store/_shots/shot.html?s=local"
shoot "$OUT/05-config.png"  "$BASE/store/_shots/shot.html?s=config"
echo "Pronto."
