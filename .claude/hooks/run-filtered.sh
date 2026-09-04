#!/usr/bin/env bash
# Runs "$@" and trims noisy output while preserving errors/warnings and the
# tail summary. Used by pretooluse-filter-npm.sh to wrap npm run build/lint.
set -o pipefail

out="$("$@" 2>&1)"
status=$?
total=$(printf '%s\n' "$out" | wc -l | tr -d ' ')

head_n=20
tail_n=20
[ "$status" -ne 0 ] && head_n=80 && tail_n=80

if [ "$total" -le $((head_n + tail_n + 10)) ]; then
  printf '%s\n' "$out"
else
  printf '%s\n' "$out" | head -n "$head_n"
  omitted=$((total - head_n - tail_n))
  echo ""
  echo "... $omitted lines omitted by run-filtered.sh ..."
  echo ""
  printf '%s\n' "$out" | tail -n "$tail_n"
fi

echo ""
echo "(run-filtered.sh: exit $status, $total original lines)"
exit "$status"
