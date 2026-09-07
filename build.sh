#!/usr/bin/env bash
# Gera o pacote da extensão pronto para a Chrome Web Store em dist/.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/ai-in-browser-${VERSION}.zip"

rm -rf dist
mkdir -p dist

zip -qr "$OUT" \
  manifest.json \
  background.js \
  sidepanel.html sidepanel.css sidepanel.js \
  options.html options.css options.js \
  common.css \
  lib icons \
  LICENSE \
  -x "*.DS_Store" "icons/*.svg" "icons/_*"

echo "Pacote: $OUT"
unzip -l "$OUT" | tail -n 3
