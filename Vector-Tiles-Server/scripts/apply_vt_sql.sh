#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PROJECT_DIR/.env"
  set +a
fi

COMPOSE="docker compose --project-directory $PROJECT_DIR -f $PROJECT_DIR/docker-compose.yml"
PGDATABASE="${POSTGRES_DB:-gis}"
PGUSER="${POSTGRES_USER:-postgres}"

psql_exec() {
  $COMPOSE exec -T postgis psql -U "$PGUSER" -d "$PGDATABASE" "$@"
}

for sql in "$PROJECT_DIR"/sql/*.sql; do
  echo "Applying $sql"
  # psql runs inside the container, so pipe the host file through stdin
  psql_exec -v ON_ERROR_STOP=1 -f - < "$sql"
done

echo "VT schema and tilesets applied"
