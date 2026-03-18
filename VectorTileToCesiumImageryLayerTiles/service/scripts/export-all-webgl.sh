#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEFAULT_STYLE="$SCRIPT_DIR/../../shared/default-style-config.json"
STYLE_PATH="${1:-$DEFAULT_STYLE}"
MIN_ZOOM="${2:-14}"
MAX_ZOOM="${3:-15}"
OUTPUT_PATH="${4:-output/demo-webgl2}"
TILE_SIZE="${5:-512}"
FORMAT="${6:-png}"
BOUNDS="${7:-120.0,31.0,121.0,32.0}"
GEOJSON_PATH="${8:-}"

cat >&2 <<'EOF'
请先用 WebGL 或 auto 后端启动服务，例如：
  RENDER_BACKEND=webgl RENDER_HEADLESS=false pnpm -C VectorTileToCesiumImageryLayerTiles/service dev

如果当前机器不支持 WebGL，可改用：
  RENDER_BACKEND=auto RENDER_HEADLESS=false pnpm -C VectorTileToCesiumImageryLayerTiles/service dev
EOF

bash "$SCRIPT_DIR/export-demo.sh" "$STYLE_PATH" "$MIN_ZOOM" "$MAX_ZOOM" "$OUTPUT_PATH" "$TILE_SIZE" "$FORMAT" "$BOUNDS" "$GEOJSON_PATH"
