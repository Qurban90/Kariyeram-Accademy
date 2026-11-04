#!/usr/bin/env bash
# DB testləri. DATABASE_URL verilibsə ona qoşulur (CI), yoxsa lokal Postgres klasteri açır.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
MIG="$ROOT/migrations"

run_sql() { psql "$URL" -v ON_ERROR_STOP=1 -q -X "$@"; }

if [[ -n "${DATABASE_URL:-}" ]]; then
  URL="$DATABASE_URL"
else
  PGBIN="$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)"
  DATA="$ROOT/.pgtest"
  AS=()
  if [[ "$(id -u)" == "0" ]]; then AS=(runuser -u postgres --); fi
  if [[ ! -d "$DATA/data" ]]; then
    mkdir -p "$DATA"; [[ ${#AS[@]} -gt 0 ]] && chown -R postgres "$DATA"
    "${AS[@]}" "$PGBIN/initdb" -D "$DATA/data" -U postgres -A trust >/dev/null
  fi
  "${AS[@]}" "$PGBIN/pg_ctl" -D "$DATA/data" -o "-p 54329 -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
  trap '"${AS[@]}" "$PGBIN/pg_ctl" -D "$DATA/data" -m fast stop >/dev/null' EXIT
  URL="postgresql://postgres@/postgres?host=$DATA&port=54329"
  psql "$URL" -q -X -c "drop database if exists karyeram_test" -c "create database karyeram_test" >/dev/null
  URL="postgresql://postgres@/karyeram_test?host=$DATA&port=54329"
fi

run_sql -f "$HERE/00_supabase_stub.sql" >/dev/null
for f in "$MIG"/*.sql; do run_sql -f "$f" >/dev/null; done
for t in "$HERE"/*.test.sql; do
  echo "== $(basename "$t")"
  run_sql -f "$t" 2>&1 | sed -n 's/^.*NOTICE:  //p; /FAIL/p; /BÜTÜN/p; /ERROR/p'
done
