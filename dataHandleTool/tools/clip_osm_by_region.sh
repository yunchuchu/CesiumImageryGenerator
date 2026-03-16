#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  clip_osm_by_region.sh [options] [INPUT] [OUTPUT]

  Clip OSM data (GPKG or GeoJSON) to a bounding box or polygon.
  Boundary: exactly one of -b/--bbox or -p/--polygon (CLI overrides env).

Options:
  -i, --input     Input GPKG or GeoJSON file (default: env OSM_CLIP_INPUT)
  -o, --output    Output GPKG or GeoJSON file (default: env OSM_CLIP_OUTPUT)
  -b, --bbox      Bbox: min_lon min_lat max_lon max_lat (default: env OSM_CLIP_BBOX)
  -p, --polygon   Path to GeoJSON Polygon/MultiPolygon file (default: env OSM_CLIP_POLYGON)
  -h, --help      Show this help

Environment:
  OSM_CLIP_INPUT    Input path
  OSM_CLIP_OUTPUT   Output path
  OSM_CLIP_BBOX     Space-separated: min_lon min_lat max_lon max_lat
  OSM_CLIP_POLYGON  Path to clipping polygon GeoJSON

Examples:
  clip_osm_by_region.sh -i region.gpkg -o clipped.gpkg -b 116.0 31.0 119.0 34.0
  clip_osm_by_region.sh -i region.gpkg -o out.gpkg -p boundary.geojson
  OSM_CLIP_BBOX="116 31 119 34" ./clip_osm_by_region.sh -i in.gpkg -o out.gpkg
USAGE
}

# Defaults from env (CLI will override)
INPUT="${OSM_CLIP_INPUT:-}"
OUTPUT="${OSM_CLIP_OUTPUT:-}"
BBOX="${OSM_CLIP_BBOX:-}"
POLYGON="${OSM_CLIP_POLYGON:-}"

BBOX_SET=false
POLYGON_SET=false
positional=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--input)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for $1" >&2
        usage
        exit 1
      fi
      INPUT="$2"
      shift 2
      ;;
    -o|--output)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for $1" >&2
        usage
        exit 1
      fi
      OUTPUT="$2"
      shift 2
      ;;
    -b|--bbox)
      if [[ $# -lt 5 ]]; then
        echo "Missing value for $1 (need 4 numbers: min_lon min_lat max_lon max_lat)" >&2
        usage
        exit 1
      fi
      BBOX="$2 $3 $4 $5"
      BBOX_SET=true
      POLYGON_SET=false
      shift 5
      ;;
    -p|--polygon)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for $1" >&2
        usage
        exit 1
      fi
      POLYGON="$2"
      POLYGON_SET=true
      BBOX_SET=false
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      positional+=("$1")
      shift
      ;;
  esac
done

if [[ ${#positional[@]} -ge 1 ]] && [[ -z "$INPUT" ]]; then
  INPUT="${positional[0]}"
fi
if [[ ${#positional[@]} -ge 2 ]] && [[ -z "$OUTPUT" ]]; then
  OUTPUT="${positional[1]}"
fi
if [[ ${#positional[@]} -gt 2 ]]; then
  echo "Too many positional arguments" >&2
  usage
  exit 1
fi

# --- Validation (task 4.2) ---
if ! command -v ogr2ogr &>/dev/null; then
  echo "Error: ogr2ogr not found. Install GDAL/OGR." >&2
  exit 1
fi

if [[ -z "$INPUT" ]] || [[ -z "$OUTPUT" ]]; then
  echo "Error: input and output paths are required (use -i/-o or env OSM_CLIP_INPUT/OSM_CLIP_OUTPUT)." >&2
  usage
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Error: input file does not exist: $INPUT" >&2
  exit 1
fi

# Exactly one of bbox or polygon
if [[ -n "$BBOX" ]] && [[ -n "$POLYGON" ]]; then
  echo "Error: provide only one of bbox (-b) or polygon (-p), not both." >&2
  usage
  exit 1
fi
if [[ -z "$BBOX" ]] && [[ -z "$POLYGON" ]]; then
  echo "Error: provide either bbox (-b/OSM_CLIP_BBOX) or polygon (-p/OSM_CLIP_POLYGON)." >&2
  usage
  exit 1
fi

if [[ -n "$POLYGON" ]] && [[ ! -f "$POLYGON" ]]; then
  echo "Error: polygon file does not exist: $POLYGON" >&2
  exit 1
fi

# --- Output format from extension (task 4.1) ---
OUT_EXT="${OUTPUT##*.}"
OUT_EXT_LOWER=$(printf '%s' "$OUT_EXT" | tr '[:upper:]' '[:lower:]')
if [[ "$OUT_EXT_LOWER" == "gpkg" ]]; then
  OUT_FORMAT=GPKG
elif [[ "$OUT_EXT_LOWER" == "geojson" ]] || [[ "$OUT_EXT_LOWER" == "json" ]]; then
  OUT_FORMAT=GeoJSON
else
  echo "Error: output path must have .gpkg, .geojson or .json extension." >&2
  exit 1
fi

IN_EXT="${INPUT##*.}"
IN_EXT_LOWER=$(printf '%s' "$IN_EXT" | tr '[:upper:]' '[:lower:]')
if [[ "$IN_EXT_LOWER" == "gpkg" ]]; then
  IN_FORMAT=GPKG
elif [[ "$IN_EXT_LOWER" == "geojson" ]] || [[ "$IN_EXT_LOWER" == "json" ]]; then
  IN_FORMAT=GeoJSON
else
  echo "Error: input must be .gpkg, .geojson or .json." >&2
  exit 1
fi

# --- Clip logic ---
do_clip_bbox() {
  local src="$1"
  local dst="$2"
  local layer_arg="$3"
  local append="${4:-}"
  # BBOX must be 4 space-separated numbers
  local xmin ymin xmax ymax
  read -r xmin ymin xmax ymax <<< "$BBOX"
  if [[ -n "$layer_arg" ]]; then
    if [[ -n "$append" ]]; then
      ogr2ogr -append -spat "$xmin" "$ymin" "$xmax" "$ymax" "$dst" "$src" $layer_arg
    else
      ogr2ogr -spat "$xmin" "$ymin" "$xmax" "$ymax" "$dst" "$src" $layer_arg
    fi
  else
    if [[ -n "$append" ]]; then
      ogr2ogr -append -spat "$xmin" "$ymin" "$xmax" "$ymax" "$dst" "$src"
    else
      ogr2ogr -spat "$xmin" "$ymin" "$xmax" "$ymax" "$dst" "$src"
    fi
  fi
}

do_clip_polygon() {
  local src="$1"
  local dst="$2"
  local layer_arg="$3"
  local append="${4:-}"
  if [[ -n "$layer_arg" ]]; then
    if [[ -n "$append" ]]; then
      ogr2ogr -append -clipsrc "$POLYGON" "$dst" "$src" $layer_arg
    else
      ogr2ogr -clipsrc "$POLYGON" "$dst" "$src" $layer_arg
    fi
  else
    if [[ -n "$append" ]]; then
      ogr2ogr -append -clipsrc "$POLYGON" "$dst" "$src"
    else
      ogr2ogr -clipsrc "$POLYGON" "$dst" "$src"
    fi
  fi
}

get_gpkg_layers() {
  ogrinfo -so -al "$INPUT" 2>/dev/null | sed -n 's/^[[:space:]]*[0-9][0-9]*: \([^ (]*\).*/\1/p'
}

if [[ -n "$BBOX" ]]; then
  # Bbox clip (tasks 2.1, 2.2, 2.3)
  if [[ "$IN_FORMAT" == "GPKG" ]]; then
    layers=()
    while IFS= read -r name; do
      [[ -n "$name" ]] && layers+=("$name")
    done < <(get_gpkg_layers)
    if [[ ${#layers[@]} -eq 0 ]]; then
      do_clip_bbox "$INPUT" "$OUTPUT" ""
    else
      first=1
      for layer in "${layers[@]}"; do
        if [[ $first -eq 1 ]]; then
          do_clip_bbox "$INPUT" "$OUTPUT" "$layer" ""
          first=0
        else
          do_clip_bbox "$INPUT" "$OUTPUT" "$layer" "append"
        fi
      done
    fi
  else
    do_clip_bbox "$INPUT" "$OUTPUT" ""
  fi
else
  # Polygon clip (tasks 3.1, 3.2, 3.3)
  if [[ "$IN_FORMAT" == "GPKG" ]]; then
    layers=()
    while IFS= read -r name; do
      [[ -n "$name" ]] && layers+=("$name")
    done < <(get_gpkg_layers)
    if [[ ${#layers[@]} -eq 0 ]]; then
      do_clip_polygon "$INPUT" "$OUTPUT" ""
    else
      first=1
      for layer in "${layers[@]}"; do
        if [[ $first -eq 1 ]]; then
          do_clip_polygon "$INPUT" "$OUTPUT" "$layer" ""
          first=0
        else
          do_clip_polygon "$INPUT" "$OUTPUT" "$layer" "append"
        fi
      done
    fi
  else
    do_clip_polygon "$INPUT" "$OUTPUT" ""
  fi
fi

echo "Done: $OUTPUT"
