#!/usr/bin/env bash
# Gera o pacote da extensão pronto para a Chrome Web Store em dist/.
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/ai-in-browser-${VERSION}.zip"

rm -rf dist
mkdir -p dist

# -X descarta os campos extras (dono, grupo e horário de acesso). Sem isso o
# horário de acesso muda a cada leitura e dois pacotes do mesmo código saem
# com bytes diferentes, impedindo conferir o arquivo publicado contra um
# build local.
zip -qrX "$OUT" \
  manifest.json \
  background.js \
  sidepanel.html sidepanel.css sidepanel.js \
  options.html options.css options.js \
  common.css \
  lib icons \
  LICENSE \
  -x "*.DS_Store" "icons/icon.svg"

echo "Pacote: $OUT"
unzip -l "$OUT" | tail -n 3
