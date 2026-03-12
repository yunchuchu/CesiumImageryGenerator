#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PROJECT_DIR/.." && pwd)"

if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$PROJECT_DIR/.env"
  set +a
fi

INPUT_ROOT="${OSM_GEOJSON_INPUT_DIR:-}"
RAW_DIR="${OSM_GEOJSON_RAW_DIR:-${INPUT_ROOT:+$INPUT_ROOT/raw}}"
ELEM_DIR="${OSM_GEOJSON_ELEM_DIR:-${INPUT_ROOT:+$INPUT_ROOT/elements}}"

RAW_DIR="${RAW_DIR:-$REPO_ROOT/resource/geojsonData/raw}"
ELEM_DIR="${ELEM_DIR:-$REPO_ROOT/resource/geojsonData/elements}"

if [[ ! -d "$RAW_DIR" ]]; then
  echo "Missing raw directory: $RAW_DIR" >&2
  exit 1
fi

if [[ ! -d "$ELEM_DIR" ]]; then
  echo "Missing elements directory: $ELEM_DIR" >&2
  exit 1
fi

COMPOSE="docker compose --project-directory $PROJECT_DIR -f $PROJECT_DIR/docker-compose.yml"
PGDATABASE="${POSTGRES_DB:-gis}"
PGUSER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"
PGPORT="${POSTGRES_PORT:-5432}"

psql_exec() {
  $COMPOSE exec -T postgis psql -U "$PGUSER" -d "$PGDATABASE" "$@"
}

echo "Ensuring schema osm_raw exists"
psql_exec -c "CREATE SCHEMA IF NOT EXISTS osm_raw;"

OGR_MODE="local"
if ! command -v ogr2ogr >/dev/null 2>&1; then
  OGR_MODE="docker"
fi

if [[ "$OGR_MODE" == "local" ]]; then
  PGHOST="${PGHOST:-127.0.0.1}"
  OGR2OGR=(ogr2ogr)
  CONN="PG:host=${PGHOST} port=${PGPORT} dbname=${PGDATABASE} user=${PGUSER} password=${PGPASSWORD}"
  FILE_PREFIX=""
else
  NETWORK_NAME="${COMPOSE_PROJECT_NAME:-vtserver}_default"
  GDAL_IMAGE="${GDAL_IMAGE:-ghcr.io/osgeo/gdal:alpine-small-latest}"
  OGR2OGR=(docker run --rm --network "$NETWORK_NAME" -v "$REPO_ROOT:/data" -e PGPASSWORD="$PGPASSWORD" "$GDAL_IMAGE" ogr2ogr)
  CONN="PG:host=postgis port=5432 dbname=${PGDATABASE} user=${PGUSER} password=${PGPASSWORD}"
  FILE_PREFIX="/data"
fi

import_one() {
  local file_path="$1"
  local table_name="$2"
  local input_path="$file_path"

  if [[ -n "$FILE_PREFIX" ]]; then
    input_path="$FILE_PREFIX/${file_path#$REPO_ROOT/}"
  fi

  echo "Importing $(basename "$file_path") -> osm_raw.${table_name}"
  "${OGR2OGR[@]}" -f PostgreSQL "$CONN" "$input_path" \
    -nln "osm_raw.${table_name}" \
    -nlt PROMOTE_TO_MULTI \
    -lco GEOMETRY_NAME=geom \
    -lco FID=gid \
    -lco LAUNDER=NO \
    -a_srs EPSG:4326 \
    -overwrite
}

shopt -s nullglob
for file in "$RAW_DIR"/*.geojson "$ELEM_DIR"/*.geojson; do
  table_name="$(basename "$file" .geojson)"
  import_one "$file" "$table_name"
done
shopt -u nullglob

echo "Creating indexes"
psql_exec <<'SQL'
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'osm_raw' AND table_type = 'BASE TABLE'
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema AND table_name = r.table_name AND column_name = 'geom'
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I USING GIST(geom)', r.table_name || '_geom_gix', r.table_schema, r.table_name);
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema AND table_name = r.table_name AND column_name = 'fclass'
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (fclass)', r.table_name || '_fclass_idx', r.table_schema, r.table_name);
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema AND table_name = r.table_name AND column_name = 'name'
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (name)', r.table_name || '_name_idx', r.table_schema, r.table_name);
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema AND table_name = r.table_name AND column_name = 'ref'
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (ref)', r.table_name || '_ref_idx', r.table_schema, r.table_name);
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema AND table_name = r.table_name AND column_name = 'element'
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (element)', r.table_name || '_element_idx', r.table_schema, r.table_name);
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.table_schema AND table_name = r.table_name AND column_name = 'source_layer'
    ) THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (source_layer)', r.table_name || '_source_layer_idx', r.table_schema, r.table_name);
    END IF;
  END LOOP;
END $$;

ANALYZE;
SQL

echo "Import complete"
