#!/usr/bin/env bash
# Teste les migrations, les règles RLS et les données de démo sur un PostgreSQL
# local jetable (sans Docker ni compte Supabase).
# Prérequis : PostgreSQL 15+ avec les binaires initdb/pg_ctl et l'extension btree_gist.
# Usage : scripts/test-db.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl)")}"
PORT="${PGPORT_TEST:-54329}"
DATA_DIR="$(mktemp -d)"
LOG_FILE="$DATA_DIR/postgres.log"

# initdb refuse de tourner en root : on utilise alors l'utilisateur "postgres".
run() {
  if [ "$(id -u)" = "0" ]; then
    su postgres -s /bin/bash -c "$(printf '%q ' "$@")"
  else
    "$@"
  fi
}

cleanup() {
  run "$PG_BIN/pg_ctl" -D "$DATA_DIR/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA_DIR"
}
trap cleanup EXIT

[ "$(id -u)" = "0" ] && chown postgres "$DATA_DIR"
run "$PG_BIN/initdb" -D "$DATA_DIR/data" -U postgres --auth=trust >/dev/null
run "$PG_BIN/pg_ctl" -D "$DATA_DIR/data" -l "$LOG_FILE" -o "-p $PORT -k $DATA_DIR -c listen_addresses=''" -w start >/dev/null

psql_db() {
  psql -h "$DATA_DIR" -p "$PORT" -U postgres -X -q -v ON_ERROR_STOP=1 "$@"
}

for db in tests seed; do
  psql_db -d postgres -c "create database $db"
  psql_db -d "$db" -f "$ROOT/tests/db/supabase_stubs.sql"
  for migration in "$ROOT"/supabase/migrations/*.sql; do
    psql_db -d "$db" -f "$migration"
  done
done
echo "✔ Migrations appliquées"

psql_db -d tests -f "$ROOT/tests/db/rls.test.sql"

psql_db -d seed -f "$ROOT/supabase/seed.sql"
psql_db -d seed -At -c "
  select format('✔ Données de démo : %s comptes, %s créneaux, %s rendez-vous, %s prises de médicaments',
    (select count(*) from public.profiles), (select count(*) from public.slots),
    (select count(*) from public.appointments), (select count(*) from public.medication_intakes))"
