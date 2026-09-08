#!/usr/bin/env bash
# Roda todas as verificações da extensão. Sem dependências: só Node.
# Uso: tests/run.sh [nome]   (ex.: tests/run.sh roles)
set -uo pipefail
cd "$(dirname "$0")"

filtro="${1:-}"
total=0
falhas=0
suites=0

for f in *.test.mjs; do
  nome="${f%.test.mjs}"
  [ -n "$filtro" ] && [[ "$nome" != *"$filtro"* ]] && continue
  suites=$((suites + 1))
  saida=$(node "$f" 2>&1)
  codigo=$?
  ok=$(printf '%s\n' "$saida" | grep -c '^ok')
  ruim=$(printf '%s\n' "$saida" | grep -c '^FALHA')
  total=$((total + ok))
  falhas=$((falhas + ruim))
  if [ "$codigo" -ne 0 ] || [ "$ruim" -ne 0 ]; then
    printf '%-12s %s\n' "$nome" "FALHOU ($ok ok, $ruim falhas)"
    printf '%s\n' "$saida" | sed 's/^/    /'
    [ "$ruim" -eq 0 ] && falhas=$((falhas + 1))
  else
    printf '%-12s %s\n' "$nome" "ok ($ok)"
  fi
done

echo
if [ "$suites" -eq 0 ]; then
  echo "Nenhuma suíte corresponde a \"$filtro\"."
  exit 1
fi
if [ "$falhas" -ne 0 ]; then
  echo "$falhas falha(s) em $total verificações."
  exit 1
fi
echo "$total verificações, $suites suítes, tudo certo."
